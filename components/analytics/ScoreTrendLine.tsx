'use client';

import { useMemo, useRef, useState } from 'react';
import styles from './analytics.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import type { QuestionAverage } from '@/lib/analytics';

const VB_W = 400;
const VB_H = 190;
const PAD_LEFT = 34;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const GRID_PCTS = [0, 25, 50, 75, 100];

export default function ScoreTrendLine({ questions }: { questions: QuestionAverage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = VB_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VB_H - PAD_TOP - PAD_BOTTOM;

  const points = useMemo(
    () =>
      questions.map((q, i) => {
        const x = questions.length > 1 ? PAD_LEFT + (i / (questions.length - 1)) * plotW : PAD_LEFT + plotW / 2;
        const y = PAD_TOP + plotH * (1 - q.avgPct);
        return { x, y, q };
      }),
    [questions, plotW, plotH]
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${PAD_TOP + plotH} L ${points[0].x} ${PAD_TOP + plotH} Z` : '';

  const handleMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VB_W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  let tip: TooltipState | null = null;
  if (hovered) {
    const box = containerRef.current?.getBoundingClientRect();
    const svg = svgRef.current;
    if (box && svg) {
      const svgBox = svg.getBoundingClientRect();
      const px = svgBox.left - box.left + (hovered.x / VB_W) * svgBox.width;
      const py = svgBox.top - box.top + (hovered.y / VB_H) * svgBox.height;
      tip = {
        x: px,
        y: py,
        value: `${Math.round(hovered.q.avgPct * 100)}% average`,
        label: `Question ${hovered.q.number}`,
        swatch: 'var(--primary)'
      };
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Score trend across the paper</p>
          <p className={styles.cardSub}>Class average, question by question in order</p>
        </div>
      </div>

      {questions.length === 0 ? (
        <p className={styles.emptyNote}>No evaluated papers yet.</p>
      ) : (
        <div ref={containerRef} className={styles.chartBody}>
          <svg
            ref={svgRef}
            width="100%"
            height={VB_H}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Class average score trend across questions"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {GRID_PCTS.map(g => {
              const y = PAD_TOP + plotH * (1 - g / 100);
              return (
                <g key={g}>
                  <line x1={PAD_LEFT} x2={VB_W - PAD_RIGHT} y1={y} y2={y} className={styles.gridline} />
                  <text x={PAD_LEFT - 8} y={y} textAnchor="end" dominantBaseline="middle" className={styles.axisText}>
                    {g}%
                  </text>
                </g>
              );
            })}
            {questions.map((q, i) => (
              <text
                key={q.number}
                x={points[i].x}
                y={VB_H - 4}
                textAnchor="middle"
                className={styles.axisText}
              >
                Q{q.number}
              </text>
            ))}

            <path d={areaPath} fill="var(--primary)" opacity={0.1} stroke="none" />
            <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {hoverIndex !== null && (
              <line
                x1={points[hoverIndex].x}
                x2={points[hoverIndex].x}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                stroke="var(--line)"
                strokeWidth={1}
              />
            )}
            {points.map((p, i) => (
              <circle
                key={p.q.number}
                cx={p.x}
                cy={p.y}
                r={hoverIndex === i ? 5 : 4}
                fill="var(--primary)"
                stroke="var(--panel)"
                strokeWidth={2}
              />
            ))}
          </svg>
          <ChartTooltip tip={tip} />
        </div>
      )}
    </section>
  );
}
