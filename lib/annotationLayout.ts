import type { Annotation, GradedQuestion, OcrPage } from './types';

export interface LineMark {
  key: string;
  /** Shared by every line belonging to the same annotation on the same page, so grouping
   *  behavior (hover state on-screen, or "draw once" in the PDF export) can act together. */
  groupKey: string;
  annotationIndex: number;
  annotation: Annotation;
  isFirstInGroup: boolean;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface ImageDims {
  w: number;
  h: number;
}

/** Resolves an annotation back to the actual raw marks it's about, via questionNumber +
 *  criterionCode - so a highlight can show real numbers, not just a reaction. */
export function resolveMark(annotation: Annotation, questions: GradedQuestion[]): { score: number; maxScore: number } | null {
  if (!annotation.criterionCode) return null;
  const question =
    annotation.questionNumber !== undefined ? questions.find(q => q.number === annotation.questionNumber) : questions[0];
  const criterion = question?.criteria.find(c => c.code === annotation.criterionCode);
  return criterion ? { score: criterion.score, maxScore: criterion.maxScore } : null;
}

/** Assigns each line across all pages the same global index buildLineMarkedText used
 *  ([L0], [L1], ...), so annotation.lineStart/lineEnd can be resolved back to (page, line)
 *  without needing to re-run any matching. Marks are computed PER LINE (never merged into one
 *  box spanning multiple lines) so each one hugs its own real text tightly - merging produced
 *  an oversized blob that could swallow whitespace or unrelated lines between the first and
 *  last line of a multi-line annotation. Percentages are relative to each page's REAL rendered
 *  image dimensions (the caller supplies these - PaddleOCR doesn't report page dimensions
 *  itself), so this same function drives both the interactive on-screen view
 *  (AnnotatedPageView) and the downloaded "corrected paper" PDF - one geometry, never two that
 *  could quietly drift apart. */
export function computePageMarks(pages: OcrPage[], annotations: Annotation[], dims: Record<number, ImageDims>): LineMark[][] {
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
