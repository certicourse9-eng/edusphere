'use client';

import { Fragment, useState } from 'react';
import styles from './Dashboard.module.css';
import StudentReportRow from './StudentReportRow';
import { getBand } from '@/lib/gradeBands';
import { computeGradeFromBoundaries } from '@/lib/gradeBoundaries';
import { getEffectiveTotalScore, isScoreOverridden } from '@/lib/effectiveScore';
import { FILE_STATUS_LABELS, FINISHED_STATUSES } from '@/lib/types';
import type { FileStatus, GradeBoundary, IBProgramme, StudentFile } from '@/lib/types';

type FilterOption = 'all' | 'evaluated' | 'pending' | 'processing' | 'needs-review' | 'teacher-approved' | 'failed';

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All students' },
  { value: 'evaluated', label: 'Evaluated' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'needs-review', label: 'Needs Review' },
  { value: 'teacher-approved', label: 'Teacher Approved' },
  { value: 'failed', label: 'Failed' }
];

function matchesFilter(status: FileStatus, filter: FilterOption): boolean {
  if (filter === 'all') return true;
  if (filter === 'evaluated') return status === 'evaluated';
  if (filter === 'pending') return status === 'uploaded';
  if (filter === 'processing') return status === 'ocr-processing' || status === 'ocr-completed' || status === 'evaluating';
  return status === filter;
}

interface DashboardProps {
  files: StudentFile[];
  onTeacherFeedbackChange: (id: string, text: string) => void;
  onApprove: (id: string) => void;
  onTeacherOverrideScoreChange: (id: string, score: number | null) => void;
  onTeacherOverrideQuestionScoreChange: (id: string, questionNumber: number, score: number | null) => void;
  onExport: () => void;
  exportDisabled: boolean;
  gradeBoundaries: GradeBoundary[];
  programme: IBProgramme;
}

export default function Dashboard({
  files,
  onTeacherFeedbackChange,
  onApprove,
  onTeacherOverrideScoreChange,
  onTeacherOverrideQuestionScoreChange,
  onExport,
  exportDisabled,
  gradeBoundaries,
  programme
}: DashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');

  if (files.length === 0) return null;

  const finished = files.filter(f => FINISHED_STATUSES.includes(f.status));
  const questionsAssessed = finished.reduce((sum, f) => sum + (f.result?.questions.length ?? 0), 0);
  const totalScore = finished.reduce((sum, f) => sum + (f.result ? getEffectiveTotalScore(f) : 0), 0);
  const totalMax = finished.reduce((sum, f) => sum + (f.result?.maxTotal ?? 0), 0);
  const classAverage =
    finished.length > 0 ? `${(totalScore / finished.length).toFixed(1)} / ${(totalMax / finished.length).toFixed(0)}` : '—';
  const failedCount = files.filter(f => f.status === 'failed').length;

  const query = search.trim().toLowerCase();
  const visible = files
    .filter(f => matchesFilter(f.status, filter))
    .filter(f => !query || f.studentId.toLowerCase().includes(query) || f.fileName.toLowerCase().includes(query));

  return (
    <section className={`${styles.panel} fade-in`}>
      <h2>Mark sheet</h2>
      <p className={styles.sub}>One row per student. Click an evaluated row to open the full report.</p>

      <div className={styles.statsBar}>
        <Stat label="Sheets processed" value={`${finished.length} / ${files.length}`} />
        <Stat label="Questions assessed" value={String(questionsAssessed)} />
        <Stat label="Class average" value={classAverage} />
        <Stat label="Failed" value={String(failedCount)} warn={failedCount > 0} />
      </div>

      <div className={styles.controlsRow}>
        <input
          type="text"
          className={styles.searchBox}
          placeholder="Search by student ID or filename…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search students"
        />
        <select
          className={styles.filterSelect}
          value={filter}
          onChange={e => setFilter(e.target.value as FilterOption)}
          aria-label="Filter by status"
        >
          {FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {(query || filter !== 'all') && (
        <p className={styles.searchHint}>
          {visible.length} of {files.length} student{files.length === 1 ? '' : 's'} match
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.caretCol}></th>
              <th>Student ID</th>
              <th>File</th>
              <th>Subject</th>
              <th>Questions</th>
              <th>Score / Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.noResults}>
                  No students match this filter/search.
                </td>
              </tr>
            )}
            {visible.map(f => {
              const r = f.result;
              const isOpen = expandedId === f.id;
              const canOpen = !!r;
              const canApprove = f.status === 'evaluated' || f.status === 'needs-review';
              return (
                <Fragment key={f.id}>
                  <tr
                    className={`${styles.row} ${canOpen ? '' : styles.rowDisabled}`}
                    onClick={() => canOpen && setExpandedId(isOpen ? null : f.id)}
                    aria-expanded={isOpen}
                  >
                    <td className={styles.caret}>{canOpen ? (isOpen ? '▾' : '▸') : ''}</td>
                    <td className={styles.studentId}>{f.studentId}</td>
                    <td className={styles.fileName}>{f.fileName}</td>
                    <td className={styles.subjectCol}>{r?.detectedSubject ?? '—'}</td>
                    <td>{r ? r.questions.length : '—'}</td>
                    <td>
                      {r ? (
                        (() => {
                          const overridden = isScoreOverridden(f);
                          const effectiveScore = getEffectiveTotalScore(f);
                          const pct = r.maxTotal > 0 ? effectiveScore / r.maxTotal : 0;
                          const grade = computeGradeFromBoundaries(pct, gradeBoundaries);
                          return (
                            <>
                              <span className={`${styles.gradePill} ${styles[getBand(effectiveScore, r.maxTotal)]}`}>
                                {grade ?? `${Math.round(pct * 100)}%`}
                              </span>
                              <span className={styles.miniScore}>
                                {effectiveScore}/{r.maxTotal}
                                {overridden && <span className={styles.overriddenTag} title="Teacher-adjusted final score">T</span>}
                              </span>
                            </>
                          );
                        })()
                      ) : (
                        <span className={`${styles.statusPill} ${styles[f.status]}`}>{FILE_STATUS_LABELS[f.status]}</span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {canApprove && (
                        <button className={styles.approveBtn} onClick={() => onApprove(f.id)}>
                          Approve
                        </button>
                      )}
                      {f.status === 'teacher-approved' && <span className={styles.approvedTag}>✓ Approved</span>}
                    </td>
                  </tr>
                  {isOpen && r && (
                    <tr className={styles.detailRow}>
                      <td colSpan={7}>
                        <StudentReportRow
                          file={f}
                          onTeacherFeedbackChange={text => onTeacherFeedbackChange(f.id, text)}
                          onTeacherOverrideScoreChange={score => onTeacherOverrideScoreChange(f.id, score)}
                          onTeacherOverrideQuestionScoreChange={(questionNumber, score) =>
                            onTeacherOverrideQuestionScoreChange(f.id, questionNumber, score)
                          }
                          gradeBoundaries={gradeBoundaries}
                          programme={f.programme ?? programme}
                        />
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
