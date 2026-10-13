import { INVENTORY_PROTOTYPE, Vehicle } from './types/inventory';

export const DEFAULT_DEALER_ID = 2;
export const AUTOELITE_API_BASE = 'https://api.autoelite.io';

export interface DealerProfile {
  id: number;
  name: string;
  phone: string;
  phoneHref: string;
  email: string;
  addressLine: string;
  hoursSummary: string;
  hoursToday: string;
  about: string;
  primaryColor: string;
  agentName: string;
  agentRole: string;
  websiteUrl: string;
  source: 'autoelite' | 'prototype';
}

export interface InventoryResponse {
  vehicles: Vehicle[];
  count: number;
  dealerId: number;
  source: 'autoelite' | 'prototype';
}

interface ApiVehicle {
  id: number;
  dealer_id?: number;
  make?: string;
  model?: string;
  year?: number;
  trim?: string | null;
  price?: number | null;
  sale_price?: number | null;
  mileage?: number | null;
  vin?: string | null;
  stock_number?: string | null;
  exterior_color?: string | null;
  interior_color?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  body_style?: string | null;
  status?: string | null;
  description?: string | null;
  primary_image_url?: string | null;
  image_count?: number | null;
  images?: Array<ApiVehicleImage | string> | null;
  title?: string | null;
}

interface ApiVehicleImage {
  image_url?: string | null;
  url?: string | null;
  is_primary?: boolean | number | null;
  display_order?: number | null;
}

interface PublicDealer {
  id?: number;
  name?: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  about_text?: string | null;
  primary_color?: string | null;
  website_url?: string | null;
  business_hours_monday?: string | null;
  business_hours_tuesday?: string | null;
  business_hours_wednesday?: string | null;
  business_hours_thursday?: string | null;
  business_hours_friday?: string | null;
  business_hours_saturday?: string | null;
  business_hours_sunday?: string | null;
}

interface WidgetConfig {
  agent_name?: string | null;
  agent_role?: string | null;
  primary_color?: string | null;
  branding_primary_color?: string | null;
  greeting_message?: string | null;
}

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const PROTOTYPE_DEALER: DealerProfile = {
  id: DEFAULT_DEALER_ID,
  name: 'Automobile Lambert',
  phone: '(450) 555-0199',
  phoneHref: 'tel:4505550199',
  email: '',
  addressLine: '1250 boul. Curé-Labelle, Laval, QC H7V 2V5',
  hoursSummary: 'Lun–Ven 9h00–18h00 · Sam 10h00–16h00',
  hoursToday: '9h00 - 18h00',
  about: "Inventaire d'essai. Les fiches réelles du concessionnaire se chargent depuis la plateforme.",
  primaryColor: '#991b1e',
  agentName: 'Sophie',
  agentRole: 'Conseillère Automobile',
  websiteUrl: 'https://automobile-lambert.com',
  source: 'prototype',
};

function clean(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || text.toLowerCase() === 'none' || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') {
    return '';
  }
  return text;
}

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function canonicalBody(raw: string): string {
  const value = raw.toLowerCase();
  if (!value) return 'autre';
  if (/suv|vus|crossover|multipurpose|multi-purpose|utility/.test(value)) return 'vus';
  if (/sedan|berline|saloon/.test(value)) return 'berline';
  if (/truck|pickup|camion/.test(value)) return 'camion';
  if (/van|fourgon|minivan/.test(value)) return 'fourgonnette';
  if (/hatch/.test(value)) return 'hayon';
  if (/coupe|coupé/.test(value)) return 'coupe';
  if (/wagon|familiale/.test(value)) return 'familiale';
  return value.split(/[/(]/)[0].trim() || 'autre';
}

function bodyLabel(canonical: string): string {
  switch (canonical) {
    case 'vus':
      return 'VUS';
    case 'berline':
      return 'Berline';
    case 'camion':
      return 'Camion';
    case 'fourgonnette':
      return 'Fourgonnette';
    case 'hayon':
      return 'Hayon';
    case 'coupe':
      return 'Coupé';
    case 'familiale':
      return 'Familiale';
    default:
      return canonical ? canonical.charAt(0).toUpperCase() + canonical.slice(1) : 'Véhicule';
  }
}

const COLOR_FR: Record<string, string> = {
  red: 'rouge',
  black: 'noir',
  white: 'blanc',
  blue: 'bleu',
  gray: 'gris',
  grey: 'gris',
  silver: 'argent',
  green: 'vert',
  brown: 'brun',
  beige: 'beige',
  orange: 'orange',
  gold: 'or',
  yellow: 'jaune',
};

function displayColor(raw: string): string {
  const key = raw.toLowerCase();
  return COLOR_FR[key] || raw.toLowerCase();
}

function shortDrivetrain(raw: string): string {
  const value = raw.toLowerCase();
  if (!value) return '';
  if (value.includes('awd') || value.includes('all-wheel') || value.includes('intégrale') || value.includes('integrale')) return 'AWD';
  if (value.includes('4x4') || value.includes('4wd') || value.includes('4-wheel')) return '4x4';
  if (value.includes('fwd') || value.includes('front-wheel') || value.includes('avant')) return 'FWD';
  if (value.includes('rwd') || value.includes('rear-wheel') || value.includes('propulsion')) return 'RWD';
  return raw.split('/')[0].trim();
}

function displayTransmission(raw: string): string {
  const value = raw.toLowerCase();
  if (!value) return '';
  if (value.includes('cvt') || value.includes('continuously')) return 'CVT';
  if (value.includes('manual') || value.includes('manuelle')) return 'manuelle';
  if (value.includes('automatic') || value.includes('automat')) return 'automatique';
  return raw;
}

function displayFuel(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes('gasoline') || value.includes('essence') || value === 'gas') return 'essence';
  if (value.includes('diesel')) return 'diesel';
  if (value.includes('hybrid') || value.includes('hybride')) return 'hybride';
  if (value.includes('electric') || value.includes('électri') || value.includes('electri')) return 'électrique';
  return raw.toLowerCase();
}

function vehicleStatus(raw: string): Vehicle['status'] {
  const value = raw.toLowerCase();
  if (value === 'draft' || value === 'pending' || value === 'reserved' || value === 'sold' || value === 'archived') {
    return value;
  }
  return 'available';
}

function deliveryImageId(url: string): string {
  const match = url.match(/imagedelivery\.net\/[^/]+\/([^/?#]+)/i);
  return match?.[1] || '';
}

/** imagedelivery `large` is forbidden. `public` is the variant that already loads. */
export function publicDeliveryUrl(raw: string): string {
  const url = clean(raw);
  if (!url) return '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== 'imagedelivery.net') return url;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return url;
  return `${parsed.origin}/${parts[0]}/${parts[1]}/public`;
}

function pushPhoto(urls: string[], seen: Set<string>, raw: string): void {
  const url = publicDeliveryUrl(raw);
  if (!url) return;
  const key = deliveryImageId(url) || url;
  if (seen.has(key)) return;
  seen.add(key);
  urls.push(url);
}

export function collectPhotoUrls(row: ApiVehicle): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const images = Array.isArray(row.images) ? [...row.images] : [];
  images.sort((a, b) => {
    const order = (image: ApiVehicleImage | string) =>
      typeof image === 'string' ? 0 : Number(image?.display_order ?? 0);
    return order(a) - order(b);
  });
  for (const image of images) {
    if (typeof image === 'string') pushPhoto(urls, seen, image);
    else if (image) pushPhoto(urls, seen, image.image_url || image.url || '');
  }
  pushPhoto(urls, seen, row.primary_image_url || '');
  return urls;
}

export function galleryPhotos(vehicle: Pick<Vehicle, 'photo' | 'photos'>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const photo of vehicle.photos || []) pushPhoto(urls, seen, photo);
  if (!urls.length) pushPhoto(urls, seen, vehicle.photo);
  return urls;
}

export function mapApiVehicle(row: ApiVehicle): Vehicle | null {
  const status = vehicleStatus(clean(row.status) || 'available');
  if (status !== 'available') return null;
  const body = canonicalBody(clean(row.body_style));
  const price = Number(row.sale_price || row.price || 0);
  const photos = collectPhotoUrls(row);
  const reportedCount = Number(row.image_count);
  return {
    id: Number(row.id),
    dealer_id: row.dealer_id ? Number(row.dealer_id) : undefined,
    year: Number(row.year || 0),
    make: clean(row.make),
    model: clean(row.model),
    trim: clean(row.trim),
    body_style: body,
    body_label: bodyLabel(body),
    drivetrain: shortDrivetrain(clean(row.drivetrain)),
    transmission: displayTransmission(clean(row.transmission)),
    fuel_type: displayFuel(clean(row.fuel_type)),
    exterior_color: displayColor(clean(row.exterior_color)),
    price,
    mileage: Number(row.mileage || 0),
    stock_number: clean(row.stock_number),
    vin: clean(row.vin),
    status,
    photo: clean(row.primary_image_url) || photos[0] || '',
    photos,
    imageCount: Number.isFinite(reportedCount) && reportedCount > 0 ? reportedCount : photos.length,
    description: clean(row.description),
    title: clean(row.title),
    engine: clean(row.engine),
  };
}

export function mapPrototypeVehicle(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    body_label: bodyLabel(canonicalBody(vehicle.body_style)),
    body_style: canonicalBody(vehicle.body_style),
  };
}

function hourValue(dealer: PublicDealer, day: (typeof DAY_KEYS)[number]): string {
  const value = dealer[`business_hours_${day}` as keyof PublicDealer];
  return clean(value) || '—';
}

export function profileFromApi(dealer: PublicDealer, widget: WidgetConfig, dealerId: number): DealerProfile {
  const phone = clean(dealer.contact_phone);
  const weekday = hourValue(dealer, 'monday');
  const saturday = hourValue(dealer, 'saturday');
  const sunday = hourValue(dealer, 'sunday');
  const todayKey = DAY_KEYS[new Date().getDay()];
  const address = [clean(dealer.address), clean(dealer.city), [clean(dealer.state), clean(dealer.postal_code)].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return {
    id: Number(dealer.id || dealerId),
    name: clean(dealer.name) || 'Automobile Lambert',
    phone,
    phoneHref: phone ? `tel:${digitsOnly(phone)}` : '',
    email: clean(dealer.contact_email),
    addressLine: address,
    hoursSummary: `Lun–Ven ${weekday} · Sam ${saturday} · Dim ${sunday}`,
    hoursToday: hourValue(dealer, todayKey),
    about: clean(dealer.about_text),
    primaryColor: clean(widget.branding_primary_color) || clean(widget.primary_color) || clean(dealer.primary_color) || '#991b1e',
    agentName: clean(widget.agent_name) || 'Sophie',
    agentRole: clean(widget.agent_role) || 'Conseillère Automobile',
    websiteUrl: clean(dealer.website_url) || 'https://automobile-lambert.com',
    source: 'autoelite',
  };
}

export function stockLabel(vehicle: Vehicle): string {
  if (vehicle.stock_number) return `#${vehicle.stock_number}`;
  if (vehicle.vin) return `VIN …${vehicle.vin.slice(-6)}`;
  return `ID ${vehicle.id}`;
}

export interface ParsedVehicleQuery {
  search: string;
  maxPrice?: number;
  minPrice?: number;
}

function parseAmount(raw: string, suffix?: string): number {
  const amount = parseInt(raw.replace(/[^\d]/g, ''), 10);
  if (!Number.isFinite(amount)) return NaN;
  if (suffix && suffix.toLowerCase() === 'k') return amount * 1000;
  if (amount < 1000) return amount * 1000;
  return amount;
}

const SEARCH_STEMS = [
  'volkswagen', 'honda', 'toyota', 'mazda', 'hyundai', 'ford', 'kia', 'nissan',
  'chevrolet', 'subaru', 'bmw', 'mercedes', 'audi', 'jeep', 'gmc', 'dodge', 'ram',
  'acura', 'lexus', 'infiniti', 'volvo', 'porsche', 'buick', 'cadillac', 'chrysler',
  'lincoln', 'genesis', 'tesla', 'mitsubishi', 'fiat', 'mini',
  'tiguan', 'jetta', 'golf', 'passat', 'atlas', 'taos', 'beetle', 'kona', 'tucson',
  'elantra', 'civic', 'accord', 'odyssey', 'corolla', 'camry', 'rav4', 'sentra', 'rogue',
  'suv', 'vus', 'berline', 'sedan', 'camion', 'truck', 'rouge', 'red', 'noir', 'black',
  'blanc', 'white', 'bleu', 'blue', 'gris', 'gray', 'grey', 'argent', 'silver', 'vert', 'green',
  'awd', 'fwd', 'rwd',
];

const SEARCH_ALIASES: Record<string, string> = {
  vw: 'volkswagen',
  vws: 'volkswagen',
  volkswagon: 'volkswagen',
  volkswagons: 'volkswagen',
  chevy: 'chevrolet',
  chevys: 'chevrolet',
  benz: 'mercedes',
  'mercedes-benz': 'mercedes',
};

const SEARCH_STEM_SET = new Set(SEARCH_STEMS);

function foldSearchToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function canonicalSearchToken(token: string): string {
  const key = foldSearchToken(token);
  if (SEARCH_ALIASES[key]) return SEARCH_ALIASES[key];
  if (SEARCH_STEM_SET.has(key)) return key;
  if (key.endsWith('s') && SEARCH_STEM_SET.has(key.slice(0, -1))) return key.slice(0, -1);
  if (key.endsWith('es') && SEARCH_STEM_SET.has(key.slice(0, -2))) return key.slice(0, -2);
  return token;
}

const INVENTORY_PHRASE =
  /\b(?:do you have any|do you have|have you got any|have you got|got any|are there any|is there any|looking for|show me|i am looking for|can you show|est-ce que vous avez|avez-vous|avez vous|vous avez|je cherche|je recherche|je voudrais|je veux)\b/gi;

const INVENTORY_FILLER =
  /\b(?:any|some|please|svp|des|du|un|une|the|a|an|me|of)\b/gi;

function canonicalizeSearchText(text: string): string {
  let remaining = text.replace(/[’']/g, "'").replace(/\bi'm\b/gi, 'i am');
  remaining = remaining.replace(/[?!.,;:]+/g, ' ');
  remaining = remaining.replace(INVENTORY_PHRASE, ' ');
  remaining = remaining.replace(INVENTORY_FILLER, ' ');
  remaining = remaining.replace(/\s+/g, ' ').trim();
  if (!remaining) return '';
  return remaining.split(' ').map((token) => canonicalSearchToken(token)).join(' ');
}

export function canonicalBrandLabel(query: string): string | null {
  const normalized = foldSearchToken(query).replace(/[’']/g, "'");
  const aliases = [...SEARCH_STEMS, ...Object.keys(SEARCH_ALIASES)].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (!/volkswagen|honda|toyota|mazda|hyundai|ford|kia|nissan|chevrolet|subaru|bmw|mercedes|audi|jeep|gmc|dodge|ram|acura|lexus|infiniti|volvo|porsche|buick|cadillac|chrysler|lincoln|genesis|tesla|mitsubishi|fiat|mini|vw|chevy|benz/.test(alias)) {
      continue;
    }
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}s?\\b`, 'i').test(normalized)) {
      const canonical = SEARCH_ALIASES[alias] || (SEARCH_STEM_SET.has(alias) ? alias : alias);
      const label = SEARCH_ALIASES[canonical] || canonical;
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
  }
  return null;
}

export function parseVehicleQuery(searchText: string): ParsedVehicleQuery {
  let remaining = searchText.trim();
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const maxMatch = remaining.match(
    /(?:moins de|under|below|max(?:imum)?|budget(?: de)?|jusqu['’]?(?:à|a)|<|up to)\s*\$?\s*([\d][\d\s\u00a0]*)\s*(k)?/i,
  );
  if (maxMatch) {
    const amount = parseAmount(maxMatch[1], maxMatch[2]);
    if (Number.isFinite(amount)) maxPrice = amount;
    remaining = remaining.replace(maxMatch[0], ' ');
  }

  const minMatch = remaining.match(/(?:plus de|over|above|min(?:imum)?|>|at least)\s*\$?\s*([\d][\d\s\u00a0]*)\s*(k)?/i);
  if (minMatch) {
    const amount = parseAmount(minMatch[1], minMatch[2]);
    if (Number.isFinite(amount)) minPrice = amount;
    remaining = remaining.replace(minMatch[0], ' ');
  }

  remaining = remaining
    .replace(/\$|cad|dollars?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  remaining = canonicalizeSearchText(remaining);

  const stopOnly = /^(le|la|les|un|une|des|vehicule|véhicule|vehicules|voiture|voitures|auto|autos|car|cars|vehicle|vehicles|inventory|inventaire|disponible|disponibles)?$/i;
  return {
    search: stopOnly.test(remaining) ? '' : remaining,
    maxPrice,
    minPrice,
  };
}

export function vehiclesFromApiPayload(payload: { vehicles?: ApiVehicle[] } | ApiVehicle[]): Vehicle[] {
  const rows = Array.isArray(payload) ? payload : payload.vehicles || [];
  return rows.map(mapApiVehicle).filter((vehicle): vehicle is Vehicle => Boolean(vehicle));
}

export function prototypeInventory(searchText = ''): Vehicle[] {
  const available = INVENTORY_PROTOTYPE.filter((vehicle) => vehicle.status === 'available').map(mapPrototypeVehicle);
  const parsed = parseVehicleQuery(searchText);
  return available.filter((vehicle) => {
    if (parsed.maxPrice !== undefined && vehicle.price > parsed.maxPrice) return false;
    if (parsed.minPrice !== undefined && vehicle.price < parsed.minPrice) return false;
    if (!parsed.search) return true;
    const haystack = [
      vehicle.year,
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      vehicle.body_style,
      vehicle.body_label,
      vehicle.drivetrain,
      vehicle.exterior_color,
      vehicle.transmission,
      vehicle.fuel_type,
    ]
      .join(' ')
      .toLowerCase();
    return parsed.search
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 1)
      .every((word) => haystack.includes(word));
  });
}

export function formatInventoryLines(vehicles: Vehicle[]): string {
  if (vehicles.length === 0) return 'No available vehicles.';
  return vehicles
    .map((vehicle) => {
      const name = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
      return `- ${name} | ${vehicle.body_label || vehicle.body_style} | ${vehicle.exterior_color} | ${vehicle.drivetrain || 'drivetrain n/d'} | ${vehicle.price.toLocaleString('en-CA')} $ CAD | ${vehicle.mileage.toLocaleString('en-CA')} km | ${stockLabel(vehicle)}`;
    })
    .join('\n');
}

export function buildTextSystemPrompt(dealer: DealerProfile, vehicles: Vehicle[], lang: 'fr' | 'en'): string {
  const inventory = formatInventoryLines(vehicles);
  if (lang === 'en') {
    return `You are ${dealer.agentName}, ${dealer.agentRole} at ${dealer.name}.
Address: ${dealer.addressLine}. Phone: ${dealer.phone}. Email: ${dealer.email || 'n/a'}. Hours: ${dealer.hoursSummary}.
Reply in English, in 1 to 3 short sentences. Never invent vehicles, prices, or appointments.
Available inventory:
${inventory}`;
  }
  return `Tu es ${dealer.agentName}, ${dealer.agentRole} chez ${dealer.name}.
Adresse : ${dealer.addressLine}. Téléphone : ${dealer.phone}. Courriel : ${dealer.email || 'n/d'}. Heures : ${dealer.hoursSummary}.
Réponds en français québécois, en 1 à 3 phrases courtes. N'invente aucun véhicule, prix ou rendez-vous.
Inventaire disponible :
${inventory}`;
}

export function buildVoiceSystemPrompt(dealer: DealerProfile, vehicles: Vehicle[], lang: 'fr' | 'en'): string {
  return `${buildTextSystemPrompt(dealer, vehicles, lang)}

VOICE, SPEED & ACCENT RULES:
1. When speaking English: use a native, standard North American English accent. Do not use a fake, exaggerated, or forced French accent. Speak clearly, warmly, and naturally.
2. When speaking French: use clear, fluent Canadian French from Québec.
3. Speak at a normal conversational pace. Do not drag out syllables. Keep spoken answers to 1 or 2 sentences.
4. Default session language is ${lang === 'en' ? 'English' : 'French'}. If the visitor speaks English, answer in English. If the visitor speaks French, answer in French.
If the visitor asks for a vehicle, a color, a budget, or a feature, name one matching vehicle and call showVehicles with the search query.`;
}

export function localFactualReply(message: string, dealer: DealerProfile, lang: 'fr' | 'en'): string | null {
  const query = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const asksHours = /heure|ouvert|horaire|open|hour|ferme/.test(query);
  const asksAddress = /adresse|address|ou etes|ou suis|where|located|situ/.test(query);
  const asksPhone = /telephone|phone|appeler|call|joindre|numero/.test(query);

  if (!asksHours && !asksAddress && !asksPhone) return null;

  const sentences: string[] = [];
  if (lang === 'en') {
    if (asksAddress) sentences.push(`${dealer.name} is at ${dealer.addressLine}.`);
    if (asksHours) sentences.push(`Today's hours are ${dealer.hoursToday}. Weekly hours: ${dealer.hoursSummary}.`);
    if (asksPhone) sentences.push(`Call ${dealer.phone}.`);
    return sentences.join(' ');
  }

  if (asksAddress) sentences.push(`${dealer.name} est situé au ${dealer.addressLine}.`);
  if (asksHours) sentences.push(`Aujourd'hui : ${dealer.hoursToday}. Horaire : ${dealer.hoursSummary}.`);
  if (asksPhone) sentences.push(`Téléphone : ${dealer.phone}.`);
  return sentences.join(' ');
}

export async function fetchDealerProfile(dealerId: number, apiBase = AUTOELITE_API_BASE): Promise<DealerProfile> {
  const headers = { Accept: 'application/json', 'User-Agent': 'autoelite-lambert-widget' };
  const [dealerRes, widgetRes] = await Promise.all([
    fetch(`${apiBase}/api/public/dealers/${dealerId}`, { headers }),
    fetch(`${apiBase}/api/public/widget-config/${dealerId}`, { headers }),
  ]);
  if (!dealerRes.ok) {
    throw new Error(`Dealer profile ${dealerRes.status}`);
  }
  const dealer = (await dealerRes.json()) as PublicDealer;
  const widget = widgetRes.ok ? ((await widgetRes.json()) as WidgetConfig) : {};
  return profileFromApi(dealer, widget, dealerId);
}

const vehiclePhotoCache = new Map<string, string[]>();

/** The list route omits the images array. The same public vehicle route includes it. */
export async function fetchVehiclePhotos(
  vehicleId: number,
  dealerId = DEFAULT_DEALER_ID,
  apiBase = AUTOELITE_API_BASE,
): Promise<string[]> {
  const key = `${apiBase}:${dealerId}:${vehicleId}`;
  const cached = vehiclePhotoCache.get(key);
  if (cached) return cached;
  const response = await fetch(`${apiBase}/api/ai/dealers/${dealerId}/vehicles/${vehicleId}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'autoelite-lambert-widget' },
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as ApiVehicle & { vehicle?: ApiVehicle };
  const row = Array.isArray(payload.images) || payload.primary_image_url ? payload : payload.vehicle;
  const photos = row ? collectPhotoUrls(row) : [];
  if (photos.length) vehiclePhotoCache.set(key, photos);
  return photos;
}

export async function fetchDealerVehicles(searchText: string, dealerId: number, apiBase = AUTOELITE_API_BASE): Promise<Vehicle[]> {
  const parsed = parseVehicleQuery(searchText);
  const params = new URLSearchParams();
  if (parsed.search) params.set('search', parsed.search);
  if (parsed.maxPrice !== undefined) params.set('maxPrice', String(parsed.maxPrice));
  if (parsed.minPrice !== undefined) params.set('minPrice', String(parsed.minPrice));
  const query = params.toString();
  const response = await fetch(`${apiBase}/api/ai/dealers/${dealerId}/vehicles${query ? `?${query}` : ''}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'autoelite-lambert-widget' },
  });
  if (!response.ok) {
    throw new Error(`Inventory ${response.status}`);
  }
  const payload = (await response.json()) as { vehicles?: ApiVehicle[] };
  return vehiclesFromApiPayload(payload).filter((vehicle) => !vehicle.dealer_id || vehicle.dealer_id === dealerId);
}
