'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './UploadPanel.module.css';
import SubjectIcon from './SubjectIcon';
import { SUBJECTS } from '@/lib/subjectIcons';
import type { Level } from '@/lib/types';

interface UploadPanelProps {
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

        <div className={styles.field}>
          <label htmlFor="level">Level</label>
          <select id="level" value={level} onChange={e => onLevelChange(e.target.value as Level)}>
            <option value="SL">SL</option>
            <option value="HL">HL</option>
          </select>
        </div>
      </div>

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
