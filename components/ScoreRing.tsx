'use client';

import { useEffect, useState } from 'react';
import styles from './ScoreRing.module.css';
import { BAND_COLORS, type Band } from '@/lib/gradeBands';

interface ScoreRingProps {
  score: number;
  maxScore: number;
  band: Band;
}

const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreRing({ score, maxScore, band }: ScoreRingProps) {
  const pct = maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    setAnimatedPct(0);
    const timeout = setTimeout(() => setAnimatedPct(pct), 30);
    return () => clearTimeout(timeout);
  }, [pct]);

  const offset = CIRCUMFERENCE * (1 - animatedPct);

  return (
    <div className={styles.wrap}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle className={styles.track} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} fill="none" />
        <circle
          className={styles.fill}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          stroke={BAND_COLORS[band]}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.scoreValue}>{score}</span>
        <span className={styles.scoreMax}>/ {maxScore}</span>
      </div>
    </div>
  );
}
