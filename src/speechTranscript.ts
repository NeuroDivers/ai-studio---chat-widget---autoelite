/**
 * One SpeechRecognition result, or the small shape used by tests.
 * Interim hypotheses are replaced. Final segments are kept.
 */
export interface SpeechResultLike {
  isFinal?: boolean;
  transcript?: string;
  0?: { transcript?: string };
}

export interface SpeechTranscriptSnapshot {
  /** Finalized segments only, including earlier sessions. Safe to carry across a restart. */
  finalText: string;
  /** Current non-final hypothesis. Never replayed into the next session. */
  interimText: string;
  /** Composer text: finalized segments plus the current interim. */
  text: string;
}

/** Join recognizer segments without doubling a space the engine already emitted. */
export function joinSpeechText(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;
  return `${left} ${right}`;
}

function resultTranscript(result: SpeechResultLike | undefined): string {
  if (!result) return '';
  const alternative = result[0];
  if (alternative && typeof alternative.transcript === 'string') return alternative.transcript;
  if (typeof result.transcript === 'string') return result.transcript;
  return '';
}

/**
 * True when `next` is a newer hypothesis of the same phrase as `previous`.
 * "do you have" extends "do you". "do your" does not. " any Hondas" does not.
 */
function speechHypothesisExtends(previous: string, next: string): boolean {
  const prev = previous.trim();
  const nxt = next.trim();
  if (!prev || !nxt) return false;
  const prevFold = prev.toLowerCase();
  const nextFold = nxt.toLowerCase();
  if (!nextFold.startsWith(prevFold)) return false;
  const boundary = nextFold.charAt(prevFold.length);
  return boundary === '' || /\s/.test(boundary);
}

/**
 * Keep a new segment, or replace the phrase when the recognizer repeated it.
 * Chrome often puts the entire utterance so far in every result. Appending
 * those overlaps glues "do you" + "do you have".
 */
function mergeSpeechSegment(previous: string, next: string): string {
  if (!previous) return next;
  if (!next) return previous;
  if (speechHypothesisExtends(previous, next)) return next.trim();
  if (speechHypothesisExtends(next, previous)) return previous;
  return joinSpeechText(previous, next);
}

/**
 * Rebuild the in-progress phrase from one recognition result event.
 * `committedFinalText` is finalized text from earlier sessions only.
 * Final segments are concatenated only when they do not overlap. A final
 * transcript that starts with the text already accepted replaces it.
 * The latest non-final result always replaces the interim.
 */
export function reduceSpeechResults(
  committedFinalText: string,
  results: { length: number; [index: number]: SpeechResultLike | undefined } | null | undefined,
): SpeechTranscriptSnapshot {
  let sessionFinal = '';
  let interimText = '';
  const length = results && typeof results.length === 'number' ? results.length : 0;
  for (let index = 0; index < length; index += 1) {
    const result = results?.[index];
    const transcript = resultTranscript(result);
    if (!transcript) continue;
    if (result?.isFinal) {
      sessionFinal = mergeSpeechSegment(sessionFinal, transcript);
      interimText = '';
    } else {
      interimText = transcript;
    }
  }
  const finalText = mergeSpeechSegment(committedFinalText, sessionFinal);
  const text = interimText ? mergeSpeechSegment(finalText, interimText) : finalText;
  return { finalText, interimText, text };
}
