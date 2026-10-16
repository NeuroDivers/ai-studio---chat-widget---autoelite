import {
  inventoryReplyText,
  loadVehicles,
  mergeInventoryReply,
  preloadDealerInventory,
  resetDealerInventoryForTests,
} from './portalApi';
import { Vehicle } from './types/inventory';

function assert(condition: unknown, label: string): void {
  if (!condition) throw new Error(label);
}

function honda(): Vehicle {
  return {
    id: 42,
    year: 2016,
    make: 'Honda',
    model: 'CR-V',
    trim: 'EX',
    body_style: 'vus',
    drivetrain: 'AWD',
    transmission: 'automatique',
    fuel_type: 'essence',
    exterior_color: 'gris',
    price: 18000,
    mileage: 90000,
    stock_number: '42',
    status: 'available',
    photo: '',
  };
}

function jsonVehicles(vehicles: Vehicle[]): Response {
  return new Response(JSON.stringify({ vehicles, count: vehicles.length, dealerId: 2 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function answerText(query: string, vehicles: Vehicle[]): string {
  const text = inventoryReplyText(query, vehicles.length, 'en', vehicles);
  const names = vehicles.map((vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`).join(', ');
  return `${text} ${names}`.trim();
}

function assertHondaAnswer(query: string, vehicles: Vehicle[], label: string): void {
  const text = inventoryReplyText(query, vehicles.length, 'en', vehicles);
  const shown = answerText(query, vehicles);
  if (/don't see any|ne vois aucun|No available vehicles match/i.test(text)) {
    throw new Error(`${label}: answered with no results (${text})`);
  }
  assert(shown.includes('Honda'), `${label}: answer did not include the Honda (${shown})`);
  assert(vehicles.some((vehicle) => vehicle.make === 'Honda' && vehicle.model === 'CR-V'), `${label}: Honda CR-V missing`);
}

const question = 'do you have any Hondas?';
const originalFetch = globalThis.fetch;

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

try {
  resetDealerInventoryForTests();
  const preload = deferred<Response>();
  let searchCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = await preload.promise;
    if (!url.includes('search=')) return response.clone();
    searchCalls += 1;
    return response.clone();
  }) as typeof fetch;

  preloadDealerInventory();
  let settled = false;
  const pending = loadVehicles(question).then((vehicles) => {
    settled = true;
    return vehicles;
  });
  await flush();
  assert(!settled, 'brand question answered while the preload was still pending');
  preload.resolve(jsonVehicles([honda()]));
  const waited = await pending;
  assertHondaAnswer(question, waited, 'pending preload');
  assert(searchCalls === 0, 'pending preload should filter the Honda instead of searching early');

  resetDealerInventoryForTests();
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (!url.includes('search=')) throw new Error('preload failed');
    return jsonVehicles([honda()]);
  }) as typeof fetch;
  preloadDealerInventory();
  const recovered = await loadVehicles(question);
  assertHondaAnswer(question, recovered, 'preload rejected');
  assert(
    calls.some((url) => url.includes('search=honda')),
    `network search was not ?search=honda (${calls.join(' | ')})`,
  );

  resetDealerInventoryForTests();
  const emptyCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    emptyCalls.push(url);
    if (!url.includes('search=')) return jsonVehicles([]);
    return jsonVehicles([honda()]);
  }) as typeof fetch;
  preloadDealerInventory();
  const afterEmpty = await loadVehicles(question);
  assertHondaAnswer(question, afterEmpty, 'empty preload');
  assert(
    emptyCalls.some((url) => url.includes('search=honda')),
    `empty cache answered without ?search=honda (${emptyCalls.join(' | ')})`,
  );

  const shown = { text: 'Here are the 3 available vehicles matching your search:', vehicles: [honda()] };
  const none = { text: "I don't see any Honda in the current inventory.", vehicles: [] as Vehicle[] };
  const kept = mergeInventoryReply(shown, none);
  assert(kept === shown, 'slower empty reply overwrote the Honda reply');
  const upgraded = mergeInventoryReply(none, shown);
  assert(upgraded.vehicles?.some((vehicle) => vehicle.make === 'Honda'), 'successful reply did not replace an empty one');

  console.log('inventory preload race: ok');
  console.log(JSON.stringify({
    pending: answerText(question, waited),
    rejected: answerText(question, recovered),
    emptyCache: answerText(question, afterEmpty),
    search: calls.find((url) => url.includes('search=')),
  }));
} finally {
  globalThis.fetch = originalFetch;
  resetDealerInventoryForTests();
}
