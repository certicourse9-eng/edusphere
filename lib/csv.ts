import type { GradeBoundary, StudentFile } from './types';
import { FILE_STATUS_LABELS } from './types';
import { computeGradeFromBoundaries } from './gradeBoundaries';

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(files: StudentFile[], gradeBoundaries: GradeBoundary[] = []): string {
  const header = [
    'Student ID',
    'Filename',
    'Status',
    'Detected Subject',
    'Question Count',
    'AI Score',
    'Teacher-Approved Score',
    'Max Score',
    'Percentage',
    'IB Grade',
    'Review Reason',
    'Teacher Feedback'
  ];

  const rows = files
    .filter(f => f.result !== null)
    .map(f => {
      const r = f.result!;
      const isOverridden = typeof f.teacherOverrideScore === 'number';
      const effectiveScore = isOverridden ? (f.teacherOverrideScore as number) : r.totalScore;
      const pct = r.maxTotal > 0 ? effectiveScore / r.maxTotal : 0;
      const grade = computeGradeFromBoundaries(pct, gradeBoundaries);
      return [
        f.studentId,
        f.fileName,
        FILE_STATUS_LABELS[f.status],
        r.detectedSubject,
        String(r.questions.length),
        String(r.totalScore),
        isOverridden ? String(f.teacherOverrideScore) : '',
        String(r.maxTotal),
        `${Math.round(pct * 100)}%`,
        grade !== null ? String(grade) : '',
        f.reviewReason || '',
        f.teacherFeedback || ''
      ]
        .map(csvEscape)
        .join(',');
    });

  return [header.map(csvEscape).join(','), ...rows].join('\r\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
