import type { GradeBoundary } from './types';

/** Computes the IB 1-7 course grade from real grade boundaries the teacher entered for this
 *  class/session - NEVER from a hardcoded percentage table. Real IB grade boundaries vary by
 *  subject, level, and exam session, so there is no universal formula; when no boundaries have
 *  been entered, this returns null and the UI must show only the raw score/percentage instead
 *  of a grade. Returns null (not grade 1) for a percentage below every entered boundary too,
 *  since that means the entered boundaries don't cover that range rather than that grade 1 is
 *  necessarily correct. */
export function computeGradeFromBoundaries(pct: number, boundaries: GradeBoundary[] | null | undefined): number | null {
  if (!boundaries || boundaries.length === 0) return null;
  const sorted = [...boundaries].sort((a, b) => b.minPercent - a.minPercent);
  for (const b of sorted) {
    if (pct * 100 >= b.minPercent) return b.grade;
  }
  return null;
}

/** A boundary set is "usable" once every grade 1-7 has an entry - partial entry is allowed
 *  while the teacher is still typing, but grading only kicks in once it's complete. */
export function isCompleteBoundarySet(boundaries: GradeBoundary[]): boolean {
  const grades = new Set(boundaries.map(b => b.grade));
  return [1, 2, 3, 4, 5, 6, 7].every(g => grades.has(g as GradeBoundary['grade']));
}
