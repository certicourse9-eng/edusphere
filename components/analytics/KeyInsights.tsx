import styles from './analytics.module.css';
import insightStyles from './KeyInsights.module.css';
import type { Insight } from '@/lib/analytics';

export default function KeyInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Key insights</p>
          <p className={styles.cardSub}>Auto-generated from the numbers below - nothing here is invented</p>
        </div>
      </div>
      <ul className={insightStyles.list}>
        {insights.map((insight, i) => (
          <li key={i} className={`${insightStyles.item} ${insightStyles[insight.tone]}`}>
            <span className={insightStyles.dot} aria-hidden="true" />
            <div>
              <p className={insightStyles.label}>{insight.label}</p>
              <p className={insightStyles.detail}>{insight.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
