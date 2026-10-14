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

console.log('speech transcript reducer: ok');
console.log(JSON.stringify({
  cumulative: latest,
  separate,
  restarted: restarted.text,
}));
