'use client';

import { useState } from 'react';
import styles from './TeacherScoreOverride.module.css';

interface TeacherScoreOverrideProps {
  aiScore: number;
  maxScore: number;
  overrideScore: number | null | undefined;
  onChange: (score: number | null) => void;
}

/** Keeps the AI's original score and the teacher's final score visibly separate at all times -
 *  never silently merges them. The AI score never changes once generated; only this override
 *  (stored apart from result.totalScore) can change what counts as "final". */
export default function TeacherScoreOverride({ aiScore, maxScore, overrideScore, onChange }: TeacherScoreOverrideProps) {
  const isOverridden = typeof overrideScore === 'number';
  const [draft, setDraft] = useState(String(isOverridden ? overrideScore : aiScore));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    const value = Number(draft);
    if (Number.isNaN(value)) return;
    const clamped = Math.max(0, Math.min(maxScore, value));
    onChange(clamped === aiScore ? null : clamped);
    setEditing(false);
  };

  const handleReset = () => {
    setDraft(String(aiScore));
    onChange(null);
    setEditing(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.label}>AI-suggested score</span>
        <span className={styles.aiValue}>
          {aiScore}/{maxScore}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Teacher-approved final score</span>
        {editing ? (
          <span className={styles.editRow}>
            <input
              type="number"
              min={0}
              max={maxScore}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className={styles.input}
              autoFocus
            />
            <span className={styles.maxLabel}>/ {maxScore}</span>
            <button type="button" className={styles.saveBtn} onClick={handleSave}>
              Save
            </button>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <span className={styles.editRow}>
            <span className={`${styles.finalValue} ${isOverridden ? styles.overridden : ''}`}>
              {isOverridden ? overrideScore : aiScore}/{maxScore}
            </span>
            <button type="button" className={styles.editBtn} onClick={() => setEditing(true)}>
              {isOverridden ? 'Edit' : 'Override'}
            </button>
            {isOverridden && (
              <button type="button" className={styles.cancelBtn} onClick={handleReset}>
                Reset to AI score
              </button>
            )}
          </span>
        )}
      </div>
      {isOverridden && !editing && (
        <p className={styles.note}>This student&apos;s final score has been adjusted by the teacher and no longer matches the AI&apos;s suggestion.</p>
      )}
    </div>
  );
}
