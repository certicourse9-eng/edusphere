'use client';

import styles from './FileQueue.module.css';
import type { StudentFile } from '@/lib/types';

const STATUS_LABEL: Record<StudentFile['status'], string> = {
  queued: 'Queued',
  ocr: 'Extracting text…',
  processing: 'Processing…',
  done: 'Done',
  error: 'Error'
};

interface FileQueueProps {
  files: StudentFile[];
  onRemove: (id: string) => void;
}

export default function FileQueue({ files, onRemove }: FileQueueProps) {
  if (files.length === 0) return null;

  return (
    <section className={`${styles.panel} fade-in`}>
      <h2>Queue</h2>
      <ul className={styles.list}>
        {files.map(f => (
          <li key={f.id} className={styles.row}>
            <span className={`${styles.badge} ${styles[f.status]}`}>
              {(f.status === 'ocr' || f.status === 'processing') && <span className={styles.dot} />}
              {STATUS_LABEL[f.status]}
            </span>
            <span className={styles.name} title={f.fileName}>
              {f.fileName}
            </span>
            <span className={styles.studentId}>{f.studentId}</span>
            {f.status === 'error' && (
              <span className={styles.errorMsg} title={f.error ?? ''}>
                {f.error}
              </span>
            )}
            <button className={styles.removeBtn} onClick={() => onRemove(f.id)} aria-label="Remove">
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
