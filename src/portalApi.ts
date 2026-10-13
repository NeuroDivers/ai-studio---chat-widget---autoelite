import {
  AUTOELITE_API_BASE,
  DEFAULT_DEALER_ID,
  DealerProfile,
  InventoryResponse,
  PROTOTYPE_DEALER,
  fetchDealerProfile,
  canonicalBrandLabel,
  fetchDealerVehicles,
  localFactualReply,
  prototypeInventory,
} from './dealerPlatform';
import { Vehicle } from './types/inventory';

export interface LiveVoiceSessionCallbacks {
  onAudioChunk?: (pcmBase64: string) => void;
  onUserTranscript?: (transcript: string) => void;
  onModelTranscript?: (transcript: string) => void;
  onVehiclesFound?: (vehicles: Vehicle[]) => void;
  onInterrupted?: () => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
  onReady?: () => void;
  onTurnComplete?: () => void;
}

export interface LiveVoiceSession {
  sendAudio: (pcm16Base64: string) => void;
  stopAudio: (textTranscript?: string) => void;
  introduce: (lang?: 'fr' | 'en') => void;
  setLanguage: (lang: 'fr' | 'en') => void;
  close: () => void;
}

// Normalize text for search comparison (lowercase, trim, strip accents for comparison)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Checks whether a given message represents a vehicle search query
 * that should be answered from inventory without sending to Gemini.
 */
function isShowroomFactQuestion(normalized: string): boolean {
  const asksHours = /heure|ouvert|horaire|open|hour|ferme/.test(normalized);
  const asksAddress = /adresse|address|ou etes|ou suis|where|located|situ/.test(normalized);
  const asksPhone = /telephone|phone|appeler|call|joindre|numero/.test(normalized);
  return asksHours || asksAddress || asksPhone;
}

export function isVehicleSearchQuery(query: string): boolean {
  if (!query || !query.trim()) return false;
  const normalized = normalizeText(query);

  if (canonicalBrandLabel(query)) return true;

  const vehicleKeywords = [
    'vus', 'suv', 'utilitaire', 'crossover', 'berline', 'sedan', 'camion', 'truck',
    'auto', 'voiture', 'vehicule', 'char', 'car', 'inventory', 'inventaire',
    'honda', 'toyota', 'mazda', 'hyundai', 'ford', 'kia', 'nissan', 'chevrolet', 'chevy',
    'subaru', 'bmw', 'mercedes', 'audi', 'jeep', 'gmc', 'dodge', 'ram', 'acura', 'lexus',
    'infiniti', 'volvo', 'porsche', 'buick', 'cadillac', 'chrysler', 'lincoln', 'genesis',
    'tesla', 'mitsubishi', 'fiat', 'mini', 'volkswagen', 'vw',
    'cr-v', 'crv', 'rav4', 'cx-5', 'cx5', 'elantra', 'f-150', 'f150', 'tiguan', 'jetta',
    'golf', 'passat', 'atlas', 'kona', 'civic', 'accord', 'corolla', 'camry',
    'awd', '4x4', 'fwd', 'rwd', 'traction', 'integrale', 'propulsion',
    'automatique', 'manuelle',
    'essence', 'diesel', 'hybride', 'electrique',
    'rouge', 'noir', 'blanc', 'gris', 'bleu', 'red', 'black', 'white', 'grey', 'gray', 'blue',
    'cherche', 'recherche', 'trouve', 'trouver', 'montre', 'disponible', 'disponibles',
    'budget', 'prix', 'combien', 'moins de', 'under'
  ];

  const keywordHit = vehicleKeywords.some(keyword => {
    const normKeyword = normalizeText(keyword);
    const body = normKeyword.replace('-', '[- ]?');
    const pattern = body.includes(' ') ? body : `${body}s?`;
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    return regex.test(normalized);
  });
  if (keywordHit) return true;
  if (isShowroomFactQuestion(normalized)) return false;

  const inventoryPhrases = [
    'do you have any', 'have any', 'got any', 'looking for', 'show me', 'in stock',
    'avez-vous', 'avez vous', 'vous avez', 'je cherche', 'je veux',
  ];
  return inventoryPhrases.some((phrase) => normalized.includes(normalizeText(phrase)));
}

/** Spoken and on-screen sentence when a search is too long to read vehicle by vehicle. */
export function inventorySummary(count: number, lang: 'fr' | 'en'): string {
  if (lang === 'en') {
    return `I found ${count} vehicles. You can narrow this by year, price range, or model.`;
  }
  return `J'ai trouvé ${count} véhicules. Vous pouvez affiner la recherche par année, fourchette de prix ou modèle.`;
}

export function inventoryReplyText(query: string, count: number, lang: 'fr' | 'en'): string {
  if (count > 3) return inventorySummary(count, lang);
  if (count === 1) {
    return lang === 'en'
      ? 'Here is the available vehicle matching your search:'
      : 'Voici le véhicule disponible correspondant à votre recherche :';
  }
  if (count > 1) {
    return lang === 'en'
      ? `Here are the ${count} available vehicles matching your search:`
      : `Voici les ${count} véhicules disponibles correspondant à votre recherche :`;
  }
  const brand = canonicalBrandLabel(query);
  if (brand) {
    return lang === 'en'
      ? `I don't see any ${brand} in the current inventory.`
      : `Je ne vois aucun ${brand} dans l'inventaire actuel.`;
  }
  return lang === 'en'
    ? 'No available vehicles match your search. Would you like to explore another vehicle type such as an SUV, sedan, or truck?'
    : 'Aucun véhicule disponible ne correspond à votre recherche. Souhaitez-vous explorer un autre type de véhicule comme un VUS, une berline ou un camion ?';
}

/**
 * Loads Automobile Lambert (dealer 2 by default) from the dealer platform.
 * The server calls GET /api/ai/dealers/:id/vehicles and returns only those rows.
 * The local prototype list is used only when that platform call fails.
 */
export const directPlatform = import.meta.env.VITE_DIRECT_PLATFORM === 'true';

export async function loadInventory(searchText: string): Promise<InventoryResponse> {
  try {
    if (directPlatform) {
      const vehicles = await fetchDealerVehicles(searchText, DEFAULT_DEALER_ID);
      return { vehicles, count: vehicles.length, dealerId: DEFAULT_DEALER_ID, source: 'autoelite' };
    }
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('search', searchText.trim());
    const response = await fetch(`/api/platform/vehicles${params.size ? `?${params}` : ''}`);
    if (!response.ok) throw new Error(`Inventory ${response.status}`);
    const payload = (await response.json()) as InventoryResponse;
    if (!Array.isArray(payload.vehicles)) throw new Error('Inventory payload missing vehicles');
    return payload;
  } catch (error) {
    if (directPlatform) {
      console.warn('Dealer inventory unavailable', error);
      return { vehicles: [], count: 0, dealerId: DEFAULT_DEALER_ID, source: 'autoelite' };
    }
    console.warn('Dealer inventory unavailable, using prototype list', error);
    const vehicles = prototypeInventory(searchText);
    return { vehicles, count: vehicles.length, dealerId: PROTOTYPE_DEALER.id, source: 'prototype' };
  }
}

export async function loadVehicles(searchText: string): Promise<Vehicle[]> {
  const inventory = await loadInventory(searchText);
  return inventory.vehicles;
}

export async function loadDealerContext(): Promise<DealerProfile> {
  try {
    if (directPlatform) return await fetchDealerProfile(DEFAULT_DEALER_ID);
    const response = await fetch('/api/platform/context');
    if (!response.ok) throw new Error(`Dealer context ${response.status}`);
    const payload = (await response.json()) as { dealer?: DealerProfile };
    if (!payload.dealer?.name) throw new Error('Dealer context missing profile');
    return payload.dealer;
  } catch (error) {
    if (directPlatform) throw error;
    console.warn('Dealer profile unavailable, using prototype profile', error);
    return PROTOTYPE_DEALER;
  }
}

function advisorFallback(dealer: DealerProfile, lang: 'fr' | 'en'): string {
  return lang === 'en'
    ? `${dealer.agentName} can help you search the inventory at ${dealer.name}. Call ${dealer.phone} or visit ${dealer.addressLine}.`
    : `${dealer.agentName} peut vous aider à chercher dans l'inventaire de ${dealer.name}. Appelez au ${dealer.phone} ou passez au ${dealer.addressLine}.`;
}

function isRawProxyError(text: string): boolean {
  return /\b403\b|unauthorized|bot verification|turnstile|security check/i.test(text);
}

async function inventoryFallbackText(message: string, lang: 'fr' | 'en'): Promise<string | null> {
  try {
    const vehicles = await loadVehicles(message);
    if (vehicles.length > 0 || isVehicleSearchQuery(message)) {
      return inventoryReplyText(message, vehicles.length, lang);
    }
  } catch (error) {
    console.warn('Inventory fallback failed', error);
  }
  return null;
}

function localAssistReply(dealer: DealerProfile, lang: 'fr' | 'en'): string {
  return lang === 'en'
    ? `I can search the inventory at ${dealer.name}, or share the hours, address, and phone.`
    : `Je peux chercher dans l'inventaire de ${dealer.name}, ou vous donner les heures, l'adresse et le téléphone.`;
}

export async function answerDealer(message: string, lang: 'fr' | 'en'): Promise<string> {
  const dealer = await loadDealerContext();
  const factual = localFactualReply(message, dealer, lang);
  if (directPlatform && factual) return factual;

  if (directPlatform && isVehicleSearchQuery(message)) {
    const vehicles = await loadVehicles(message);
    return inventoryReplyText(message, vehicles.length, lang);
  }

  try {
    if (directPlatform) {
      const response = await fetch(`${AUTOELITE_API_BASE}/api/ai-proxy/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerId: DEFAULT_DEALER_ID, message, history: [], language: lang }),
      });
      const data = (await response.json().catch(() => ({}))) as { reply?: string; text?: string };
      const text = (data.reply || data.text || '').trim();
      if (response.ok && text && !isRawProxyError(text)) return text;
      return factual || (await inventoryFallbackText(message, lang)) || localAssistReply(dealer, lang);
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, lang }),
    });
    const data = (await response.json().catch(() => ({}))) as { text?: string };
    if (data.text) return data.text;
  } catch (error) {
    console.warn('Advisor reply failed', error);
    if (directPlatform) {
      return factual || (await inventoryFallbackText(message, lang)) || localAssistReply(dealer, lang);
    }
  }

  return factual || advisorFallback(dealer, lang);
}

/**
 * Portal Hook: Live session token & connection
 *
 * The dealer site mints a short-lived Gemini Live token with:
 * POST https://api.autoelite.io/api/ai-proxy/gemini-live?ephemeral=1
 * body: { "dealerId": 2, "useEphemeral": true }
 * That route expects the dealer's Turnstile token in body.turnstileToken.
 * Mic replies redeem a token there and speak with Kore or Puck. The Studio
 * server keeps a local /api/live bridge. The live dealer embed must not open
 * wss://automobile-lambert.com/api/live, and a failed handshake must not reconnect.
 */
export async function startVoiceSession(
  callbacks: LiveVoiceSessionCallbacks,
  language: 'fr' | 'en' = 'fr',
  voice: 'Kore' | 'Puck' = 'Kore'
): Promise<LiveVoiceSession> {
  if (directPlatform) {
    return Promise.reject(new Error('Voice bridge unavailable'));
  }
  return openStudioVoiceSocket(callbacks, language, voice);
}

function openStudioVoiceSocket(
  callbacks: LiveVoiceSessionCallbacks,
  language: 'fr' | 'en',
  voice: 'Kore' | 'Puck'
): Promise<LiveVoiceSession> {
  return new Promise((resolve, reject) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live?lang=${language}&voice=${voice}`;

    let socket: WebSocket;
    let isConnected = false;

    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    let settled = false;
    const fail = (err: Error) => {
      if (settled || isConnected) return;
      settled = true;
      clearTimeout(connectionTimeout);
      callbacks.onError?.(err);
      reject(err);
    };

    const connectionTimeout = setTimeout(() => {
      if (settled || isConnected) return;
      try { socket.close(); } catch { /* already closed */ }
      fail(new Error('Connection timeout to Gemini Live voice service'));
    }, 8000);

    socket.onopen = () => {
      isConnected = true;
      settled = true;
      clearTimeout(connectionTimeout);

      resolve({
        sendAudio: (pcm16Base64: string) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'audio', data: pcm16Base64 }));
          }
        },
        stopAudio: (textTranscript?: string) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'audio_end', text: textTranscript }));
          }
        },
        introduce: (lang?: 'fr' | 'en') => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'introduce', lang: lang || language }));
          }
        },
        setLanguage: (lang: 'fr' | 'en') => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'set_language', lang }));
          }
        },
        close: () => {
          if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
          }
        }
      });
    };

    socket.onerror = () => {
      fail(new Error('WebSocket connection error'));
    };

    socket.onclose = () => {
      callbacks.onClose?.();
      if (!isConnected) fail(new Error('WebSocket connection error'));
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'audio' && msg.data) {
          callbacks.onAudioChunk?.(msg.data);
        } else if (msg.type === 'modelTranscript' && msg.text) {
          callbacks.onModelTranscript?.(msg.text);
        } else if (msg.type === 'userTranscript' && msg.text) {
          callbacks.onUserTranscript?.(msg.text);
        } else if (msg.type === 'interrupted') {
          callbacks.onInterrupted?.();
        } else if (msg.type === 'ready') {
          callbacks.onReady?.();
        } else if (msg.type === 'turn_complete') {
          callbacks.onTurnComplete?.();
        } else if (msg.type === 'vehicles' && Array.isArray(msg.vehicles)) {
          callbacks.onVehiclesFound?.(msg.vehicles);
        } else if (msg.type === 'search_query' && msg.query) {
          // If server detects search intent, execute loadVehicles
          const found = await loadVehicles(msg.query);
          callbacks.onVehiclesFound?.(found);
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message', err);
      }
    };
  });
}
