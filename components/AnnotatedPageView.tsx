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

/** Assigns each line across all pages the same global index buildLineMarkedText
 *  used ([L0], [L1], ...), so annotation.lineStart/lineEnd can be resolved
 *  back to (page, line) without needing to re-run any matching. */
function computePageHighlights(pages: OcrPage[], annotations: Annotation[]): HighlightBox[][] {
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
      if (!page) return;
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

      // Boxes need a natural image size to convert to percentages - derived
      // from the max coordinate seen across every line on the page, padded
      // slightly, since PaddleOCR doesn't report page dimensions directly.
      const pageMaxX = Math.max(...page.lines.map(l => l.box[2]), maxX);
      const pageMaxY = Math.max(...page.lines.map(l => l.box[3]), maxY);
      const pad = 4;

      perPage[pageIndex].push({
        key: `${annotationIndex}-${pageIndex}`,
        annotation,
        leftPct: (Math.max(0, minX - pad) / pageMaxX) * 100,
        topPct: (Math.max(0, minY - pad) / pageMaxY) * 100,
        widthPct: ((maxX - minX + pad * 2) / pageMaxX) * 100,
        heightPct: ((maxY - minY + pad * 2) / pageMaxY) * 100
      });
    });
  });

  return perPage;
}

export default function AnnotatedPageView({ pages, annotations }: AnnotatedPageViewProps) {
  const [selected, setSelected] = useState<HighlightBox | null>(null);
  const perPageHighlights = useMemo(() => computePageHighlights(pages, annotations), [pages, annotations]);

  if (pages.length === 0 || pages.every(p => !p.imageDataUrl)) {
    return <p className={styles.emptyNote}>No page images available to annotate for this sheet.</p>;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>Click a highlighted section to see the feedback tied to it.</p>
      {pages.map((page, pageIndex) => {
        if (!page.imageDataUrl) return null;
        const highlights = perPageHighlights[pageIndex] || [];
        return (
          <div key={pageIndex} className={styles.pageBlock}>
            <div className={styles.pageImageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.imageDataUrl} alt={`Page ${pageIndex + 1}`} className={styles.pageImage} />
              {highlights.map(h => (
                <button
                  key={h.key}
                  type="button"
                  className={`${styles.highlight} ${styles[h.annotation.type]}`}
                  style={{ left: `${h.leftPct}%`, top: `${h.topPct}%`, width: `${h.widthPct}%`, height: `${h.heightPct}%` }}
                  onClick={() => setSelected(selected?.key === h.key ? null : h)}
                  aria-label={`${ANNOTATION_TYPE_LABELS[h.annotation.type]}: ${h.annotation.comment}`}
                />
              ))}
            </div>
            <span className={styles.pageLabel}>Page {pageIndex + 1}</span>
          </div>
        );
      })}

      {selected && (
        <div className={styles.popupOverlay} onClick={() => setSelected(null)}>
          <div className={styles.popup} onClick={e => e.stopPropagation()}>
            <div className={styles.popupHead}>
              <span className={`${styles.popupBadge} ${styles[selected.annotation.type]}`}>
                {ANNOTATION_TYPE_LABELS[selected.annotation.type]}
                {selected.annotation.criterionCode ? ` · ${selected.annotation.criterionCode}` : ''}
              </span>
              <button type="button" className={styles.popupClose} onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>
            <p className={styles.popupComment}>{selected.annotation.comment}</p>
          </div>
        </div>
      )}

      <div className={styles.legend}>
        {(['strength', 'weakness', 'suggestion', 'criterion'] as const).map(type => (
          <span key={type} className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles[type]}`} />
            {ANNOTATION_TYPE_LABELS[type]}
          </span>
        ))}
      </div>
    </div>
  );
}
