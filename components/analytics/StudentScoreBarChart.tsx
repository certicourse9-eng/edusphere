'use client';

import { useRef, useState } from 'react';
import styles from './analytics.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import { BAND_COLORS } from '@/lib/gradeBands';
import type { StudentScore } from '@/lib/analytics';

const BAR_W = 20;
const GAP = 6;
const STEP = BAR_W + GAP;
const PLOT_H = 190;
const PAD_LEFT = 34;
const PAD_TOP = 10;
const PAD_BOTTOM = 8;
const GRID_PCTS = [0, 25, 50, 75, 100];

export default function StudentScoreBarChart({ scores }: { scores: StudentScore[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const width = PAD_LEFT + Math.max(scores.length, 1) * STEP + GAP;
  const height = PAD_TOP + PLOT_H + PAD_BOTTOM;

  const handleEnter = (e: React.MouseEvent, s: StudentScore) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      value: `${s.score}/${s.maxScore} (${Math.round(s.pct * 100)}%)`,
      label: s.studentId,
      swatch: BAND_COLORS[s.band]
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Student score comparison</p>
          <p className={styles.cardSub}>Every graded paper, highest first &middot; full list in the Mark sheet below</p>
        </div>
      </div>

      {scores.length === 0 ? (
        <p className={styles.emptyNote}>No evaluated papers yet.</p>
      ) : (
        <div ref={containerRef} className={styles.chartBody} style={{ overflowX: 'auto' }}>
          <svg width={width} height={height} role="img" aria-label="Student score comparison bar chart">
            {GRID_PCTS.map(g => {
              const y = PAD_TOP + PLOT_H * (1 - g / 100);
              return (
                <g key={g}>
                  <line x1={PAD_LEFT} x2={width} y1={y} y2={y} className={styles.gridline} />
                  <text x={PAD_LEFT - 8} y={y} textAnchor="end" dominantBaseline="middle" className={styles.axisText}>
                    {g}%
                  </text>
                </g>
              );
            })}
            {scores.map((s, i) => {
              const barH = PLOT_H * s.pct;
              const x = PAD_LEFT + GAP + i * STEP;
              const y = PAD_TOP + PLOT_H - barH;
              return (
                <rect
                  key={s.studentId + i}
                  x={x}
                  y={y}
                  width={BAR_W}
                  height={Math.max(barH, 1)}
                  rx={4}
                  fill={BAND_COLORS[s.band]}
                  onMouseMove={e => handleEnter(e, s)}
                  onMouseLeave={() => setTip(null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </svg>
          <ChartTooltip tip={tip} />
        </div>
      )}
    </section>
  );
}
