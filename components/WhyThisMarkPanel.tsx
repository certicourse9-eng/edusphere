'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './WhyThisMarkPanel.module.css';
import { getBand, BAND_COLORS } from '@/lib/gradeBands';
import type { GradedQuestion } from '@/lib/types';

interface WhyThisMarkPanelProps {
  question: GradedQuestion | null;
  onClose: () => void;
}

function confidenceTone(confidence: number): 'good' | 'moderate' | 'weak' {
  if (confidence >= 0.8) return 'good';
  if (confidence >= 0.5) return 'moderate';
  return 'weak';
}

export default function WhyThisMarkPanel({ question, onClose }: WhyThisMarkPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!question) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [question, onClose]);

  if (!question || !mounted) return null;

  const band = getBand(question.score, question.maxScore);
  const tone = question.confidence !== null ? confidenceTone(question.confidence) : null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.panel} fade-in`} onClick={e => e.stopPropagation()} role="dialog" aria-label={`Why this mark: Question ${question.number}`}>
        <div className={styles.head}>
          <div>
            <p className={styles.eyebrow}>Why this mark?</p>
            <h3 className={styles.title}>Question {question.number}</h3>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.awardedRow}>
          <span className={styles.awardedValue} style={{ color: BAND_COLORS[band] }}>
            {question.score}/{question.maxScore}
          </span>
          <span className={styles.awardedLabel}>awarded</span>
          {tone && (
            <span className={`${styles.confidenceBadge} ${styles[tone]}`}>
              {Math.round((question.confidence as number) * 100)}% AI confidence
            </span>
          )}
        </div>
        {tone === 'weak' && (
          <p className={styles.lowConfidenceNote}>
            ⚠ Low confidence — the OCR text for this answer may be unclear or the score borderline. Worth a closer look.
          </p>
        )}

        {question.feedback && <p className={styles.overallFeedback}>{question.feedback}</p>}

        {question.criteria.length === 0 ? (
          <p className={styles.emptyNote}>No per-criterion breakdown was recorded for this question.</p>
        ) : (
          <div className={styles.criteriaList}>
            {question.criteria.map(c => (
              <div key={c.code} className={styles.criterionCard}>
                <div className={styles.criterionHead}>
                  <span className={styles.criterionName}>
                    {c.code} · {c.name}
                  </span>
                  <span className={styles.criterionScore}>
                    {c.score}/{c.maxScore}
                  </span>
                </div>
                {c.evidence && (
                  <p className={styles.evidenceRow}>
                    <span className={`${styles.rowLabel} ${styles.evidenceLabel}`}>Evidence</span>
                    {c.evidence}
                  </p>
                )}
                {c.missing && (
                  <p className={styles.evidenceRow}>
                    <span className={`${styles.rowLabel} ${styles.missingLabel}`}>Missing</span>
                    {c.missing}
                  </p>
                )}
                {!c.evidence && !c.missing && c.comment && (
                  <p className={styles.evidenceRow}>
                    <span className={styles.rowLabel}>Note</span>
                    {c.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className={styles.footerNote}>
          AI-generated explanation, grounded in this student's actual answer. You have final say on this mark.
        </p>
      </div>
    </div>,
    document.body
  );
}
