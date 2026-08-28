'use client';

import { useMemo, useState } from 'react';
import styles from './AnnotatedPageView.module.css';
import { ANNOTATION_TYPE_LABELS } from '@/lib/types';
import type { Annotation, OcrPage } from '@/lib/types';

interface AnnotatedPageViewProps {
  pages: OcrPage[];
  annotations: Annotation[];
}

interface LineMark {
  key: string;
  /** Shared by every line belonging to the same annotation on the same page, so hovering
   *  any one of them (and the tooltip/sparkle/dino, which render once per group) act together. */
  groupKey: string;
  annotationIndex: number;
  annotation: Annotation;
  isFirstInGroup: boolean;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

interface ImageDims {
  w: number;
  h: number;
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

/** Assigns each line across all pages the same global index buildLineMarkedText used
 *  ([L0], [L1], ...), so annotation.lineStart/lineEnd can be resolved back to (page, line)
 *  without needing to re-run any matching. Marks are computed PER LINE (never merged into one
 *  box spanning multiple lines) so each one hugs its own real text tightly - merging produced
 *  an oversized blob that could swallow whitespace or unrelated lines between the first and
 *  last line of a multi-line annotation. Percentages are relative to each page's REAL rendered
 *  image dimensions (passed in once the <img> has loaded), since PaddleOCR doesn't report page
 *  dimensions itself. */
function computePageMarks(pages: OcrPage[], annotations: Annotation[], dims: Record<number, ImageDims>): LineMark[][] {
  const perPage: LineMark[][] = pages.map(() => []);
  let globalIndex = 0;
  const lineLocation: { pageIndex: number; lineIndex: number }[] = [];
  pages.forEach((page, pageIndex) => {
    page.lines.forEach((_, lineIndex) => {
      lineLocation[globalIndex] = { pageIndex, lineIndex };
      globalIndex++;
    });
  });

  annotations.forEach((annotation, annotationIndex) => {
    const lo = Math.min(annotation.lineStart, annotation.lineEnd);
    const hi = Math.max(annotation.lineStart, annotation.lineEnd);

    const byPage = new Map<number, number[]>();
    for (let i = lo; i <= hi; i++) {
      const loc = lineLocation[i];
      if (!loc) continue;
      if (!byPage.has(loc.pageIndex)) byPage.set(loc.pageIndex, []);
      byPage.get(loc.pageIndex)!.push(loc.lineIndex);
    }

    byPage.forEach((lineIndices, pageIndex) => {
      const page = pages[pageIndex];
      const pageDims = dims[pageIndex];
      if (!page || !pageDims) return;
      const groupKey = `${annotationIndex}-${pageIndex}`;
      const sorted = [...lineIndices].sort((a, b) => a - b);
      sorted.forEach((li, idx) => {
        const line = page.lines[li];
        if (!line) return;
        const [x1, y1, x2, y2] = line.box;
        const pad = 3;
        perPage[pageIndex].push({
          key: `${groupKey}-${li}`,
          groupKey,
          annotationIndex,
          annotation,
          isFirstInGroup: idx === 0,
          leftPct: (Math.max(0, x1 - pad) / pageDims.w) * 100,
          topPct: (Math.max(0, y1 - pad) / pageDims.h) * 100,
          widthPct: ((x2 - x1 + pad * 2) / pageDims.w) * 100,
          heightPct: ((y2 - y1 + pad * 2) / pageDims.h) * 100
        });
      });
    });
  });

  return perPage;
}

export default function AnnotatedPageView({ pages, annotations }: AnnotatedPageViewProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<number, ImageDims>>({});
  const perPageMarks = useMemo(() => computePageMarks(pages, annotations, dims), [pages, annotations, dims]);

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
                const flipDown = m.topPct < 22;
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
                  >
                    {m.isFirstInGroup && (
                      <span className={styles.sparkle} aria-hidden="true">
                        ✨
                      </span>
                    )}
                    {m.isFirstInGroup && isActive && (
                      <div className={`${styles.tooltip} ${flipDown ? styles.tooltipDown : styles.tooltipUp}`}>
                        <span className={`${styles.tooltipBadge} ${styles[m.annotation.type]}`}>
                          <span aria-hidden="true">{TYPE_ICON[m.annotation.type]}</span>
                          {ANNOTATION_TYPE_LABELS[m.annotation.type]}
                          {m.annotation.criterionCode ? ` · ${m.annotation.criterionCode}` : ''}
                        </span>
                        <p className={styles.tooltipComment}>{m.annotation.comment}</p>
                      </div>
                    )}
                  </button>
                );
              })}
              {marks
                .filter(m => m.isFirstInGroup)
                .map(m => {
                  const isActive = hoveredGroup === m.groupKey;
                  const words = MASCOT_WORDS[m.annotation.type];
                  const word = words[m.annotationIndex % words.length];
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
                      aria-label={`${ANNOTATION_TYPE_LABELS[m.annotation.type]} mascot: ${word}`}
                    >
                      <span className={styles.dinoInner}>
                        <span className={styles.dinoBubble}>{word}</span>
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
    </div>
  );
}
