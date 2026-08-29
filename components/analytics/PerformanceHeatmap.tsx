'use client';

import { useRef, useState } from 'react';
import styles from './analytics.module.css';
import heatStyles from './PerformanceHeatmap.module.css';
import ChartTooltip, { type TooltipState } from './ChartTooltip';
import type { HeatmapData } from '@/lib/analytics';

/** Sequential single-hue ramp (light -> dark blue), matching the "one hue for magnitude"
 *  rule - low scores recede toward the surface, high scores go dark, nothing changes hue. */
const RAMP_LOW: [number, number, number] = [205, 226, 251]; // #cde2fb
const RAMP_HIGH: [number, number, number] = [13, 54, 107]; // #0d366b

function cellColor(pct: number | null): string {
  if (pct === null) return 'var(--bg)';
  const t = Math.max(0, Math.min(1, pct));
  const [r1, g1, b1] = RAMP_LOW;
  const [r2, g2, b2] = RAMP_HIGH;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function cellTextColor(pct: number | null): string {
  if (pct === null) return 'var(--text-soft)';
  // Perceived luminance of the interpolated fill - pick white or ink so the value clears contrast.
  const t = Math.max(0, Math.min(1, pct));
  const lum = (1 - t) * 0.85 + t * 0.15;
  return lum > 0.5 ? '#0b0b0b' : '#ffffff';
}

export default function PerformanceHeatmap({ data }: { data: HeatmapData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [showValues, setShowValues] = useState(false);
  const { studentIds, questionNumbers, cells } = data;

  const cellFor = (studentId: string, qn: number) => cells.find(c => c.studentId === studentId && c.questionNumber === qn) ?? null;

  const handleEnter = (e: React.MouseEvent, studentId: string, qn: number, pct: number | null) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      value: pct === null ? 'No answer for this question' : `${Math.round(pct * 100)}%`,
      label: `${studentId} · Q${qn}`,
      swatch: pct === null ? 'var(--line)' : cellColor(pct)
    });
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>Question performance across students</p>
          <p className={styles.cardSub}>Darker = higher score · hover any cell for the exact value</p>
        </div>
        {studentIds.length > 0 && (
          <button type="button" className={styles.tableToggle} onClick={() => setShowValues(v => !v)}>
            {showValues ? 'Hide values' : 'Show values'}
          </button>
        )}
      </div>

      {studentIds.length === 0 || questionNumbers.length === 0 ? (
        <p className={styles.emptyNote}>No evaluated papers yet.</p>
      ) : (
        <div ref={containerRef} className={heatStyles.scrollWrap}>
          <table className={heatStyles.heatTable}>
            <thead>
              <tr>
                <th className={heatStyles.cornerCell} />
                {questionNumbers.map(qn => (
                  <th key={qn} className={heatStyles.colHead}>
                    Q{qn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentIds.map(sid => (
                <tr key={sid}>
                  <th className={heatStyles.rowHead}>{sid}</th>
                  {questionNumbers.map(qn => {
                    const cell = cellFor(sid, qn);
                    const pct = cell?.pct ?? null;
                    return (
                      <td
                        key={qn}
                        className={heatStyles.cell}
                        style={{ background: cellColor(pct) }}
                        onMouseMove={e => handleEnter(e, sid, qn, pct)}
                        onMouseLeave={() => setTip(null)}
                      >
                        {showValues && (
                          <span style={{ color: cellTextColor(pct) }}>{pct === null ? '—' : Math.round(pct * 100)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <ChartTooltip tip={tip} />
        </div>
      )}
    </section>
  );
}
