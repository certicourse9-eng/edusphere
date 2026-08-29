'use client';

import { useRef, useState } from 'react';
import styles from './analytics.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import { BAND_LABELS, BAND_COLORS } from '@/lib/gradeBands';
import type { BandCount } from '@/lib/analytics';

const SIZE = 168;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function DonutChart({ counts }: { counts: BandCount[] }) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const handleEnter = (e: React.MouseEvent, label: string, count: number, color: string) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, value: `${count} paper${count === 1 ? '' : 's'} (${pct}%)`, label, swatch: color });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Class performance</p>
          <p className={styles.cardSub}>Graded papers by score band</p>
        </div>
      </div>

      {total === 0 ? (
        <p className={styles.emptyNote}>No evaluated papers yet.</p>
      ) : (
        <>
          <div ref={containerRef} className={styles.chartBody} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Class performance by score band">
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                {(() => {
                  let cumulative = 0;
                  return counts
                    .filter(c => c.count > 0)
                    .map(c => {
                      const pct = c.count / total;
                      const arcLen = pct * CIRC;
                      const el = (
                        <circle
                          key={c.band}
                          cx={SIZE / 2}
                          cy={SIZE / 2}
                          r={RADIUS}
                          fill="none"
                          stroke={BAND_COLORS[c.band]}
                          strokeWidth={STROKE}
                          strokeDasharray={`${arcLen} ${CIRC - arcLen}`}
                          strokeDashoffset={-cumulative}
                          onMouseMove={e => handleEnter(e, BAND_LABELS[c.band], c.count, BAND_COLORS[c.band])}
                          onMouseLeave={() => setTip(null)}
                          style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                        />
                      );
                      cumulative += arcLen;
                      return el;
                    });
                })()}
              </g>
              <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="var(--text)">
                {total}
              </text>
              <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill="var(--text-soft)">
                {total === 1 ? 'student' : 'students'}
              </text>
            </svg>
            <ChartTooltip tip={tip} />
          </div>

          <div className={styles.legend}>
            {counts.map(c => (
              <span key={c.band} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: BAND_COLORS[c.band] }} />
                {BAND_LABELS[c.band]} ({c.count})
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
