'use client';

import { useRef, useState } from 'react';
import styles from './analytics.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import type { CriterionAverage } from '@/lib/analytics';

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 92;
const RINGS = [0.25, 0.5, 0.75, 1];

function vertex(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index / count) * 2 * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

export default function CriteriaRadarChart({ criteria }: { criteria: CriterionAverage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [showTable, setShowTable] = useState(false);
  const n = criteria.length;

  const handleEnter = (e: React.MouseEvent, c: CriterionAverage) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, value: `${Math.round(c.avgPct * 100)}% average`, label: `${c.code} · ${c.name}`, swatch: 'var(--primary)' });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Assessment criteria performance</p>
          <p className={styles.cardSub}>Class average by IB criterion, across every question</p>
        </div>
        {n >= 3 && (
          <button type="button" className={styles.tableToggle} onClick={() => setShowTable(v => !v)}>
            {showTable ? 'Hide table' : 'View as table'}
          </button>
        )}
      </div>

      {n < 3 ? (
        <p className={styles.emptyNote}>Not enough distinct criteria graded yet to plot a radar.</p>
      ) : showTable ? (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map(c => (
              <tr key={c.code + c.name}>
                <td>
                  {c.code} · {c.name}
                </td>
                <td>{Math.round(c.avgPct * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={containerRef} className={styles.chartBody} style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Assessment criteria radar chart">
            {RINGS.map(r => (
              <polygon
                key={r}
                points={Array.from({ length: n }, (_, i) => vertex(i, n, MAX_R * r)).map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                className={styles.gridline}
              />
            ))}
            {criteria.map((c, i) => {
              const outer = vertex(i, n, MAX_R);
              return <line key={c.code} x1={CX} y1={CY} x2={outer.x} y2={outer.y} className={styles.gridline} />;
            })}

            <polygon
              points={criteria.map((c, i) => { const p = vertex(i, n, MAX_R * c.avgPct); return `${p.x},${p.y}`; }).join(' ')}
              fill="var(--primary)"
              fillOpacity={0.14}
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {criteria.map((c, i) => {
              const p = vertex(i, n, MAX_R * c.avgPct);
              return (
                <circle
                  key={c.code}
                  cx={p.x}
                  cy={p.y}
                  r={4.5}
                  fill="var(--primary)"
                  stroke="var(--panel)"
                  strokeWidth={2}
                  onMouseMove={e => handleEnter(e, c)}
                  onMouseLeave={() => setTip(null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {criteria.map((c, i) => {
              const p = vertex(i, n, MAX_R + 16);
              return (
                <text key={c.code} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className={styles.axisText} fontWeight={700}>
                  {c.code}
                </text>
              );
            })}
          </svg>
          <ChartTooltip tip={tip} />
        </div>
      )}
    </section>
  );
}
