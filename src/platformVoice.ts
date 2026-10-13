import { AUTOELITE_API_BASE, DEFAULT_DEALER_ID } from './dealerPlatform';

/**
 * Platform voice route. api.autoelite.io has no gemini-3.8-flash-tts HTTP route
 * (those paths are 401 or 404). Spoken replies use the same route as the public
 * widget: POST /api/ai-proxy/gemini-live?ephemeral=1, which siteverifies
 * body.turnstileToken, then returns a single-use ephemeral token.
 * That token speaks the sentence on Gemini Live with voice Kore or Puck.
 * It is not a Gemini API key and is never stored.
 */
export const PLATFORM_VOICE_URL = `${AUTOELITE_API_BASE}/api/ai-proxy/gemini-live?ephemeral=1`;

/** Live model the public widget uses with platform ephemeral tokens. Kore and Puck are prebuilt voices. */
const PLATFORM_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const LIVE_SOCKET_PREFIX = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=';

export function platformVoiceBody(
  turnstileToken: string,
  voice: 'Kore' | 'Puck',
  language: 'fr' | 'en',
): { dealerId: number; useEphemeral: true; turnstileToken: string; voice: 'Kore' | 'Puck'; language: 'fr' | 'en' } {
  return {
    dealerId: DEFAULT_DEALER_ID,
    useEphemeral: true,
    turnstileToken,
    voice,
    language,
  };
}

function liveSocketUrl(ephemeralToken: string): string {
  const token = ephemeralToken.trim();
  if (!token.startsWith('auth_tokens/')) {
    throw new Error('Platform voice token was not ephemeral');
  }
  const url = `${LIVE_SOCKET_PREFIX}${encodeURIComponent(token)}`;
  if (url.includes('automobile-lambert.com/api/live')) {
    throw new Error('Studio live socket is not used');
  }
  return url;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function pcmFromMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null;
  const record = message as {
    serverContent?: { modelTurn?: { parts?: unknown[] } };
    server_content?: { model_turn?: { parts?: unknown[] } };
  };
  const parts = record.serverContent?.modelTurn?.parts || record.server_content?.model_turn?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const inline = (part as { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }).inlineData
      || (part as { inline_data?: { data?: string; mime_type?: string } }).inline_data;
    const data = inline && typeof inline.data === 'string' ? inline.data : '';
    if (data) return data;
  }
  return null;
}

function turnFinished(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const record = message as {
    serverContent?: { turnComplete?: boolean; generationComplete?: boolean };
    server_content?: { turn_complete?: boolean; generation_complete?: boolean };
  };
  return Boolean(
    record.serverContent?.turnComplete
    || record.serverContent?.generationComplete
    || record.server_content?.turn_complete
    || record.server_content?.generation_complete,
  );
}

async function messageText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  return '';
}

function readSentence(text: string, language: 'fr' | 'en', voice: 'Kore' | 'Puck'): string {
  const pace = language === 'en'
    ? 'Read the next message aloud verbatim in North American English.'
    : 'Lis le prochain message à voix haute, mot pour mot, en français québécois.';
  return `${pace} Use the ${voice} voice. Do not add, answer, or translate. ${text}`;
}

async function speakOnLiveSocket(
  ephemeralToken: string,
  text: string,
  language: 'fr' | 'en',
  voice: 'Kore' | 'Puck',
  signal: AbortSignal,
): Promise<string | null> {
  const url = liveSocketUrl(ephemeralToken);
  const socket = new WebSocket(url);
  const chunks: Uint8Array[] = [];

  const closed = new Promise<string | null>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      try { socket.close(); } catch { /* already closed */ }
      resolve(chunks.length ? bytesToBase64(concatBytes(chunks)) : null);
    }, 12000);

    const finish = (audio: string | null) => {
      window.clearTimeout(timer);
      try { socket.close(); } catch { /* already closed */ }
      resolve(audio);
    };

    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      try { socket.close(); } catch { /* already closed */ }
      reject(new Error('Platform voice aborted'));
    }, { once: true });

    socket.onerror = () => {
      /* Close or the timeout settles the attempt. A 403 never reaches the chat bubble. */
    };

    socket.onclose = () => {
      window.clearTimeout(timer);
      resolve(chunks.length ? bytesToBase64(concatBytes(chunks)) : null);
    };

    socket.onopen = () => {
      socket.send(JSON.stringify({
        setup: {
          model: `models/${PLATFORM_LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
          systemInstruction: {
            parts: [{
              text: language === 'en'
                ? 'You are the dealership voice. Speak only the words you are given.'
                : 'Tu es la voix de la concession. Prononce seulement les mots qu’on te donne.',
            }],
          },
        },
      }));
    };

    const handleRaw = (raw: string) => {
      if (!raw) return;
      let message: unknown;
      try { message = JSON.parse(raw); } catch { return; }
      const setupDone = Boolean(
        message && typeof message === 'object' && ('setupComplete' in message || 'setup_complete' in message),
      );
      if (setupDone) {
        socket.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: readSentence(text, language, voice) }] }],
            turnComplete: true,
          },
        }));
        return;
      }
      const piece = pcmFromMessage(message);
      if (piece) {
        try {
          const binary = atob(piece);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          chunks.push(bytes);
        } catch { /* skip a bad chunk */ }
      }
      if (turnFinished(message)) finish(chunks.length ? bytesToBase64(concatBytes(chunks)) : null);
    };

    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handleRaw(event.data);
        return;
      }
      void messageText(event.data).then(handleRaw).catch(() => { /* ignore a single bad frame */ });
    };
  });

  return closed;
}

/**
 * Redeem a Turnstile token at the platform voice route and return PCM base64
 * for AudioPlaybackController. Returns null when verification or speech fails.
 * Does not throw the 403 body back to the chat.
 */
export async function fetchPlatformVoiceAudio(
  text: string,
  language: 'fr' | 'en',
  voice: 'Kore' | 'Puck',
  turnstileToken: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (!turnstileToken || signal.aborted) return null;
  let response: Response;
  try {
    response = await fetch(PLATFORM_VOICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(platformVoiceBody(turnstileToken, voice, language)),
      signal,
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as { apiKey?: unknown; ephemeral?: unknown } | null;
  const apiKey = payload && typeof payload.apiKey === 'string' ? payload.apiKey : '';
  if (!payload || payload.ephemeral !== true || !apiKey.startsWith('auth_tokens/')) return null;
  try {
    return await speakOnLiveSocket(apiKey, text, language, voice, signal);
  } catch {
    return null;
  }
}
