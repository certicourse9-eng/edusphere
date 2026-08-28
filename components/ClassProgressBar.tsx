'use client';

import styles from './ClassProgressBar.module.css';

interface ClassProgressBarProps {
  expected: number;
  uploaded: number;
  evaluated: number;
  approved: number;
  processing: number;
  pending: number;
  needsReview: number;
  failed: number;
}

export default function ClassProgressBar({
  expected,
  uploaded,
  evaluated,
  approved,
  processing,
  pending,
  needsReview,
  failed
}: ClassProgressBarProps) {
  const finished = evaluated + needsReview + failed; // evaluated already includes approved
  const pct = uploaded > 0 ? Math.round((finished / uploaded) * 100) : 0;
  const complete = uploaded > 0 && finished === uploaded;

  return (
    <section className={`${styles.panel} fade-in`}>
      <div className={styles.headRow}>
        <h2>Class evaluation progress</h2>
        <span className={`${styles.completeBadge} ${complete ? styles.completeBadgeDone : ''}`}>
          {complete ? 'All papers processed' : 'In progress'}
        </span>
      </div>

      <div className={styles.progressLine}>
        <span className={styles.progressText}>
          {finished} / {uploaded} papers evaluated — {pct}% complete
        </span>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={styles.statsGrid}>
        {expected > 0 && <Stat label="Total Students" value={String(expected)} />}
        <Stat label="Papers Uploaded" value={String(uploaded)} />
        <Stat label="Evaluated" value={String(evaluated)} tone="good" />
        <Stat label="Teacher Approved" value={String(approved)} tone="good" />
        <Stat label="Processing" value={String(processing)} tone="active" />
        <Stat label="Pending" value={String(pending)} />
        <Stat label="Needs Review" value={String(needsReview)} tone={needsReview > 0 ? 'warn' : undefined} />
        <Stat label="Failed" value={String(failed)} tone={failed > 0 ? 'bad' : undefined} />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'active' }) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
