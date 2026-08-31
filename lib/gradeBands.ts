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
