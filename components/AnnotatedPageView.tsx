'use client';

import { useMemo, useState } from 'react';
import styles from './AnnotatedPageView.module.css';
import { ANNOTATION_TYPE_LABELS } from '@/lib/types';
import type { Annotation, OcrPage } from '@/lib/types';

interface AnnotatedPageViewProps {
  pages: OcrPage[];
  annotations: Annotation[];
}

interface HighlightBox {
  key: string;
  annotation: Annotation;
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

/** Assigns each line across all pages the same global index buildLineMarkedText used
 *  ([L0], [L1], ...), so annotation.lineStart/lineEnd can be resolved back to (page, line)
 *  without needing to re-run any matching. Highlight boxes are expressed as percentages of
 *  each page's REAL rendered image dimensions (passed in once the <img> has loaded) - PaddleOCR
 *  doesn't report page dimensions, so falling back to "furthest text extent seen" instead of the
 *  real image size (an earlier version of this) drifts whenever text doesn't reach the margins. */
function computePageHighlights(pages: OcrPage[], annotations: Annotation[], dims: Record<number, ImageDims>): HighlightBox[][] {
  const perPage: HighlightBox[][] = pages.map(() => []);
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

    // Group the annotation's constituent lines by the page they fall on,
    // since an annotation could (rarely) span a page break.
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
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      lineIndices.forEach(li => {
        const line = page.lines[li];
        if (!line) return;
        const [x1, y1, x2, y2] = line.box;
        minX = Math.min(minX, x1);
        minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2);
        maxY = Math.max(maxY, y2);
      });
      if (!Number.isFinite(minX)) return;

      const pad = 5;
      perPage[pageIndex].push({
        key: `${annotationIndex}-${pageIndex}`,
        annotation,
        leftPct: (Math.max(0, minX - pad) / pageDims.w) * 100,
        topPct: (Math.max(0, minY - pad) / pageDims.h) * 100,
        widthPct: ((maxX - minX + pad * 2) / pageDims.w) * 100,
        heightPct: ((maxY - minY + pad * 2) / pageDims.h) * 100
      });
    });
  });

  return perPage;
}

export default function AnnotatedPageView({ pages, annotations }: AnnotatedPageViewProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<number, ImageDims>>({});
  const perPageHighlights = useMemo(() => computePageHighlights(pages, annotations, dims), [pages, annotations, dims]);

  if (pages.length === 0 || pages.every(p => !p.imageDataUrl)) {
    return <p className={styles.emptyNote}>No page images available to annotate for this sheet.</p>;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        <span aria-hidden="true">✨</span> Hover a highlighted section to see the feedback tied to it &mdash; tap it on touch
        devices.
      </p>
      {pages.map((page, pageIndex) => {
        if (!page.imageDataUrl) return null;
        const highlights = perPageHighlights[pageIndex] || [];
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
              {highlights.map((h, i) => {
                const isHovered = hoveredKey === h.key;
                const flipDown = h.topPct < 22;
                return (
                  <button
                    key={h.key}
                    type="button"
                    className={`${styles.highlight} ${styles[h.annotation.type]} ${isHovered ? styles.highlightActive : ''}`}
                    style={{
                      left: `${h.leftPct}%`,
                      top: `${h.topPct}%`,
                      width: `${h.widthPct}%`,
                      height: `${h.heightPct}%`,
                      ['--wobble' as string]: i % 2 === 0 ? '-0.6deg' : '0.6deg',
                      ['--sparkleDelay' as string]: `${(i % 5) * 0.35}s`
                    }}
                    onMouseEnter={() => setHoveredKey(h.key)}
                    onMouseLeave={() => setHoveredKey(prev => (prev === h.key ? null : prev))}
                    onFocus={() => setHoveredKey(h.key)}
                    onBlur={() => setHoveredKey(prev => (prev === h.key ? null : prev))}
                    onClick={() => setHoveredKey(prev => (prev === h.key ? null : h.key))}
                    aria-label={`${ANNOTATION_TYPE_LABELS[h.annotation.type]}: ${h.annotation.comment}`}
                  >
                    <span className={styles.sparkle} aria-hidden="true">
                      ✨
                    </span>
                    {isHovered && (
                      <div className={`${styles.tooltip} ${flipDown ? styles.tooltipDown : styles.tooltipUp}`}>
                        <span className={`${styles.tooltipBadge} ${styles[h.annotation.type]}`}>
                          <span aria-hidden="true">{TYPE_ICON[h.annotation.type]}</span>
                          {ANNOTATION_TYPE_LABELS[h.annotation.type]}
                          {h.annotation.criterionCode ? ` · ${h.annotation.criterionCode}` : ''}
                        </span>
                        <p className={styles.tooltipComment}>{h.annotation.comment}</p>
                      </div>
                    )}
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
