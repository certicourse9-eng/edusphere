'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './UploadPanel.module.css';
import SubjectIcon from './SubjectIcon';
import { SUBJECTS } from '@/lib/subjectIcons';
import type { CourseworkType, IBProgramme, Level } from '@/lib/types';
import { COURSEWORK_TYPE_LABELS, IB_PROGRAMME_LABELS } from '@/lib/types';

const COURSEWORK_TYPES: CourseworkType[] = ['internal-assessment', 'extended-essay', 'tok', 'external-assessment', 'exam'];
const IB_PROGRAMMES: IBProgramme[] = ['DP', 'MYP'];

interface UploadPanelProps {
  programme: IBProgramme;
  onProgrammeChange: (p: IBProgramme) => void;
  gradeYear: string;
  onGradeYearChange: (v: string) => void;
  courseworkType: CourseworkType;
  onCourseworkTypeChange: (t: CourseworkType) => void;
  subject: string;
  onSubjectChange: (s: string) => void;
  level: Level;
  onLevelChange: (l: Level) => void;
  expectedStudentCount: string;
  onExpectedStudentCountChange: (v: string) => void;
  onFilesAdded: (files: File[]) => void;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
  progressLabel: string;
}

export default function UploadPanel({
  programme,
  onProgrammeChange,
  gradeYear,
  onGradeYearChange,
  courseworkType,
  onCourseworkTypeChange,
  subject,
  onSubjectChange,
  level,
  onLevelChange,
  expectedStudentCount,
  onExpectedStudentCountChange,
  onFilesAdded,
  onRun,
  running,
  canRun,
  progressLabel
}: UploadPanelProps) {
  const showSubject = courseworkType !== 'tok';
  const showLevel = courseworkType === 'internal-assessment' || courseworkType === 'external-assessment' || courseworkType === 'exam';
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        onFilesAdded(Array.from(e.dataTransfer.files));
      }
    },
    [onFilesAdded]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleBrowseClick = useCallback(() => inputRef.current?.click(), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        onFilesAdded(Array.from(e.target.files));
      }
      e.target.value = '';
    },
    [onFilesAdded]
  );

  return (
    <section className={`${styles.panel} fade-in`}>
      <div className={styles.controls}>
        <div className={styles.field}>
          <label htmlFor="programme">IB Programme</label>
          <select id="programme" value={programme} onChange={e => onProgrammeChange(e.target.value as IBProgramme)}>
            {IB_PROGRAMMES.map(p => (
              <option key={p} value={p}>
                {IB_PROGRAMME_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="gradeYear">Grade / Year</label>
          <input
            id="gradeYear"
            type="text"
            placeholder="e.g. Year 11 / DP2"
            value={gradeYear}
            onChange={e => onGradeYearChange(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="expectedCount">Number of students</label>
          <input
            id="expectedCount"
            type="number"
            min={0}
            placeholder="e.g. 50"
            value={expectedStudentCount}
            onChange={e => onExpectedStudentCountChange(e.target.value)}
          />
        </div>
      </div>
      {programme === 'MYP' && (
        <p className={styles.autoSubjectNote}>
          MYP-specific criteria aren&apos;t built yet — sheets are graded with the DP-style criteria below as an approximation until MYP criteria are added.
        </p>
      )}

      <div className={styles.field}>
        <label>Coursework / Assessment Type</label>
        <div className={styles.courseworkGrid}>
          {COURSEWORK_TYPES.map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.courseworkTile} ${courseworkType === t ? styles.courseworkTileActive : ''}`}
              onClick={() => onCourseworkTypeChange(t)}
            >
              {COURSEWORK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        {showSubject && (
          <div className={styles.field}>
            <label htmlFor="subject">Subject</label>
            <div className={styles.subjectRow}>
              <SubjectIcon subject={subject} />
              <select id="subject" value={subject} onChange={e => onSubjectChange(e.target.value)}>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showLevel && (
          <div className={styles.field}>
            <label htmlFor="level">Level</label>
            <select id="level" value={level} onChange={e => onLevelChange(e.target.value as Level)}>
              <option value="SL">SL</option>
              <option value="HL">HL</option>
            </select>
          </div>
        )}
      </div>
      {showSubject && courseworkType !== 'extended-essay' && (
        <p className={styles.autoSubjectNote}>
          The uploaded sheet is checked against the subject you picked — if it looks like a different subject, it's flagged instead of graded.
        </p>
      )}
      {courseworkType === 'extended-essay' && (
        <p className={styles.autoSubjectNote}>
          Graded against the fixed Extended Essay criteria (Focus and method, Knowledge and understanding, Critical thinking, Presentation, Engagement) — the subject you pick is checked against the essay's actual content, same as other coursework types.
        </p>
      )}
      {courseworkType === 'tok' && (
        <p className={styles.autoSubjectNote}>
          Graded against TOK-specific criteria — no subject needed.
        </p>
      )}

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowseClick}
        role="button"
        tabIndex={0}
      >
        <span className={styles.dropIcon}>📎</span>
        <p>Drag &amp; drop scanned answer sheets (PDF), or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className={styles.hiddenInput}
          onChange={handleInputChange}
        />
      </div>

      <button className={styles.runBtn} onClick={onRun} disabled={!canRun}>
        {running ? 'Grading…' : 'Grade sheets'}
      </button>
      {progressLabel && <p className={styles.progress}>{progressLabel}</p>}
    </section>
  );
}
