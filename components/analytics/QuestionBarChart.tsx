'use client';

import { useRef, useState } from 'react';
import styles from './analytics.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import { BAND_COLORS } from '@/lib/gradeBands';
import type { QuestionAverage } from '@/lib/analytics';

const ROW_H = 30;
const PAD_LEFT = 40;
const PAD_RIGHT = 56;
const PAD_TOP = 6;
const PAD_BOTTOM = 6;
const PLOT_W_MIN = 220;

export default function QuestionBarChart({ questions }: { questions: QuestionAverage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const height = PAD_TOP + questions.length * ROW_H + PAD_BOTTOM;

  const handleEnter = (e: React.MouseEvent, q: QuestionAverage) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      value: `${Math.round(q.avgPct * 100)}% average`,
      label: `Question ${q.number} · ${q.studentCount} student${q.studentCount === 1 ? '' : 's'}`,
      swatch: BAND_COLORS[q.band]
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Question-wise performance</p>
          <p className={styles.cardSub}>Class average score on each question</p>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className={styles.emptyNote}>No evaluated papers yet.</p>
      ) : (
        <div ref={containerRef} className={styles.chartBody}>
          <svg width="100%" height={height} viewBox={`0 0 400 ${height}`} preserveAspectRatio="none" role="img" aria-label="Question-wise class average performance">
            {questions.map((q, i) => {
              const rowY = PAD_TOP + i * ROW_H;
              const plotW = 400 - PAD_LEFT - PAD_RIGHT;
              const barW = Math.max(plotW * q.avgPct, 2);
              const barY = rowY + ROW_H / 2 - 8;
              return (
                <g key={q.number}>
                  <text x={PAD_LEFT - 8} y={rowY + ROW_H / 2} textAnchor="end" dominantBaseline="middle" className={styles.axisText}>
                    Q{q.number}
                  </text>
                  <rect x={PAD_LEFT} y={barY} width={plotW} height={16} rx={4} fill="var(--bg)" />
                  <rect
                    x={PAD_LEFT}
                    y={barY}
                    width={barW}
                    height={16}
                    rx={4}
                    fill={BAND_COLORS[q.band]}
                    onMouseMove={e => handleEnter(e, q)}
                    onMouseLeave={() => setTip(null)}
                    style={{ cursor: 'pointer' }}
                  />
                  <text x={PAD_LEFT + plotW + 8} y={rowY + ROW_H / 2} dominantBaseline="middle" fontSize="10.5" fontWeight={600} fill="var(--text)">
                    {Math.round(q.avgPct * 100)}%
                  </text>
                </g>
              );
            })}
          </svg>
          <ChartTooltip tip={tip} />
        </div>
      )}
    </section>
  );
}
