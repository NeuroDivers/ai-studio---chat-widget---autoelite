import { reduceSpeechResults, type SpeechResultLike } from './speechTranscript';

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

const sequence: SpeechResultLike[] = [
  { transcript: 'do you', isFinal: false },
  { transcript: 'do you have', isFinal: false },
  { transcript: 'do you have', isFinal: false },
  { transcript: 'do you have any', isFinal: false },
  { transcript: 'do you have any Hondas', isFinal: true },
];

// Chrome repeats the current hypothesis as its own result. Rebuilding from the
// whole list must keep the latest interim, then the final sentence.
const cumulative: SpeechResultLike[] = [];
let latest = '';
sequence.forEach((hypothesis, index) => {
  cumulative.push(hypothesis);
  latest = reduceSpeechResults('', cumulative).text;
  const expected = hypothesis.transcript || '';
  assertEqual(latest, expected, `cumulative step ${index + 1}`);
});
assertEqual(latest, 'do you have any Hondas', 'cumulative final');
if (latest.includes('do youdo you')) {
  throw new Error('cumulative transcript still stutters');
}

// The same sequence as separate events. Only finalized text is carried forward.
let committed = '';
let separate = '';
sequence.forEach((hypothesis, index) => {
  const snapshot = reduceSpeechResults(committed, [hypothesis]);
  committed = snapshot.finalText;
  separate = snapshot.text;
  assertEqual(separate, hypothesis.transcript || '', `separate step ${index + 1}`);
});
assertEqual(separate, 'do you have any Hondas', 'separate final');
assertEqual(committed, 'do you have any Hondas', 'separate committed finals');

// A restarted session starts from finalized text only.
const finalized = reduceSpeechResults('', [{ transcript: 'do you have', isFinal: true }]);
assertEqual(finalized.finalText, 'do you have', 'restart base');
assertEqual(finalized.interimText, '', 'restart has no interim');
const restarted = reduceSpeechResults(finalized.finalText, [{ transcript: 'any Hondas', isFinal: false }]);
assertEqual(restarted.text, 'do you have any Hondas', 'restart display');
if (restarted.text === 'do you have do you have any Hondas') {
  throw new Error('restart replayed the previous phrase');
}

// An interim must not be copied into the next session's base.
const interimOnly = reduceSpeechResults('', [{ transcript: 'do you have', isFinal: false }]);
assertEqual(interimOnly.finalText, '', 'interim is not final');
const afterDrop = reduceSpeechResults(interimOnly.finalText, [{ transcript: 'any Hondas', isFinal: false }]);
assertEqual(afterDrop.text, 'any Hondas', 'dropped interim is not replayed');

// 1. Overlapping interims in one event, then one final sentence.
const originalEvent = reduceSpeechResults('', sequence);
assertEqual(originalEvent.text, 'do you have any Hondas', 'original overlapping sequence');
assertEqual(originalEvent.finalText, 'do you have any Hondas', 'original sequence committed');
if (originalEvent.text.includes('do youdo you')) {
  throw new Error('original sequence still concatenates guesses');
}

// 2. Several non-final results in one event are one hypothesis, not segments.
const interimGuesses = reduceSpeechResults('', [
  { transcript: 'do you', isFinal: false },
  { transcript: 'do you have', isFinal: false },
  { transcript: 'do you have any', isFinal: false },
]);
assertEqual(interimGuesses.text, 'do you have any', 'non-final guesses keep the latest');
assertEqual(interimGuesses.finalText, '', 'non-final guesses are not committed');
assertEqual(interimGuesses.interimText, 'do you have any', 'interim is the latest guess');

// 3. The same strings marked final still must not be glued together.
const finalGuesses = reduceSpeechResults('', [
  { transcript: 'do you', isFinal: true },
  { transcript: 'do you have', isFinal: true },
  { transcript: 'do you have any', isFinal: true },
]);
assertEqual(finalGuesses.text, 'do you have any', 'final guesses keep the latest');
assertEqual(finalGuesses.finalText, 'do you have any', 'final guesses commit the latest');
if (finalGuesses.text.includes('do youdo you') || finalGuesses.text.includes('do you do you')) {
  throw new Error('final guesses were concatenated');
}

// 4. A later final with a leading space is a new segment.
const firstSegment = reduceSpeechResults('', [{ transcript: 'do you have', isFinal: true }]);
const secondSegment = reduceSpeechResults(firstSegment.finalText, [{ transcript: ' any Hondas', isFinal: true }]);
assertEqual(secondSegment.text, 'do you have any Hondas', 'two-segment later final');
assertEqual(secondSegment.finalText, 'do you have any Hondas', 'two-segment committed');
const sameEventSegments = reduceSpeechResults('', [
  { transcript: 'do you have', isFinal: true },
  { transcript: ' any Hondas', isFinal: true },
]);
assertEqual(sameEventSegments.text, 'do you have any Hondas', 'two-segment one event');

// 5. A restarted session may repeat the whole phrase. Do not append it to itself.
const restartedFull = reduceSpeechResults('do you have', [
  { transcript: 'do you have any Hondas', isFinal: true },
]);
assertEqual(restartedFull.text, 'do you have any Hondas', 'restart full phrase');
assertEqual(restartedFull.finalText, 'do you have any Hondas', 'restart full phrase committed');
if (restartedFull.text === 'do you have do you have any Hondas') {
  throw new Error('restart appended the phrase to itself');
}
const restartedFullInterim = reduceSpeechResults('do you have', [
  { transcript: 'do you have any Hondas', isFinal: false },
]);
assertEqual(restartedFullInterim.text, 'do you have any Hondas', 'restart full phrase interim');
assertEqual(restartedFullInterim.finalText, 'do you have', 'restart interim stays uncommitted');

console.log('speech transcript reducer: ok');
console.log(JSON.stringify({
  cumulative: latest,
  separate,
  restarted: restarted.text,
  originalEvent: originalEvent.text,
  interimGuesses: interimGuesses.text,
  finalGuesses: finalGuesses.text,
  secondSegment: secondSegment.text,
  restartedFull: restartedFull.text,
}));
