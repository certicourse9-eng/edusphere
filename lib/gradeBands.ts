export type Band = 'good' | 'moderate' | 'weak';

export function getBand(score: number, maxScore: number): Band {
  if (maxScore <= 0) return 'weak';
  const pct = score / maxScore;
  if (pct >= 0.7) return 'good';
  if (pct >= 0.4) return 'moderate';
  return 'weak';
}

export const BAND_LABELS: Record<Band, string> = {
  good: 'Good',
  moderate: 'Moderate',
  weak: 'Needs work'
};

export const BAND_COLORS: Record<Band, string> = {
  good: 'var(--green)',
  moderate: 'var(--amber)',
  weak: 'var(--coral)'
};

/**
 * Demo-only approximate IB grade table (1-7), NOT official IB grade
 * boundaries. Real boundaries vary by subject, session, and are set by
 * the IB after each exam session. This is a fixed, made-up percentage
 * split purely so the dashboard has something to show - always labeled
 * "(approx.)" in the UI.
 */
const IB_GRADE_THRESHOLDS: { min: number; grade: number }[] = [
  { min: 0.85, grade: 7 },
  { min: 0.75, grade: 6 },
  { min: 0.65, grade: 5 },
  { min: 0.5, grade: 4 },
  { min: 0.35, grade: 3 },
  { min: 0.2, grade: 2 },
  { min: 0, grade: 1 }
];

export function approxIbGrade(score: number, maxScore: number): number {
  if (maxScore <= 0) return 1;
  const pct = score / maxScore;
  for (const threshold of IB_GRADE_THRESHOLDS) {
    if (pct >= threshold.min) return threshold.grade;
  }
  return 1;
}
