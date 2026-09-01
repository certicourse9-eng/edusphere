import type { GradedQuestion, StudentFile } from './types';

/** The score that actually counts for a student's paper: the teacher's whole-paper override
 *  if set, else the sum of per-question overrides (falling back to the AI's own score for any
 *  question the teacher didn't touch), else the AI's original total. Centralized here so the
 *  Mark sheet, the report view, the annotated-paper summary, and the CSV export can never
 *  disagree with each other about what "the final score" is. */
export function getEffectiveTotalScore(file: StudentFile): number {
  const r = file.result;
  if (!r) return 0;
  if (typeof file.teacherOverrideScore === 'number') return file.teacherOverrideScore;
  const questionOverrides = file.teacherOverrideQuestionScores;
  if (questionOverrides && Object.keys(questionOverrides).length > 0) {
    return r.questions.reduce((sum, q) => sum + (questionOverrides[q.number] ?? q.score), 0);
  }
  return r.totalScore;
}

export function isScoreOverridden(file: StudentFile): boolean {
  return (
    typeof file.teacherOverrideScore === 'number' ||
    !!(file.teacherOverrideQuestionScores && Object.keys(file.teacherOverrideQuestionScores).length > 0)
  );
}

export function getEffectiveQuestionScore(file: StudentFile, question: GradedQuestion): number {
  return file.teacherOverrideQuestionScores?.[question.number] ?? question.score;
}

export function isQuestionOverridden(file: StudentFile, questionNumber: number): boolean {
  return file.teacherOverrideQuestionScores?.[questionNumber] !== undefined;
}

/** Same rule as getEffectiveTotalScore, for callers (like AnnotatedPageView) that already work
 *  with the individual pieces rather than a whole StudentFile. */
export function computeEffectiveScoreFromParts(
  totalScore: number,
  questions: GradedQuestion[],
  teacherOverrideScore: number | null | undefined,
  teacherOverrideQuestionScores: Record<number, number> | undefined
): number {
  if (typeof teacherOverrideScore === 'number') return teacherOverrideScore;
  if (teacherOverrideQuestionScores && Object.keys(teacherOverrideQuestionScores).length > 0) {
    return questions.reduce((sum, q) => sum + (teacherOverrideQuestionScores[q.number] ?? q.score), 0);
  }
  return totalScore;
}
