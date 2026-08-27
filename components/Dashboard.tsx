'use client';

import { Fragment, useState } from 'react';
import styles from './Dashboard.module.css';
import StudentReportRow from './StudentReportRow';
import { getBand, approxIbGrade } from '@/lib/gradeBands';
import type { StudentFile } from '@/lib/types';

interface DashboardProps {
  files: StudentFile[];
  onTeacherFeedbackChange: (id: string, text: string) => void;
  onExport: () => void;
  exportDisabled: boolean;
}

export default function Dashboard({ files, onTeacherFeedbackChange, onExport, exportDisabled }: DashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const graded = files.filter(
    (f): f is StudentFile & { result: NonNullable<StudentFile['result']> } => f.status === 'done' && f.result !== null
  );

  if (graded.length === 0) return null;

  const errorCount = files.filter(f => f.status === 'error').length;
  const questionsAssessed = graded.reduce((sum, f) => sum + f.result.questions.length, 0);
  const totalScore = graded.reduce((sum, f) => sum + f.result.totalScore, 0);
  const totalMax = graded.reduce((sum, f) => sum + f.result.maxTotal, 0);
  const classAverage =
    graded.length > 0 ? `${(totalScore / graded.length).toFixed(1)} / ${(totalMax / graded.length).toFixed(0)}` : '—';

  return (
    <section className={`${styles.panel} fade-in`}>
      <h2>Mark sheet</h2>
      <p className={styles.sub}>One row per student. Click a row to open the full report.</p>

      <div className={styles.statsBar}>
        <Stat label="Sheets processed" value={`${graded.length} / ${files.length}`} />
        <Stat label="Questions assessed" value={String(questionsAssessed)} />
        <Stat label="Class average" value={classAverage} />
        <Stat label="Errors" value={String(errorCount)} warn={errorCount > 0} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.caretCol}></th>
              <th>Student ID</th>
              <th>File</th>
              <th>Questions</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {graded.map(f => {
              const r = f.result;
              const band = getBand(r.totalScore, r.maxTotal);
              const grade = approxIbGrade(r.totalScore, r.maxTotal);
              const isOpen = expandedId === f.id;
              return (
                <Fragment key={f.id}>
                  <tr className={styles.row} onClick={() => setExpandedId(isOpen ? null : f.id)} aria-expanded={isOpen}>
                    <td className={styles.caret}>{isOpen ? '▾' : '▸'}</td>
                    <td className={styles.studentId}>{f.studentId}</td>
                    <td className={styles.fileName}>{f.fileName}</td>
                    <td>{r.questions.length}</td>
                    <td>
                      <span className={`${styles.gradePill} ${styles[band]}`}>{grade}</span>
                      <span className={styles.miniScore}>
                        {r.totalScore}/{r.maxTotal}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={styles.detailRow}>
                      <td colSpan={5}>
                        <StudentReportRow file={f} onTeacherFeedbackChange={text => onTeacherFeedbackChange(f.id, text)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className={styles.exportBtn} onClick={onExport} disabled={exportDisabled}>
        Export CSV
      </button>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} style={warn ? { color: 'var(--coral)' } : undefined}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
