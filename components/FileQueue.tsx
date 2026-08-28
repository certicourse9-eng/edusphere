'use client';

import styles from './FileQueue.module.css';
import { FILE_STATUS_LABELS, PROCESSING_STATUSES } from '@/lib/types';
import type { StudentFile } from '@/lib/types';

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
              {PROCESSING_STATUSES.includes(f.status) && <span className={styles.dot} />}
              {FILE_STATUS_LABELS[f.status]}
            </span>
            <span className={styles.name} title={f.fileName}>
              {f.fileName}
            </span>
            <span className={styles.studentId}>{f.studentId}</span>
            {f.status === 'failed' && (
              <span className={styles.errorMsg} title={f.error ?? ''}>
                {f.error}
              </span>
            )}
            {f.status === 'needs-review' && f.reviewReason && (
              <span className={styles.reviewMsg} title={f.reviewReason}>
                {f.reviewReason}
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
