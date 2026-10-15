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
 * Rebuild the in-progress phrase from one recognition result event.
 * `committedFinalText` is finalized text from earlier sessions only.
 * Final results in this event are concatenated. Each non-final result
 * replaces the interim phrase instead of being appended to it.
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
      sessionFinal = joinSpeechText(sessionFinal, transcript);
      interimText = '';
    } else {
      interimText = transcript;
    }
  }
  const finalText = joinSpeechText(committedFinalText, sessionFinal);
  const text = joinSpeechText(finalText, interimText);
  return { finalText, interimText, text };
}
