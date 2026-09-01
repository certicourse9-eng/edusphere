'use client';

import { useMemo, useState } from 'react';
import styles from './AnnotatedPageView.module.css';
import { ANNOTATION_TYPE_LABELS } from '@/lib/types';
import { computeGradeFromBoundaries } from '@/lib/gradeBoundaries';
import { computeEffectiveScoreFromParts } from '@/lib/effectiveScore';
import { computePageMarks, resolveMark } from '@/lib/annotationLayout';
import type { ImageDims } from '@/lib/annotationLayout';
import type { Annotation, GradeBoundary, GradedQuestion, IBProgramme, OcrPage } from '@/lib/types';

interface AnnotatedPageViewProps {
  pages: OcrPage[];
  annotations: Annotation[];
  questions: GradedQuestion[];
  totalScore: number;
  maxTotal: number;
  teacherOverrideScore?: number | null;
  teacherOverrideQuestionScores?: Record<number, number>;
  gradeBoundaries: GradeBoundary[];
  programme: IBProgramme;
}

const TYPE_ICON: Record<Annotation['type'], string> = {
  strength: '🌟',
  weakness: '💥',
  suggestion: '💡',
  criterion: '🎯'
};

/** Short reaction words the dino mascot shows next to each highlighted line - picked by
 *  annotationIndex (not random) so re-renders stay stable and there's some variety when a
 *  sheet has several annotations of the same type. */
const MASCOT_WORDS: Record<Annotation['type'], string[]> = {
  strength: ['Great!', 'Nice!', 'Awesome!', 'Well done!'],
  weakness: ['Oops!', 'Uh-oh!', 'Fix this!', 'Missed it!'],
  suggestion: ['Try this!', 'Good idea!', 'Consider this!'],
  criterion: ['Note!', 'Heads up!']
};

export default function AnnotatedPageView({
  pages,
  annotations,
  questions,
  totalScore,
  maxTotal,
  teacherOverrideScore,
  teacherOverrideQuestionScores,
  gradeBoundaries,
  programme
}: AnnotatedPageViewProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<number, ImageDims>>({});
  const perPageMarks = useMemo(() => computePageMarks(pages, annotations, dims), [pages, annotations, dims]);

  const effectiveScore = computeEffectiveScoreFromParts(totalScore, questions, teacherOverrideScore, teacherOverrideQuestionScores);
  const isOverridden = effectiveScore !== totalScore;
  const pct = maxTotal > 0 ? effectiveScore / maxTotal : 0;
  const grade = computeGradeFromBoundaries(pct, gradeBoundaries);
  const gradeScaleLabel = programme === 'MYP' ? 'MYP subject grade' : 'IB course grade';

  const criterionTotals = useMemo(() => {
    const totals = new Map<string, { code: string; name: string; score: number; maxScore: number }>();
    questions.forEach(q => {
      q.criteria.forEach(c => {
        const key = `${c.code}::${c.name}`;
        const entry = totals.get(key) ?? { code: c.code, name: c.name, score: 0, maxScore: 0 };
        entry.score += c.score;
        entry.maxScore += c.maxScore;
        totals.set(key, entry);
      });
    });
    return Array.from(totals.values());
  }, [questions]);

  if (pages.length === 0 || pages.every(p => !p.imageDataUrl)) {
    return <p className={styles.emptyNote}>No page images available to annotate for this sheet.</p>;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        <span aria-hidden="true">🦕</span> Each highlighted line has a dino reacting to it &mdash; hover it (or the
        highlight) for the full comment. Tap on touch devices.
      </p>
      {pages.map((page, pageIndex) => {
        if (!page.imageDataUrl) return null;
        const marks = perPageMarks[pageIndex] || [];
        return (
          <div key={pageIndex} className={styles.pageBlock}>
            <div className={styles.pageImageWrap}>
              <div className={styles.pageImageClip}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.imageDataUrl}
                  alt={`Page ${pageIndex + 1}`}
                  className={styles.pageImage}
                  onLoad={e => {
                    const img = e.currentTarget;
                    setDims(prev => ({ ...prev, [pageIndex]: { w: img.naturalWidth, h: img.naturalHeight } }));
                  }}
                />
              </div>
              {marks.map((m, i) => {
                const isActive = hoveredGroup === m.groupKey;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={`${styles.mark} ${styles[m.annotation.type]} ${isActive ? styles.markActive : ''}`}
                    style={{
                      left: `${m.leftPct}%`,
                      top: `${m.topPct}%`,
                      width: `${m.widthPct}%`,
                      height: `${m.heightPct}%`,
                      ['--wobble' as string]: i % 2 === 0 ? '-0.7deg' : '0.7deg'
                    }}
                    onMouseEnter={() => setHoveredGroup(m.groupKey)}
                    onMouseLeave={() => setHoveredGroup(prev => (prev === m.groupKey ? null : prev))}
                    onFocus={() => setHoveredGroup(m.groupKey)}
                    onBlur={() => setHoveredGroup(prev => (prev === m.groupKey ? null : prev))}
                    onClick={() => setHoveredGroup(prev => (prev === m.groupKey ? null : m.groupKey))}
                    aria-label={`${ANNOTATION_TYPE_LABELS[m.annotation.type]}: ${m.annotation.comment}`}
                  />
                );
              })}
              {/* Sparkle and tooltip render as siblings of the highlight buttons, NOT nested
                  inside one - a `.mark` button has opacity ~0.6-0.85 for the highlighter look,
                  and CSS opacity on a parent drags every descendant down with it, which made an
                  earlier version of the tooltip render semi-transparent (the page's own text
                  visibly showed through the "opaque" popup). */}
              {marks
                .filter(m => m.isFirstInGroup)
                .map(m => {
                  const isActive = hoveredGroup === m.groupKey;
                  const flipDown = m.topPct < 22;
                  return (
                    <div
                      key={`extras-${m.groupKey}`}
                      className={styles.markAnchor}
                      style={{ left: `${m.leftPct}%`, top: `${m.topPct}%`, width: `${m.widthPct}%`, height: `${m.heightPct}%` }}
                    >
                      <span className={styles.sparkle} aria-hidden="true">
                        ✨
                      </span>
                      {isActive && (
                        <div className={`${styles.tooltip} ${flipDown ? styles.tooltipDown : styles.tooltipUp}`}>
                          <span className={`${styles.tooltipBadge} ${styles[m.annotation.type]}`}>
                            <span aria-hidden="true">{TYPE_ICON[m.annotation.type]}</span>
                            {ANNOTATION_TYPE_LABELS[m.annotation.type]}
                            {m.annotation.criterionCode ? ` · ${m.annotation.criterionCode}` : ''}
                          </span>
                          <p className={styles.tooltipComment}>{m.annotation.comment}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              {marks
                .filter(m => m.isFirstInGroup)
                .map(m => {
                  const isActive = hoveredGroup === m.groupKey;
                  const words = MASCOT_WORDS[m.annotation.type];
                  const word = words[m.annotationIndex % words.length];
                  const mark = resolveMark(m.annotation, questions);
                  const bubbleText = mark ? `${word} ${mark.score}/${mark.maxScore}` : word;
                  // If the line runs close to the page's right edge there's no room to sit
                  // beside it without overlapping the last word - drop below the line instead.
                  const rightMargin = 100 - (m.leftPct + m.widthPct);
                  const placeBelow = rightMargin < 24;
                  const dinoLeftPct = placeBelow ? m.leftPct : Math.min(m.leftPct + m.widthPct + 2.5, 90);
                  const dinoTopPct = placeBelow ? m.topPct + m.heightPct + 1.5 : m.topPct + m.heightPct / 2;
                  return (
                    <button
                      key={`dino-${m.groupKey}`}
                      type="button"
                      className={`${styles.dino} ${styles[m.annotation.type]} ${isActive ? styles.dinoActive : ''}`}
                      style={{
                        left: `${dinoLeftPct}%`,
                        top: `${dinoTopPct}%`,
                        transform: placeBelow ? undefined : 'translateY(-50%)'
                      }}
                      onMouseEnter={() => setHoveredGroup(m.groupKey)}
                      onMouseLeave={() => setHoveredGroup(prev => (prev === m.groupKey ? null : prev))}
                      onFocus={() => setHoveredGroup(m.groupKey)}
                      onBlur={() => setHoveredGroup(prev => (prev === m.groupKey ? null : prev))}
                      onClick={() => setHoveredGroup(prev => (prev === m.groupKey ? null : m.groupKey))}
                      aria-label={`${ANNOTATION_TYPE_LABELS[m.annotation.type]} mascot: ${bubbleText}`}
                    >
                      <span className={styles.dinoInner}>
                        <span className={styles.dinoBubble}>{bubbleText}</span>
                        <span className={styles.dinoEmoji} aria-hidden="true">
                          🦕
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
            <span className={styles.pageLabel}>Page {pageIndex + 1}</span>
          </div>
        );
      })}

      <div className={styles.legend}>
        {(['strength', 'weakness', 'suggestion', 'criterion'] as const).map(type => (
          <span key={type} className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles[type]}`} />
            {TYPE_ICON[type]} {ANNOTATION_TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      <div className={styles.summary}>
        <p className={styles.summaryTitle}>Summary</p>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Marks obtained / maximum</span>
            <span className={styles.summaryValue}>
              {effectiveScore}/{maxTotal}
              {isOverridden && <span className={styles.summaryOverrideTag}>teacher-adjusted</span>}
            </span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Raw total</span>
            <span className={styles.summaryValue}>{effectiveScore}</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>Percentage</span>
            <span className={styles.summaryValue}>{Math.round(pct * 100)}%</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>{gradeScaleLabel}</span>
            <span className={styles.summaryValue}>
              {grade !== null ? grade : <span className={styles.summaryUnavailable}>not available</span>}
            </span>
          </div>
        </div>

        {criterionTotals.length > 0 && (
          <>
            <p className={styles.summarySubtitle}>Criterion scores</p>
            <div className={styles.criterionSummaryList}>
              {criterionTotals.map(c => (
                <span key={c.code + c.name} className={styles.criterionSummaryChip}>
                  <strong>{c.code}</strong> {c.name}: {c.score}/{c.maxScore}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
