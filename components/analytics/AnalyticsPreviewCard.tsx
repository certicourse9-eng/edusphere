'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import styles from './AnalyticsPreviewCard.module.css';
import { getBandCounts } from '@/lib/analytics';
import { BAND_LABELS, BAND_COLORS } from '@/lib/gradeBands';
import { FINISHED_STATUSES } from '@/lib/types';
import type { StudentFile } from '@/lib/types';

interface AnalyticsPreviewCardProps {
  files: StudentFile[];
  evaluatedCount: number;
  expectedStudentCount: number;
}

export default function AnalyticsPreviewCard({ files, evaluatedCount, expectedStudentCount }: AnalyticsPreviewCardProps) {
  const bandCounts = useMemo(() => getBandCounts(files), [files]);

  if (files.length === 0) return null;

  const finished = files.filter(f => FINISHED_STATUSES.includes(f.status) && f.result);
  const totalScore = finished.reduce((s, f) => s + (f.result?.totalScore ?? 0), 0);
  const totalMax = finished.reduce((s, f) => s + (f.result?.maxTotal ?? 0), 0);
  const classAveragePct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null;
  const progressTotal = expectedStudentCount > 0 ? expectedStudentCount : files.length;

  return (
    <Link href="/analytics" className={`${styles.card} fade-in`}>
      <div className={styles.left}>
        <p className={styles.eyebrow}>Class Analytics</p>
        <h2 className={styles.title}>See the full picture</h2>
        <p className={styles.sub}>
          Score distribution, question and criteria breakdowns, student comparison, and a heatmap &mdash; all in one
          dedicated view.
        </p>
        <span className={styles.cta}>
          View full analytics <span aria-hidden="true">→</span>
        </span>
      </div>
      <div className={styles.right}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {evaluatedCount}/{progressTotal}
          </span>
          <span className={styles.statLabel}>evaluated</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{classAveragePct !== null ? `${classAveragePct}%` : '—'}</span>
          <span className={styles.statLabel}>class average</span>
        </div>
        <div className={styles.bandRow}>
          {bandCounts
            .filter(b => b.count > 0)
            .map(b => (
              <span key={b.band} className={styles.bandChip}>
                <span className={styles.bandSwatch} style={{ background: BAND_COLORS[b.band] }} />
                {b.count} {BAND_LABELS[b.band]}
              </span>
            ))}
        </div>
      </div>
    </Link>
  );
}
