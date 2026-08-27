'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './TeacherFeedbackBox.module.css';

interface TeacherFeedbackBoxProps {
  initialValue: string;
  onSave: (text: string) => void;
}

const DEBOUNCE_MS = 600;
const SAVED_VISIBLE_MS = 1500;

export default function TeacherFeedbackBox({ initialValue, onSave }: TeacherFeedbackBoxProps) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedRef.current) clearTimeout(savedRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave(text);
      setSaved(true);
      if (savedRef.current) clearTimeout(savedRef.current);
      savedRef.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
    }, DEBOUNCE_MS);
  };

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor="teacherFeedback">Teacher feedback</label>
        <span className={`${styles.saved} ${saved ? styles.savedVisible : ''}`}>Saved ✓</span>
      </div>
      <textarea
        id="teacherFeedback"
        rows={4}
        value={value}
        onChange={handleChange}
        placeholder="Add your own notes for this student…"
      />
    </div>
  );
}
