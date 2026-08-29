import styles from './analytics.module.css';

interface ProgressRingProps {
  evaluated: number;
  total: number;
}

const SIZE = 156;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function ProgressRing({ evaluated, total }: ProgressRingProps) {
  const pct = total > 0 ? Math.min(1, evaluated / total) : 0;
  const offset = CIRC * (1 - pct);
  const done = total > 0 && evaluated >= total;

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Evaluation progress</p>
          <p className={styles.cardSub}>Papers evaluated so far</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${evaluated} of ${total} papers evaluated, ${Math.round(pct * 100)} percent`}
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={done ? 'var(--green)' : 'var(--primary)'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1), stroke 300ms ease' }}
          />
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize="27" fontWeight="700" fill="var(--text)">
            {evaluated}/{total}
          </text>
          <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--text-soft)">
            {Math.round(pct * 100)}% evaluated
          </text>
        </svg>
      </div>
    </section>
  );
}
