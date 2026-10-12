import { INVENTORY_PROTOTYPE, Vehicle } from './types/inventory';

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

// Map equivalences across French and English automotive terms
const SYNONYM_MAP: Record<string, string> = {
  // Body styles
  'vus': 'vus',
  'suv': 'vus',
  "suv's": 'vus',
  'suvs': 'vus',
  'utilitaire': 'vus',
  'crossover': 'vus',
  'berline': 'berline',
  'sedan': 'berline',
  'camion': 'camion',
  'truck': 'camion',
  'pickup': 'camion',

  // Drivetrain
  'traction integrale': 'awd',
  'traction intégrale': 'awd',
  'awd': 'awd',
  '4x4': 'awd',
  '4wd': 'awd',
  'propulsion': 'rwd',
  'rwd': 'rwd',
  'traction avant': 'fwd',
  'fwd': 'fwd',

  // Transmission
  'automatique': 'automatique',
  'automatic': 'automatique',
  'auto': 'automatique',
  'manuelle': 'manuelle',
  'manual': 'manuelle',

  // Fuel types
  'essence': 'essence',
  'gas': 'essence',
  'gasoline': 'essence',
  'diesel': 'diesel',
  'hybride': 'hybride',
  'hybrid': 'hybride',
  'electrique': 'electrique',
  'électrique': 'electrique',
  'electric': 'electrique',

  // Colors
  'rouge': 'rouge',
  'red': 'rouge',
  'noir': 'noir',
  'black': 'noir',
  'blanc': 'blanc',
  'white': 'blanc',
  'gris': 'gris',
  'grey': 'gris',
  'gray': 'gris',
  'bleu': 'bleu',
  'blue': 'bleu',
};

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
export function isVehicleSearchQuery(query: string): boolean {
  if (!query || !query.trim()) return false;
  const normalized = normalizeText(query);

  const vehicleKeywords = [
    'vus', 'suv', 'utilitaire', 'crossover', 'berline', 'sedan', 'camion', 'truck',
    'auto', 'voiture', 'vehicule', 'char', 'inventory', 'inventaire',
    'honda', 'toyota', 'mazda', 'hyundai', 'ford',
    'cr-v', 'crv', 'rav4', 'cx-5', 'cx5', 'elantra', 'f-150', 'f150',
    'awd', '4x4', 'fwd', 'rwd', 'traction', 'integrale', 'propulsion',
    'automatique', 'manuelle',
    'essence', 'diesel', 'hybride', 'electrique',
    'rouge', 'noir', 'blanc', 'gris', 'bleu', 'red', 'black', 'white', 'grey', 'gray', 'blue',
    'cherche', 'recherche', 'trouve', 'trouver', 'montre', 'avez-vous', 'disponible', 'disponibles',
    'budget', 'prix', 'combien', 'moins de', 'under'
  ];

  return vehicleKeywords.some(keyword => {
    const normKeyword = normalizeText(keyword);
    // Whole word or boundary match
    const regex = new RegExp(`\\b${normKeyword.replace('-', '[- ]?')}\\b`, 'i');
    return regex.test(normalized);
  });
}

/**
 * Portal Hook: Inventory loading
 * 
 * loadVehicles(searchText) should later call:
 * GET https://api.autoelite.io/api/ai/dealers/2/vehicles?search=SEARCH
 * Only render rows it returns. For this prototype, filter the list instead.
 */
export async function loadVehicles(searchText: string): Promise<Vehicle[]> {
  const query = searchText ? searchText.trim() : '';

  // Only vehicles with status available. Never show draft, pending, reserved, sold, or archived.
  const availableVehicles = INVENTORY_PROTOTYPE.filter(v => v.status === 'available');

  if (!query) {
    return availableVehicles;
  }

  const normalizedQuery = normalizeText(query);
  const words = normalizedQuery.split(/[\s,+/]+/).filter(Boolean);

  // Extract budget or price limit if present (e.g. "moins de 30000", "< 30000", "budget 25000")
  let maxBudget: number | null = null;
  const budgetMatch = normalizedQuery.match(/(?:moins de|<|max|budget de?|budget)\s*(\d+)\s*(?:k|\$|dollars)?/i);
  if (budgetMatch) {
    let amount = parseInt(budgetMatch[1], 10);
    if (amount < 200) amount *= 1000; // e.g. 30k -> 30000
    maxBudget = amount;
  }

  // Identify semantic requirements from query tokens
  const canonicalTargets: string[] = [];

  for (const word of words) {
    // Check known synonym map
    if (SYNONYM_MAP[word]) {
      canonicalTargets.push(SYNONYM_MAP[word]);
    } else {
      // Check multi-word synonyms in raw string
      for (const [key, val] of Object.entries(SYNONYM_MAP)) {
        if (key.includes(' ') && normalizedQuery.includes(key)) {
          if (!canonicalTargets.includes(val)) {
            canonicalTargets.push(val);
          }
        }
      }
      canonicalTargets.push(word);
    }
  }

  // Remove generic stop-words from targets
  const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'avec', 'et', 'de', 'du', 'en', 'pour', 'a', 'au', 'aux', 'mon', 'cherche', 'trouve', 'vehicule', 'voiture', 'auto', 'i', 'a', 'the', 'with', 'and', 'for', 'car', 'in']);
  const filteredTargets = Array.from(new Set(canonicalTargets)).filter(t => !stopWords.has(t) && isNaN(Number(t)));

  return availableVehicles.filter(v => {
    // Check price filter if requested
    if (maxBudget !== null && v.price > maxBudget) {
      return false;
    }

    if (filteredTargets.length === 0) return true;

    // Vehicle attributes normalized
    const vMake = normalizeText(v.make);
    const vModel = normalizeText(v.model).replace('-', '');
    const vTrim = normalizeText(v.trim);
    const vBody = SYNONYM_MAP[normalizeText(v.body_style)] || normalizeText(v.body_style);
    const vDrivetrain = SYNONYM_MAP[normalizeText(v.drivetrain)] || normalizeText(v.drivetrain);
    const vTrans = SYNONYM_MAP[normalizeText(v.transmission)] || normalizeText(v.transmission);
    const vFuel = SYNONYM_MAP[normalizeText(v.fuel_type)] || normalizeText(v.fuel_type);
    const vColor = SYNONYM_MAP[normalizeText(v.exterior_color)] || normalizeText(v.exterior_color);
    const vYear = v.year.toString();
    const vStock = normalizeText(v.stock_number);

    const vehicleTags = [
      vMake,
      vModel,
      vTrim,
      vBody,
      vDrivetrain,
      vTrans,
      vFuel,
      vColor,
      vYear,
      vStock,
    ];

    // Every significant search target must match at least one vehicle attribute
    // E.g., for "VUS rouge", targets include "vus" and "rouge". Both must match.
    return filteredTargets.every(target => {
      const cleanTarget = target.replace('-', '');
      return vehicleTags.some(tag => tag === target || tag === cleanTarget || tag.includes(cleanTarget));
    });
  });
}

/**
 * Portal Hook: Live session token & connection
 * 
 * startVoiceSession() should later call:
 * POST https://api.autoelite.io/api/ai-proxy/gemini-live
 * body: { "useEphemeral": true, "turnstileToken": "<token>" }
 * and then connect Gemini Live with the ephemeral token from that response.
 * 
 * For this prototype, startVoiceSession() uses the AI Studio Gemini key and returns a working Live session.
 * Do not call api.autoelite.io yet.
 */
export async function startVoiceSession(
  callbacks: LiveVoiceSessionCallbacks,
  language: 'fr' | 'en' = 'fr'
): Promise<LiveVoiceSession> {
  return new Promise((resolve, reject) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live?lang=${language}`;

    let socket: WebSocket;
    let isConnected = false;

    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        socket.close();
        reject(new Error('Connection timeout to Gemini Live voice service'));
      }
    }, 8000);

    socket.onopen = () => {
      isConnected = true;
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

    socket.onerror = (evt) => {
      clearTimeout(connectionTimeout);
      const err = new Error('WebSocket connection error');
      callbacks.onError?.(err);
      if (!isConnected) {
        reject(err);
      }
    };

    socket.onclose = () => {
      callbacks.onClose?.();
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
