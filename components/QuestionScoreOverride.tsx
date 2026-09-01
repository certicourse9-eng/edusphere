'use client';

import { useState } from 'react';
import styles from './QuestionScoreOverride.module.css';

interface QuestionScoreOverrideProps {
  aiScore: number;
  maxScore: number;
  overrideScore: number | undefined;
  onChange: (score: number | null) => void;
}

/** Compact per-question sibling of TeacherScoreOverride, for correcting one question's mark
 *  inline in the Questions tab rather than only the whole paper's total. */
export default function QuestionScoreOverride({ aiScore, maxScore, overrideScore, onChange }: QuestionScoreOverrideProps) {
  const isOverridden = typeof overrideScore === 'number';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(isOverridden ? overrideScore : aiScore));

  const startEditing = () => {
    setDraft(String(isOverridden ? overrideScore : aiScore));
    setEditing(true);
  };

  const handleSave = () => {
    const value = Number(draft);
    if (Number.isNaN(value)) return;
    const clamped = Math.max(0, Math.min(maxScore, value));
    onChange(clamped === aiScore ? null : clamped);
    setEditing(false);
  };

  const handleReset = () => {
    onChange(null);
    setEditing(false);
  };

  if (editing) {
    return (
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
    );
  }

  return (
    <span className={styles.row}>
      <button type="button" className={styles.editBtn} onClick={startEditing}>
        {isOverridden ? 'Edit mark' : 'Edit'}
      </button>
      {isOverridden && (
        <>
          <span className={styles.overrideNote}>
            Teacher: {overrideScore}/{maxScore} <span className={styles.aiNote}>(AI: {aiScore}/{maxScore})</span>
          </span>
          <button type="button" className={styles.resetBtn} onClick={handleReset}>
            Reset
          </button>
        </>
      )}
    </span>
  );
}
