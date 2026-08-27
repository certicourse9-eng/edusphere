import type { GradingResult } from './types';

export function parseGradingResponse(rawText: string): GradingResult {
  let cleaned = rawText.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        parsed = JSON.parse(braceMatch[0]);
      } catch {
        // fall through to the validation error below
      }
    }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as Partial<GradingResult>).questions) ||
    !Array.isArray((parsed as Partial<GradingResult>).generalFeedback)
  ) {
    throw new Error("Could not parse a valid grading JSON object from Claude's response");
  }

  const p = parsed as GradingResult;
  const result: GradingResult = {
    questions: p.questions,
    generalFeedback: p.generalFeedback,
    totalScore: typeof p.totalScore === 'number' ? p.totalScore : 0,
    maxTotal: typeof p.maxTotal === 'number' ? p.maxTotal : 0
  };
  if (typeof p.error === 'string') result.error = p.error;
  return result;
}
