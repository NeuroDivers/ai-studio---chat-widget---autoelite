import { filterCachedVehicles, makesInQuestion, mergeVehiclesById, vehicleSearchPlan } from './dealerPlatform';
import { Vehicle } from './types/inventory';

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function assertDeep(actual: string[], expected: string[], label: string): void {
  const left = actual.join('|');
  const right = expected.join('|');
  if (left !== right) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

const hondaMazda = 'do you have any Hondas and Mazdas?';
assertDeep(makesInQuestion(hondaMazda), ['Honda', 'Mazda'], 'english and');
assertDeep(makesInQuestion('des Honda et des Mazda'), ['Honda', 'Mazda'], 'french et');
assertDeep(makesInQuestion('Honda & Mazda'), ['Honda', 'Mazda'], 'ampersand');
assertDeep(makesInQuestion('do you have any Hondas?'), ['Honda'], 'one make');

const plan = vehicleSearchPlan(hondaMazda);
if (plan.mode !== 'makes') throw new Error('Honda and Mazda should search each make');
assertDeep(plan.terms, ['honda', 'mazda'], 'separate search terms');
if (plan.terms.some((term) => term.includes('and') || term.includes('et'))) {
  throw new Error('combined make phrase was used as a search term');
}
if (vehicleSearchPlan('do you have any Hondas?').mode !== 'single') {
  throw new Error('one make should keep the existing search path');
}

function sample(id: number, make: string, model: string): Vehicle {
  return {
    id,
    year: 2018,
    make,
    model,
    trim: '',
    body_style: 'vus',
    drivetrain: 'AWD',
    transmission: 'automatique',
    fuel_type: 'essence',
    exterior_color: 'blanc',
    price: 20000,
    mileage: 1000,
    stock_number: String(id),
    status: 'available',
    photo: '',
  };
}

const stock = [
  sample(1, 'Honda', 'CR-V'),
  sample(2, 'Honda', 'Odyssey'),
  sample(3, 'Mazda', 'CX-9'),
  sample(4, 'Toyota', 'RAV4'),
  sample(1, 'Honda', 'CR-V'),
];

const matched = filterCachedVehicles(stock, hondaMazda);
assertDeep(
  matched.map((vehicle) => `${vehicle.id}:${vehicle.make}`),
  ['1:Honda', '2:Honda', '3:Mazda'],
  'merged honda and mazda',
);
const french = filterCachedVehicles(stock, 'des Honda et des Mazda');
if (!french.some((vehicle) => vehicle.make === 'Mazda') || !french.some((vehicle) => vehicle.make === 'Honda')) {
  throw new Error('french phrase missed a make');
}
const deduped = mergeVehiclesById([[stock[0]], [stock[4], stock[2]]]);
assertDeep(deduped.map((vehicle) => String(vehicle.id)), ['1', '3'], 'dedupe by id');

console.log('multi-make search: ok');
console.log(JSON.stringify({
  phrase: hondaMazda,
  makes: makesInQuestion(hondaMazda),
  terms: plan.mode === 'makes' ? plan.terms : [],
  matched: matched.map((vehicle) => `${vehicle.make} ${vehicle.model}`),
}));
