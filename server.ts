import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import {
  AUTOELITE_API_BASE,
  DEFAULT_DEALER_ID,
  DealerProfile,
  PROTOTYPE_DEALER,
  buildTextSystemPrompt,
  buildVoiceSystemPrompt,
  fetchDealerProfile,
  fetchDealerVehicles,
  localFactualReply,
  prototypeInventory,
} from './src/dealerPlatform.ts';
import type { Vehicle } from './src/types/inventory.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
const server = createServer(app);
const DEALER_ID = Number(process.env.DEALER_ID || DEFAULT_DEALER_ID);
const API_BASE = process.env.AUTOELITE_API_BASE || AUTOELITE_API_BASE;
const CACHE_MS = 60_000;

let dealerCache: { at: number; data: DealerProfile } | null = null;
let inventoryCache: { at: number; data: Vehicle[] } | null = null;

async function getDealer(): Promise<DealerProfile> {
  if (dealerCache && Date.now() - dealerCache.at < CACHE_MS) return dealerCache.data;
  try {
    const data = await fetchDealerProfile(DEALER_ID, API_BASE);
    dealerCache = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error('Dealer profile fetch failed', error);
    return dealerCache?.data || { ...PROTOTYPE_DEALER, id: DEALER_ID };
  }
}

async function getVehicles(search = ''): Promise<{ vehicles: Vehicle[]; source: 'autoelite' | 'prototype' }> {
  const key = search.trim();
  if (!key && inventoryCache && Date.now() - inventoryCache.at < CACHE_MS) {
    return { vehicles: inventoryCache.data, source: 'autoelite' };
  }
  try {
    const vehicles = await fetchDealerVehicles(key, DEALER_ID, API_BASE);
    if (!key) inventoryCache = { at: Date.now(), data: vehicles };
    return { vehicles, source: 'autoelite' };
  } catch (error) {
    console.error('Inventory fetch failed', error);
    return { vehicles: prototypeInventory(key), source: 'prototype' };
  }
}

app.get('/api/platform/context', async (_req, res) => {
  const dealer = await getDealer();
  res.json({ dealer, dealerId: DEALER_ID });
});

app.get('/api/platform/vehicles', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const result = await getVehicles(search);
  res.json({
    vehicles: result.vehicles,
    count: result.vehicles.length,
    dealerId: DEALER_ID,
    source: result.source,
  });
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// General dealership inquiries endpoint (bilingual FR & EN)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, lang = 'fr' } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const isEn = lang === 'en';
    const dealer = await getDealer();
    const factual = localFactualReply(message, dealer, isEn ? 'en' : 'fr');
    if (factual) {
      return res.json({ text: factual, source: 'dealer-profile' });
    }

    const { vehicles } = await getVehicles('');
    const systemInstruction = buildTextSystemPrompt(dealer, vehicles, isEn ? 'en' : 'fr');

    if (!apiKey) {
      return res.json({
        text: isEn
          ? `${dealer.agentName} can help you search the live ${dealer.name} inventory. Call ${dealer.phone} or visit ${dealer.addressLine}.`
          : `${dealer.agentName} peut vous aider à chercher dans l'inventaire en direct de ${dealer.name}. Appelez au ${dealer.phone} ou passez au ${dealer.addressLine}.`,
        source: 'dealer-profile',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config: {
        systemInstruction,
      }
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Erreur lors du traitement de votre message' });
  }
});

// Wrap raw 16-bit PCM in a WAV with a cosine fade-out and a short silence tail so playback does not pop.
function createWavWithFade(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  fadeOutMs = 100,
  silenceTailMs = 60
): Buffer {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = Math.floor(pcmBuffer.length / blockAlign);
  const fadeOutFrames = Math.floor(sampleRate * (fadeOutMs / 1000));
  const silenceFrames = Math.floor(sampleRate * (silenceTailMs / 1000));
  const totalFrames = numFrames + silenceFrames;
  const outputPcmLength = totalFrames * blockAlign;
  const outPcm = Buffer.alloc(outputPcmLength);
  pcmBuffer.copy(outPcm, 0, 0, numFrames * blockAlign);

  if (numFrames > fadeOutFrames) {
    const startFrame = numFrames - fadeOutFrames;
    for (let frame = 0; frame < fadeOutFrames; frame++) {
      const frameIdx = startFrame + frame;
      const gain = 0.5 * (1 + Math.cos((Math.PI * frame) / fadeOutFrames));
      for (let channel = 0; channel < numChannels; channel++) {
        const offset = (frameIdx * numChannels + channel) * 2;
        const sampleVal = outPcm.readInt16LE(offset);
        outPcm.writeInt16LE(Math.round(sampleVal * gain), offset);
      }
    }
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + outputPcmLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(outputPcmLength, 40);
  return Buffer.concat([header, outPcm]);
}

// High-fidelity spoken greeting introduction audio endpoint (serves the studio Kore WAV)
app.get('/api/tts/greeting', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const requestedVoice = (req.query.voice as string)?.toLowerCase() === 'puck' ? 'puck' : 'kore';
    const voiceName = requestedVoice === 'puck' ? 'Puck' : 'Kore';

    const specificWav = path.join(__dirname, 'public', 'audio', `greeting-${requestedVoice}-${lang}.wav`);
    const fallbackWav = path.join(__dirname, 'public', 'audio', `greeting-${lang}.wav`);

    const targetWav = fs.existsSync(specificWav) ? specificWav : (fs.existsSync(fallbackWav) ? fallbackWav : null);

    if (targetWav) {
      const audioBuffer = fs.readFileSync(targetWav);
      const wavUrl = fs.existsSync(specificWav)
        ? `/audio/greeting-${requestedVoice}-${lang}.wav`
        : `/audio/greeting-${lang}.wav`;
      return res.json({
        audio: audioBuffer.toString('base64'),
        wavUrl,
        format: 'audio/wav',
        lang,
        voice: voiceName,
      });
    }

    // Dynamic generation fallback when no studio WAV is on disk.
    const dealer = await getDealer();
    const feminine = requestedVoice !== 'puck';
    const text = lang === 'en'
      ? `Hello and welcome to ${dealer.name} in Laval! I'm your virtual advisor. How can I help you find your next vehicle today?`
      : (feminine
          ? `Bonjour et bienvenue chez ${dealer.name} à Laval! Je suis votre conseillère virtuelle. Comment puis-je vous aider aujourd'hui?`
          : `Bonjour et bienvenue chez ${dealer.name} à Laval! Je suis votre conseiller virtuel. Comment puis-je vous aider aujourd'hui?`);

    const ttsRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{
        role: 'user',
        parts: [{ text }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        }
      }
    });

    const audioBase64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioBase64) {
      const pcmBuffer = Buffer.from(audioBase64, 'base64');
      const wavBuffer = createWavWithFade(pcmBuffer, 24000, 1, 80, 30);
      return res.json({ audio: wavBuffer.toString('base64'), format: 'audio/wav', lang, voice: voiceName });
    }
    res.status(500).json({ error: 'Failed to generate audio' });
  } catch (err) {
    console.error('Error generating greeting TTS:', err);
    res.status(500).json({ error: 'TTS error' });
  }
});

// WebSocket server for Gemini Live native audio streaming
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // Do not destroy non-/api/live sockets so Vite development server remains unaffected
});

wss.on('connection', (clientWs: WebSocket, request: any) => {
  const reqUrl = new URL(request?.url || '', 'http://localhost');
  let currentLanguage: 'fr' | 'en' = reqUrl.searchParams.get('lang') === 'en' ? 'en' : 'fr';
  const requestedVoice = reqUrl.searchParams.get('voice');
  const chosenVoice = requestedVoice === 'Puck' ? 'Puck' : 'Kore';
  console.log(`Client connected to Gemini Live voice bridge (lang: ${currentLanguage}, voice: ${chosenVoice})`);

  let liveSession: any = null;
  let isClosed = false;
  let audioBytesSentThisTurn = 0;
  const messageQueue: any[] = [];

  let currentTurnHasModelResponse = false;

  function handleClientMessage(data: any) {
    if (!liveSession) return;
    try {
      if (data.type === 'set_language' && (data.lang === 'fr' || data.lang === 'en')) {
        currentLanguage = data.lang;
        console.log(`Session language updated to: ${currentLanguage}`);
        return;
      }
      if (data.type === 'audio' && data.data) {
        audioBytesSentThisTurn += data.data.length;
        liveSession.sendRealtimeInput({
          audio: {
            data: data.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } else if (data.type === 'audio_end') {
        currentTurnHasModelResponse = false;
        // Send trailing silence (600ms of zeros) to trigger Gemini Live VAD ACTIVITY_END
        const silence16kChunk = Buffer.alloc(19200).toString('base64');
        try {
          liveSession.sendRealtimeInput({
            audio: {
              data: silence16kChunk,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          // ignore
        }

        // If the user's spoken text was transcribed, provide reliable fallback
        // if model hasn't emitted audio or transcript within 1.1s
        const userText = typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null;
        if (userText) {
          setTimeout(() => {
            if (!currentTurnHasModelResponse && !isClosed) {
              console.log('Gemini Live VAD delayed: sending clientContent fallback turn with text:', userText);
              try {
                liveSession.sendClientContent({
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: userText }],
                    },
                  ],
                  turnComplete: true,
                });
              } catch (err) {
                console.error('Error sending fallback clientContent:', err);
              }
            }
          }, 1100);
        }
        audioBytesSentThisTurn = 0;
      } else if (data.type === 'introduce') {
        const targetLang = data.lang === 'en' || currentLanguage === 'en' ? 'en' : 'fr';
        const greetingPrompt = targetLang === 'en'
          ? "Say in clear, natural North American English at a normal conversational pace: 'Hello and welcome to Automobile Lambert in Laval! I am your virtual advisor. How can I help you find your next vehicle today?'"
          : "Dis d'une voix naturelle, chaleureuse et fluide en français québécois, à un rythme normal : 'Bonjour et bienvenue chez Automobile Lambert à Laval! Je suis votre conseillère virtuelle. Comment puis-je vous aider aujourd'hui?'";
        try {
          liveSession.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: greetingPrompt,
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch (err) {
          console.error('Error sending introduction:', err);
        }
      }
    } catch (err) {
      console.error('Error handling client message:', err);
    }
  }

  // Register client message listener IMMEDIATELY to prevent dropping early messages
  clientWs.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      if (!liveSession) {
        messageQueue.push(data);
      } else {
        handleClientMessage(data);
      }
    } catch (err) {
      console.error('Error parsing client message:', err);
    }
  });

  clientWs.on('close', () => {
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch {
        // ignore
      }
    }
    console.log('Client WebSocket closed');
  });

  // Connect to Gemini Live asynchronously with the selected Kore or Puck voice.
  // Inventory and showroom facts come from the dealer platform for this dealer id.
  void (async () => {
    const dealer = await getDealer();
    const { vehicles } = await getVehicles('');
    return ai.live.connect({
    model: 'gemini-3.8-live',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: chosenVoice },
        },
      },
      systemInstruction: buildVoiceSystemPrompt(dealer, vehicles, currentLanguage),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [
        {
          functionDeclarations: [
            {
              name: 'showVehicles',
              description: 'Affiche les cartes de véhicules de l inventaire au visiteur',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  search: {
                    type: Type.STRING,
                    description: 'Termes de recherche (ex: VUS rouge, AWD, berline blanche)'
                  }
                },
                required: ['search']
              }
            }
          ]
        }
      ]
    },
    callbacks: {
      onmessage: async (message: LiveServerMessage) => {
        if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

        // 1. Check for audio chunks and model text
        const parts = message.serverContent?.modelTurn?.parts;
        if (parts && parts.length > 0) {
          currentTurnHasModelResponse = true;
          for (const part of parts) {
            if (part.inlineData?.data) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                })
              );
            }
            if (part.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'modelTranscript',
                  text: part.text,
                })
              );
            }
          }
        }

        // Model spoken output transcription
        const modelTranscript =
          message.serverContent?.outputTranscription?.text || message.text;
        if (modelTranscript) {
          currentTurnHasModelResponse = true;
          clientWs.send(
            JSON.stringify({
              type: 'modelTranscript',
              text: modelTranscript,
            })
          );
        }

        // User live speech transcription from Gemini Live
        const userTranscription =
          message.serverContent?.interimInputTranscription?.text ||
          message.serverContent?.inputTranscription?.text ||
          (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
        if (userTranscription) {
          clientWs.send(
            JSON.stringify({
              type: 'userTranscript',
              text: userTranscription,
            })
          );
        }

        // Turn complete signal
        if (message.serverContent?.turnComplete) {
          clientWs.send(JSON.stringify({ type: 'turn_complete' }));
        }

        // Interrupted signal
        if (message.serverContent?.interrupted) {
          clientWs.send(JSON.stringify({ type: 'interrupted' }));
        }

        // Tool calls
        if (message.toolCall?.functionCalls) {
          const calls = message.toolCall.functionCalls;
          const toolResponses = [];

          for (const call of calls) {
            if (call.name === 'showVehicles') {
              const searchParam = String((call.args as any)?.search || '');
              const matched = (await getVehicles(searchParam)).vehicles;

              clientWs.send(
                JSON.stringify({
                  type: 'vehicles',
                  vehicles: matched,
                })
              );

              toolResponses.push({
                id: call.id,
                name: call.name,
                response: {
                  results: matched,
                  count: matched.length,
                },
              });
            }
          }

          if (toolResponses.length > 0 && liveSession) {
            try {
              liveSession.sendToolResponse({
                functionResponses: toolResponses,
              });
            } catch (e) {
              console.error('Failed to send tool response to Live session:', e);
            }
          }
        }
      },
      onerror: (err) => {
        console.error('Live session internal error:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              message: 'Live session encountered an error',
            })
          );
        }
      },
      onclose: () => {
        console.log('Live session closed from remote');
      }
    }
  }).then((session) => {
    if (isClosed) {
      session.close();
      return;
    }
    liveSession = session;
    console.log('Connected to Gemini Live session successfully, processing queue of size:', messageQueue.length);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'ready' }));
    }
    // Process all queued messages sent while session was establishing
    while (messageQueue.length > 0) {
      handleClientMessage(messageQueue.shift());
    }
  }).catch((err) => {
    console.error('Failed to establish Gemini Live connection:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Failed to start Live session',
        })
      );
      clientWs.close();
    }
  });
  })().catch((err) => {
    console.error('Failed to prepare Gemini Live inventory:', err);
  });

  clientWs.on('close', () => {
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
    }
    console.log('Client WebSocket closed');
  });
});

// Setup Vite development server or production static files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false, // HMR is disabled in AI Studio runtime environment
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
