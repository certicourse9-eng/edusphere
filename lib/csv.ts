import type { StudentFile } from './types';
import { approxIbGrade } from './gradeBands';

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(files: StudentFile[]): string {
  const header = [
    'Student ID',
    'Filename',
    'Detected Subject',
    'Question Count',
    'Total Score',
    'Max Score',
    'Approx IB Grade',
    'Teacher Feedback'
  ];

  const rows = files
    .filter((f): f is StudentFile & { result: NonNullable<StudentFile['result']> } => f.status === 'done' && f.result !== null)
    .map(f => {
      const r = f.result;
      const grade = approxIbGrade(r.totalScore, r.maxTotal);
      return [
        f.studentId,
        f.fileName,
        r.detectedSubject,
        String(r.questions.length),
        String(r.totalScore),
        String(r.maxTotal),
        String(grade),
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
