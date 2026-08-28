'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './UploadPanel.module.css';
import SubjectIcon from './SubjectIcon';
import { SUBJECTS } from '@/lib/subjectIcons';
import type { CourseworkType, Level } from '@/lib/types';
import { COURSEWORK_TYPE_LABELS } from '@/lib/types';

const COURSEWORK_TYPES: CourseworkType[] = ['internal-assessment', 'extended-essay', 'tok', 'external-assessment'];

interface UploadPanelProps {
  courseworkType: CourseworkType;
  onCourseworkTypeChange: (t: CourseworkType) => void;
  subject: string;
  onSubjectChange: (s: string) => void;
  level: Level;
  onLevelChange: (l: Level) => void;
  onFilesAdded: (files: File[]) => void;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
  progressLabel: string;
}

export default function UploadPanel({
  courseworkType,
  onCourseworkTypeChange,
  subject,
  onSubjectChange,
  level,
  onLevelChange,
  onFilesAdded,
  onRun,
  running,
  canRun,
  progressLabel
}: UploadPanelProps) {
  const showSubject = courseworkType !== 'tok';
  const showLevel = courseworkType === 'internal-assessment' || courseworkType === 'external-assessment';
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
      <div className={styles.field}>
        <label>Coursework type</label>
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
