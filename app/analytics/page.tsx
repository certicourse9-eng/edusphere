'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import styles from './analytics-page.module.css';
import analyticsStyles from '@/components/analytics/analytics.module.css';
import AnalyticsSection from '@/components/analytics/AnalyticsSection';
import KeyInsights from '@/components/analytics/KeyInsights';
import { getInsights } from '@/lib/analytics';
import { useClassSession } from '@/lib/ClassSessionContext';
import { COURSEWORK_TYPE_LABELS, IB_PROGRAMME_LABELS } from '@/lib/types';

export default function AnalyticsPage() {
  const { files, evaluatedCount, expected, programme, gradeYear, courseworkType, subject, level } = useClassSession();
  const insights = useMemo(() => getInsights(files), [files]);

  return (
    <main className="page">
      <div className={styles.headRow}>
        <Link href="/" className={styles.backLink}>
          ← Back to dashboard
        </Link>
      </div>

      <header className={styles.pageHead}>
        <h1 className={styles.pageTitle}>Class Analytics</h1>
        {files.length > 0 && (
          <p className={styles.pageMeta}>
            {subject} · {level} · {COURSEWORK_TYPE_LABELS[courseworkType]} · {IB_PROGRAMME_LABELS[programme]}
            {gradeYear ? ` · ${gradeYear}` : ''}
          </p>
        )}
      </header>

      {files.length === 0 ? (
        <section className={analyticsStyles.card}>
          <p className={analyticsStyles.emptyNote}>
            No papers uploaded yet. <Link href="/">Go back to the dashboard</Link> to upload and grade a class before viewing
            analytics.
          </p>
        </section>
      ) : (
        <>
          <KeyInsights insights={insights} />
          <AnalyticsSection files={files} evaluatedCount={evaluatedCount} expectedStudentCount={expected} />
        </>
      )}
    </main>
  );
}
