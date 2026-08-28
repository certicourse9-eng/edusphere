'use client';

import { useCallback, useRef, useState } from 'react';
import styles from './UploadPanel.module.css';
import type { Level } from '@/lib/types';

interface UploadPanelProps {
  level: Level;
  onLevelChange: (l: Level) => void;
  onFilesAdded: (files: File[]) => void;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
  progressLabel: string;
}

export default function UploadPanel({
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
          <label htmlFor="level">Level</label>
          <select id="level" value={level} onChange={e => onLevelChange(e.target.value as Level)}>
            <option value="SL">SL</option>
            <option value="HL">HL</option>
          </select>
        </div>
      </div>
      <p className={styles.autoSubjectNote}>
        Subject is detected automatically from each sheet&apos;s content — no need to pick one.
      </p>

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
