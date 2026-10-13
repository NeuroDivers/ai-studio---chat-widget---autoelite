import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3000;
const server = createServer(app);

// Inventory list for tool calls & server queries
const INVENTORY = [
  { id: 1, year: 2022, make: "Honda", model: "CR-V", trim: "EX-L", body_style: "VUS", drivetrain: "AWD", transmission: "automatique", fuel_type: "essence", exterior_color: "rouge", price: 32995, mileage: 41200, stock_number: "L2201", status: "available", photo: "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?auto=format&fit=crop&w=800&q=80", description: "Honda CR-V EX-L 2022 AWD rouge avec toit ouvrant et sièges en cuir chauffants." },
  { id: 2, year: 2021, make: "Toyota", model: "RAV4", trim: "XLE", body_style: "VUS", drivetrain: "AWD", transmission: "automatique", fuel_type: "essence", exterior_color: "noir", price: 29950, mileage: 53800, stock_number: "L2108", status: "available", photo: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80", description: "Toyota RAV4 XLE 2021 AWD noir avec hayon assisté et Toyota Safety Sense." },
  { id: 3, year: 2020, make: "Mazda", model: "CX-5", trim: "GT", body_style: "VUS", drivetrain: "AWD", transmission: "automatique", fuel_type: "essence", exterior_color: "gris", price: 27400, mileage: 62110, stock_number: "L2044", status: "available", photo: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80", description: "Mazda CX-5 GT 2020 AWD gris avec système audio Bose et affichage tête haute." },
  { id: 4, year: 2019, make: "Hyundai", model: "Elantra", trim: "Preferred", body_style: "berline", drivetrain: "FWD", transmission: "automatique", fuel_type: "essence", exterior_color: "blanc", price: 16995, mileage: 80440, stock_number: "L1933", status: "available", photo: "https://images.unsplash.com/photo-1590362891988-f7780470208b?auto=format&fit=crop&w=800&q=80", description: "Hyundai Elantra Preferred 2019 berline blanc FWD très économique." },
  { id: 5, year: 2018, make: "Ford", model: "F-150", trim: "XLT", body_style: "camion", drivetrain: "4x4", transmission: "automatique", fuel_type: "essence", exterior_color: "bleu", price: 28900, mileage: 97300, stock_number: "L1812", status: "available", photo: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=800&q=80", description: "Ford F-150 XLT 2018 SuperCrew 4x4 bleu avec ensemble de remorquage." }
];

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
    const systemInstruction = isEn
      ? `You are the friendly customer sales advisor at Automobile Lambert, a certified car dealership in Laval, Quebec.
Contact: 1250 Curé-Labelle Blvd, Laval, QC. Phone: (450) 555-0199. Hours: 9:00 AM to 6:00 PM Monday through Friday, 10:00 AM to 4:00 PM Saturday.
Respond concisely, politely, and warmly in English. Encourage the customer to test drive a vehicle or visit our showroom.`
      : `Tu es le conseiller d'accueil chaleureux d'Automobile Lambert, un concessionnaire automobile certifié à Laval, Québec.
Coordonnées : 1250 boul. Curé-Labelle, Laval, QC. Téléphone : (450) 555-0199. Heures : 9h00 à 18h00 du lundi au vendredi, 10h00 à 16h00 le samedi.
Réponds brièvement et poliment en français québécois standard. Encourage le client à essayer un véhicule ou à passer nous voir en concession.`;

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

// Helper to wrap raw 16-bit linear PCM into a pristine RIFF WAV with smooth 100ms cosine fade-out and 60ms silence tail
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

  // Apply cosine fade-out on the last fadeOutFrames (50-100ms) to ensure clean termination
  if (numFrames > fadeOutFrames) {
    const startFrame = numFrames - fadeOutFrames;
    for (let f = 0; f < fadeOutFrames; f++) {
      const frameIdx = startFrame + f;
      const gain = 0.5 * (1 + Math.cos((Math.PI * f) / fadeOutFrames));
      for (let ch = 0; ch < numChannels; ch++) {
        const offset = (frameIdx * numChannels + ch) * 2;
        const sampleVal = outPcm.readInt16LE(offset);
        outPcm.writeInt16LE(Math.round(sampleVal * gain), offset);
      }
    }
  }

  // Trailing silence frames are 0, ensuring zero DC offset / no walkie-talkie release pop

  // 44-byte standard RIFF header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + outputPcmLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // 16-bit
  header.write('data', 36);
  header.writeUInt32LE(outputPcmLength, 40);

  return Buffer.concat([header, outPcm]);
}

// High-fidelity spoken greeting introduction audio endpoint (serves studio WAV with 0ms delay)
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

    // Dynamic generation fallback with selected voice
    const text = lang === 'en'
      ? "Hello and welcome to Automobile Lambert in Laval! I'm your virtual advisor. How can I help you find your next vehicle today?"
      : (requestedVoice === 'puck'
          ? "Bonjour et bienvenue chez Automobile Lambert à Laval ! Je suis votre conseiller virtuel. Comment puis-je vous aider aujourd'hui ?"
          : "Bonjour et bienvenue chez Automobile Lambert à Laval ! Je suis votre conseillère virtuelle. Comment puis-je vous aider aujourd'hui ?");

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
      const wavBuffer = createWavWithFade(pcmBuffer, 24000, 1, 100, 60);
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
          ? "Say in clear, natural North American English at a normal conversational pace: 'Hello! I can help you find an available vehicle at Automobile Lambert.'"
          : "Dis d'une voix naturelle, chaleureuse et fluide en français québécois : 'Bonjour! Je peux vous aider à trouver un véhicule disponible chez Automobile Lambert.'";
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

  // Connect to Gemini Live asynchronously with clean Kore voice
  ai.live.connect({
    model: 'gemini-3.8-live',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: chosenVoice },
        },
      },
      systemInstruction: `You are the bilingual (French and English) virtual voice advisor for Automobile Lambert, a certified car dealership in Laval, Quebec.
${chosenVoice === 'Puck' ? "Your persona is Alex, a friendly and knowledgeable automotive sales advisor. In French, refer to yourself as 'conseiller virtuel' (masculine)." : "Your persona is Chloé, a warm and knowledgeable automotive sales advisor. In French, refer to yourself as 'conseillère virtuelle' (feminine)."}
Contact: 1250 boul. Curé-Labelle, Laval, QC. Phone: (450) 555-0199. Hours: 9:00 AM to 6:00 PM Monday through Friday, 10:00 AM to 4:00 PM Saturday.

VOICE, SPEED & ACCENT RULES:
1. When speaking English: Speak with a native, standard North American English accent. NEVER use a fake, exaggerated, or forced French accent. Speak clearly, warmly, and naturally.
2. When speaking French: Speak in clear, fluent, authentic Canadian French (Québec).
3. Speed & Delivery: Speak at a normal, lively conversational pace. Never drag out syllables or speak slowly. Keep spoken answers concise (1 to 2 sentences max) so turns are snappy and responsive.
4. Default preferred language for this session is ${currentLanguage === 'en' ? 'English' : 'French'}. If the user speaks English, answer in English. If the user speaks French, answer in French.

Available inventory:
- 2022 Honda CR-V EX-L, VUS / SUV, AWD, automatique / automatic, essence / gas, rouge / red, 32 995 $ CAD, 41 200 km, stock L2201
- 2021 Toyota RAV4 XLE, VUS / SUV, AWD, automatique / automatic, essence / gas, noir / black, 29 950 $ CAD, 53 800 km, stock L2108
- 2020 Mazda CX-5 GT, VUS / SUV, AWD, automatique / automatic, essence / gas, gris / grey, 27 400 $ CAD, 62 110 km, stock L2044
- 2019 Hyundai Elantra Preferred, berline / sedan, FWD, automatique / automatic, essence / gas, blanc / white, 16 995 $ CAD, 80 440 km, stock L1933
- 2018 Ford F-150 XLT, camion / truck, 4x4, automatique / automatic, essence / gas, bleu / blue, 28 900 $ CAD, 97 300 km, stock L1812

Rules:
1. Never invent vehicles not in this list.
2. If the visitor asks for an SUV/VUS, a color, a budget, or a feature, name the vehicle and call showVehicles with the search query.`,
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
      onmessage: (message: LiveServerMessage) => {
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
              const searchParam = String((call.args as any)?.search || '').toLowerCase();
              const matched = INVENTORY.filter(v => {
                return (
                  v.body_style.toLowerCase().includes(searchParam) ||
                  v.exterior_color.toLowerCase().includes(searchParam) ||
                  v.make.toLowerCase().includes(searchParam) ||
                  v.model.toLowerCase().includes(searchParam) ||
                  v.drivetrain.toLowerCase().includes(searchParam) ||
                  searchParam.includes(v.body_style.toLowerCase()) ||
                  searchParam.includes(v.exterior_color.toLowerCase())
                );
              });

              clientWs.send(
                JSON.stringify({
                  type: 'vehicles',
                  vehicles: matched.length > 0 ? matched : INVENTORY.slice(0, 2),
                })
              );

              toolResponses.push({
                id: call.id,
                name: call.name,
                response: {
                  results: matched.length > 0 ? matched : INVENTORY.slice(0, 2),
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
