'use client';

import styles from './SubjectIcon.module.css';
import { SUBJECT_ICONS } from '@/lib/subjectIcons';

export default function SubjectIcon({ subject }: { subject: string }) {
  const meta = SUBJECT_ICONS[subject] ?? SUBJECT_ICONS['General / Other'];
  return (
    <span className={`${styles.icon} ${styles[meta.animation]}`} role="img" aria-label={subject}>
      {meta.emoji}
    </span>
  );
}
