import type { Annotation, AnnotationType, CriterionScore, GradedQuestion, GradingResult } from './types';

const ANNOTATION_TYPES: AnnotationType[] = ['strength', 'weakness', 'suggestion', 'criterion'];

function normalizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map(a => {
      const type = ANNOTATION_TYPES.includes(a.type as AnnotationType) ? (a.type as AnnotationType) : 'suggestion';
      const annotation: Annotation = {
        type,
        lineStart: typeof a.lineStart === 'number' ? a.lineStart : 0,
        lineEnd: typeof a.lineEnd === 'number' ? a.lineEnd : 0,
        comment: typeof a.comment === 'string' ? a.comment : ''
      };
      if (typeof a.criterionCode === 'string' && a.criterionCode) annotation.criterionCode = a.criterionCode;
      return annotation;
    })
    .filter(a => a.comment.length > 0);
}

function normalizeCriteria(raw: unknown): CriterionScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map(c => ({
      code: typeof c.code === 'string' ? c.code : '',
      name: typeof c.name === 'string' ? c.name : '',
      score: typeof c.score === 'number' ? c.score : 0,
      maxScore: typeof c.maxScore === 'number' ? c.maxScore : 0,
      comment: typeof c.comment === 'string' ? c.comment : '',
      evidence: typeof c.evidence === 'string' ? c.evidence : '',
      missing: typeof c.missing === 'string' ? c.missing : ''
    }));
}

function normalizeConfidence(raw: unknown): number | null {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  return Math.max(0, Math.min(1, raw));
}

function normalizeQuestions(raw: unknown): GradedQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
    .map(q => ({
      number: typeof q.number === 'number' ? q.number : 0,
      questionText: typeof q.questionText === 'string' ? q.questionText : '',
      answerText: typeof q.answerText === 'string' ? q.answerText : '',
      score: typeof q.score === 'number' ? q.score : 0,
      maxScore: typeof q.maxScore === 'number' ? q.maxScore : 0,
      feedback: typeof q.feedback === 'string' ? q.feedback : '',
      criteria: normalizeCriteria(q.criteria),
      confidence: normalizeConfidence(q.confidence)
    }));
}

export function parseGradingResponse(rawText: string, detectedSubject: string): GradingResult {
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
    questions: normalizeQuestions(p.questions),
    generalFeedback: p.generalFeedback,
    totalScore: typeof p.totalScore === 'number' ? p.totalScore : 0,
    maxTotal: typeof p.maxTotal === 'number' ? p.maxTotal : 0,
    detectedSubject,
    annotations: normalizeAnnotations(p.annotations)
  };
  if (typeof p.error === 'string') result.error = p.error;
  return result;
}
