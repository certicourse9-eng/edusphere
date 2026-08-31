'use client';

import { useState } from 'react';
import styles from './GradeBoundariesPanel.module.css';
import type { GradeBoundary, IBProgramme } from '@/lib/types';

const GRADES = [7, 6, 5, 4, 3, 2, 1] as const;

interface GradeBoundariesPanelProps {
  programme: IBProgramme;
  boundaries: GradeBoundary[];
  onChange: (boundaries: GradeBoundary[]) => void;
}

export default function GradeBoundariesPanel({ programme, boundaries, onChange }: GradeBoundariesPanelProps) {
  const [open, setOpen] = useState(false);
  const byGrade = new Map(boundaries.map(b => [b.grade, b.minPercent]));
  const filledCount = boundaries.length;

  const handleChange = (grade: (typeof GRADES)[number], value: string) => {
    const next = boundaries.filter(b => b.grade !== grade);
    if (value.trim() !== '') {
      const pct = Math.max(0, Math.min(100, Number(value)));
      if (!Number.isNaN(pct)) next.push({ grade, minPercent: pct });
    }
    onChange(next);
  };

  const gradeLabel = programme === 'MYP' ? 'MYP subject grade' : 'IB course grade';
  const totalLabel = programme === 'MYP' ? 'criterion total' : 'raw total';

  return (
    <section className={styles.panel}>
      <button type="button" className={styles.toggle} onClick={() => setOpen(v => !v)}>
        <span>
          Grade boundaries <span className={styles.optional}>(optional)</span>
        </span>
        <span className={styles.status}>
          {filledCount > 0 ? `${filledCount}/7 set` : 'not set'} <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.hint}>
            Real IB grade boundaries are set per subject and exam session by the IB - EduSphere never guesses them. Enter
            the minimum {totalLabel} percentage for each grade (7 highest) if you have the official boundaries for this
            session, and every student&apos;s {gradeLabel} will be computed from them. Leave blank to show only the raw
            score and percentage, with no grade.
          </p>
          <div className={styles.grid}>
            {GRADES.map(g => (
              <label key={g} className={styles.row}>
                <span className={styles.gradeLabel}>Grade {g}</span>
                <span className={styles.inputWrap}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="—"
                    value={byGrade.get(g) ?? ''}
                    onChange={e => handleChange(g, e.target.value)}
                  />
                  <span className={styles.percentSign}>%</span>
                </span>
              </label>
            ))}
          </div>
          {filledCount > 0 && filledCount < 7 && (
            <p className={styles.warnNote}>Enter all 7 grades for grades to actually show - partial boundaries aren&apos;t used yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
