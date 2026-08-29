import { getBand } from './gradeBands';
import type { Band } from './gradeBands';
import type { StudentFile } from './types';

function gradedFiles(files: StudentFile[]) {
  return files.filter(f => f.result && !f.result.error);
}

export interface BandCount {
  band: Band;
  count: number;
}

/** How many graded papers fall into each score band - feeds the donut chart. */
export function getBandCounts(files: StudentFile[]): BandCount[] {
  const graded = gradedFiles(files);
  const counts: Record<Band, number> = { good: 0, moderate: 0, weak: 0 };
  graded.forEach(f => {
    const r = f.result!;
    counts[getBand(r.totalScore, r.maxTotal)]++;
  });
  return (['good', 'moderate', 'weak'] as Band[]).map(band => ({ band, count: counts[band] }));
}

export interface StudentScore {
  studentId: string;
  fileName: string;
  score: number;
  maxScore: number;
  pct: number;
  band: Band;
}

/** One entry per graded student, sorted highest-first - feeds the student comparison bar chart. */
export function getStudentScores(files: StudentFile[]): StudentScore[] {
  return gradedFiles(files)
    .map(f => {
      const r = f.result!;
      const pct = r.maxTotal > 0 ? r.totalScore / r.maxTotal : 0;
      return { studentId: f.studentId, fileName: f.fileName, score: r.totalScore, maxScore: r.maxTotal, pct, band: getBand(r.totalScore, r.maxTotal) };
    })
    .sort((a, b) => b.pct - a.pct);
}

export interface QuestionAverage {
  number: number;
  avgPct: number;
  studentCount: number;
  band: Band;
}

/** Average score (as a %) on each question number, across every student who answered it -
 *  feeds both the question bar chart and the score-trend line. EduSphere doesn't tag
 *  questions with topics, so question number is the finest real grouping available; using
 *  it here (rather than inventing topic labels) keeps this honest. */
export function getQuestionAverages(files: StudentFile[]): QuestionAverage[] {
  const totals = new Map<number, { sumPct: number; count: number }>();
  gradedFiles(files).forEach(f => {
    f.result!.questions.forEach(q => {
      if (q.maxScore <= 0) return;
      const entry = totals.get(q.number) ?? { sumPct: 0, count: 0 };
      entry.sumPct += q.score / q.maxScore;
      entry.count += 1;
      totals.set(q.number, entry);
    });
  });
  return Array.from(totals.entries())
    .sort(([a], [b]) => a - b)
    .map(([number, { sumPct, count }]) => {
      const avgPct = sumPct / count;
      return { number, avgPct, studentCount: count, band: getBand(avgPct, 1) };
    });
}

export interface CriterionAverage {
  code: string;
  name: string;
  avgPct: number;
  sampleCount: number;
}

/** Average score (as a %) per IB criterion code (A/B/C/...), across every question and
 *  student that used it - feeds the radar chart. Criteria are matched by code+name since
 *  the same code can mean different things across coursework types/subjects. */
export function getCriteriaAverages(files: StudentFile[]): CriterionAverage[] {
  const totals = new Map<string, { name: string; sumPct: number; count: number }>();
  gradedFiles(files).forEach(f => {
    f.result!.questions.forEach(q => {
      q.criteria.forEach(c => {
        if (c.maxScore <= 0) return;
        const key = `${c.code}::${c.name}`;
        const entry = totals.get(key) ?? { name: c.name, sumPct: 0, count: 0 };
        entry.sumPct += c.score / c.maxScore;
        entry.count += 1;
        totals.set(key, entry);
      });
    });
  });
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { name, sumPct, count }]) => ({
      code: key.split('::')[0],
      name,
      avgPct: sumPct / count,
      sampleCount: count
    }));
}

export interface HeatmapCell {
  studentId: string;
  questionNumber: number;
  pct: number | null;
}

export interface HeatmapData {
  studentIds: string[];
  questionNumbers: number[];
  cells: HeatmapCell[];
}

/** studentId x question-number grid of scores (as %) - feeds the heatmap. `pct` is null
 *  when that student's paper didn't include that question number, so the cell renders
 *  as "no data" rather than a fabricated zero. */
export function getHeatmapData(files: StudentFile[]): HeatmapData {
  const graded = gradedFiles(files);
  const questionNumbers = Array.from(new Set(graded.flatMap(f => f.result!.questions.map(q => q.number)))).sort((a, b) => a - b);
  const studentIds = graded.map(f => f.studentId);

  const cells: HeatmapCell[] = [];
  graded.forEach(f => {
    const byNumber = new Map(f.result!.questions.map(q => [q.number, q]));
    questionNumbers.forEach(qn => {
      const q = byNumber.get(qn);
      cells.push({
        studentId: f.studentId,
        questionNumber: qn,
        pct: q && q.maxScore > 0 ? q.score / q.maxScore : null
      });
    });
  });

  return { studentIds, questionNumbers, cells };
}

export interface Insight {
  label: string;
  detail: string;
  tone: 'good' | 'weak' | 'neutral';
}

/** A handful of auto-generated, plainly-computed insights (weakest/strongest question,
 *  weakest criterion, papers needing review) - every one is a direct read of the same
 *  aggregates the charts plot, never a separate/invented judgement. */
export function getInsights(files: StudentFile[]): Insight[] {
  const insights: Insight[] = [];
  if (gradedFiles(files).length === 0) return insights;

  const questions = getQuestionAverages(files);
  if (questions.length > 0) {
    const byWeakest = [...questions].sort((a, b) => a.avgPct - b.avgPct);
    const weakest = byWeakest[0];
    const strongest = byWeakest[byWeakest.length - 1];
    insights.push({
      label: `Question ${weakest.number} is the class's weakest spot`,
      detail: `${Math.round(weakest.avgPct * 100)}% average across ${weakest.studentCount} student${weakest.studentCount === 1 ? '' : 's'} - worth revisiting in class.`,
      tone: 'weak'
    });
    if (strongest.number !== weakest.number) {
      insights.push({
        label: `Question ${strongest.number} is the strongest`,
        detail: `${Math.round(strongest.avgPct * 100)}% average - the class has this one down.`,
        tone: 'good'
      });
    }
  }

  const criteria = getCriteriaAverages(files);
  if (criteria.length > 0) {
    const weakest = [...criteria].sort((a, b) => a.avgPct - b.avgPct)[0];
    insights.push({
      label: `${weakest.code} · ${weakest.name} needs the most attention`,
      detail: `${Math.round(weakest.avgPct * 100)}% average across every question that used it.`,
      tone: 'weak'
    });
  }

  const needsReview = files.filter(f => f.status === 'needs-review').length;
  if (needsReview > 0) {
    insights.push({
      label: `${needsReview} paper${needsReview === 1 ? '' : 's'} flagged for review`,
      detail: 'Low OCR confidence or a subject mismatch - check before trusting the score.',
      tone: 'weak'
    });
  }

  const failed = files.filter(f => f.status === 'failed').length;
  if (failed > 0) {
    insights.push({
      label: `${failed} paper${failed === 1 ? '' : 's'} failed to grade`,
      detail: 'Retry from the Queue below, or check the error message for why.',
      tone: 'weak'
    });
  }

  return insights;
}
