import jsPDF from 'jspdf';
import { computePageMarks } from './annotationLayout';
import type { ImageDims } from './annotationLayout';
import { getEffectiveTotalScore, isScoreOverridden } from './effectiveScore';
import { computeGradeFromBoundaries } from './gradeBoundaries';
import { ANNOTATION_TYPE_LABELS } from './types';
import type { Annotation, GradeBoundary, IBProgramme, StudentFile } from './types';

const TYPE_COLOR: Record<Annotation['type'], [number, number, number]> = {
  strength: [47, 191, 113],
  weakness: [255, 107, 107],
  suggestion: [245, 166, 35],
  criterion: [76, 141, 255]
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load a page image'));
    img.src = src;
  });
}

/** Draws one OCR page's image plus its highlight annotations onto an offscreen canvas at the
 *  image's native resolution, using the SAME geometry (computePageMarks) the interactive
 *  Annotated Paper view uses - so the downloaded PDF matches what the teacher actually saw
 *  on screen, not a re-derived approximation. Returns a JPEG data URL ready for jsPDF. */
function renderAnnotatedPageToDataUrl(img: HTMLImageElement, dim: ImageDims, marks: ReturnType<typeof computePageMarks>[number]): string {
  const canvas = document.createElement('canvas');
  canvas.width = dim.w;
  canvas.height = dim.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');

  ctx.drawImage(img, 0, 0, dim.w, dim.h);
  ctx.globalCompositeOperation = 'multiply';
  marks.forEach(m => {
    const [r, g, b] = TYPE_COLOR[m.annotation.type];
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
    ctx.fillRect((m.leftPct / 100) * dim.w, (m.topPct / 100) * dim.h, (m.widthPct / 100) * dim.w, (m.heightPct / 100) * dim.h);
  });
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toDataURL('image/jpeg', 0.85);
}

/** Generates and downloads a PDF of the corrected paper: every scanned page with its
 *  highlight annotations burned in, followed by a summary page with marks obtained, criterion
 *  scores, raw total, percentage, and the IB grade (when boundaries are available) - always
 *  showing the AI's original score and the teacher's final score as two distinct numbers,
 *  never merged into one, matching the "never silently merge them" rule used everywhere else
 *  this app shows a score. */
export async function downloadCorrectedPaper(file: StudentFile, gradeBoundaries: GradeBoundary[], classProgramme: IBProgramme): Promise<void> {
  const r = file.result;
  if (!r) throw new Error('This paper has not been graded yet.');

  const programme = file.programme ?? classProgramme;
  const pages = file.ocrPages ?? [];

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  const dims: Record<number, ImageDims> = {};
  const images: (HTMLImageElement | null)[] = [];
  for (const page of pages) {
    if (!page.imageDataUrl) {
      images.push(null);
      continue;
    }
    try {
      images.push(await loadImage(page.imageDataUrl));
    } catch {
      images.push(null);
    }
  }
  images.forEach((img, i) => {
    if (img) dims[i] = { w: img.naturalWidth, h: img.naturalHeight };
  });

  const perPageMarks = computePageMarks(pages, r.annotations, dims);

  let addedPage = false;
  for (let i = 0; i < pages.length; i++) {
    const img = images[i];
    const dim = dims[i];
    if (!img || !dim) continue;

    const dataUrl = renderAnnotatedPageToDataUrl(img, dim, perPageMarks[i] ?? []);

    const labelSpace = 22;
    const availW = pageWidth - margin * 2;
    const availH = pageHeight - margin * 2 - labelSpace;
    const scale = Math.min(availW / dim.w, availH / dim.h);
    const drawW = dim.w * scale;
    const drawH = dim.h * scale;
    const x = (pageWidth - drawW) / 2;
    const y = margin + labelSpace;

    if (addedPage) pdf.addPage();
    addedPage = true;

    pdf.setFontSize(9);
    pdf.setTextColor(130);
    pdf.text(`${file.studentId || file.fileName} — Page ${i + 1} of ${pages.length}`, margin, margin + 8);
    pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
  }

  // ---- Summary page ----
  if (addedPage) pdf.addPage();
  let cursorY = margin + 10;

  const effectiveScore = getEffectiveTotalScore(file);
  const overridden = isScoreOverridden(file);
  const pct = r.maxTotal > 0 ? effectiveScore / r.maxTotal : 0;
  const grade = computeGradeFromBoundaries(pct, gradeBoundaries);
  const gradeScaleLabel = programme === 'MYP' ? 'MYP subject grade' : 'IB course grade';

  pdf.setTextColor(20);
  pdf.setFontSize(16);
  pdf.text('Evaluation summary', margin, cursorY);
  cursorY += 22;

  pdf.setFontSize(10.5);
  pdf.setTextColor(90);
  pdf.text(`Student: ${file.studentId}  |  File: ${file.fileName}  |  Subject: ${r.detectedSubject}`, margin, cursorY);
  cursorY += 24;

  const row = (label: string, value: string) => {
    pdf.setFontSize(10);
    pdf.setTextColor(110);
    pdf.text(label, margin, cursorY);
    pdf.setFontSize(12.5);
    pdf.setTextColor(20);
    pdf.text(value, margin + 190, cursorY);
    cursorY += 20;
  };

  row('Marks obtained / maximum', `${effectiveScore} / ${r.maxTotal}`);
  row('AI-suggested score', `${r.totalScore} / ${r.maxTotal}`);
  row('Teacher-approved final score', overridden ? `${effectiveScore} / ${r.maxTotal}` : 'not adjusted — AI score stands');
  row('Raw total', String(effectiveScore));
  row('Percentage', `${Math.round(pct * 100)}%`);
  row(gradeScaleLabel, grade !== null ? String(grade) : 'not available (no grade boundaries entered)');

  cursorY += 8;

  const criterionTotals = new Map<string, { code: string; name: string; score: number; maxScore: number }>();
  r.questions.forEach(q => {
    q.criteria.forEach(c => {
      const key = `${c.code}::${c.name}`;
      const entry = criterionTotals.get(key) ?? { code: c.code, name: c.name, score: 0, maxScore: 0 };
      entry.score += c.score;
      entry.maxScore += c.maxScore;
      criterionTotals.set(key, entry);
    });
  });

  if (criterionTotals.size > 0) {
    pdf.setFontSize(12);
    pdf.setTextColor(20);
    pdf.text('Criterion scores', margin, cursorY);
    cursorY += 18;
    pdf.setFontSize(10.5);
    criterionTotals.forEach(c => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin + 10;
      }
      pdf.setTextColor(20);
      pdf.text(`${c.code}: ${c.name}`, margin, cursorY);
      pdf.setTextColor(90);
      pdf.text(`${c.score}/${c.maxScore}`, margin + 260, cursorY);
      cursorY += 16;
    });
    cursorY += 10;
  }

  const annotationsByType: Record<Annotation['type'], number> = { strength: 0, weakness: 0, suggestion: 0, criterion: 0 };
  r.annotations.forEach(a => annotationsByType[a.type]++);
  const legendLine = (Object.keys(annotationsByType) as Annotation['type'][])
    .filter(t => annotationsByType[t] > 0)
    .map(t => `${ANNOTATION_TYPE_LABELS[t]}: ${annotationsByType[t]}`)
    .join('   ·   ');
  if (legendLine) {
    if (cursorY > pageHeight - margin - 20) {
      pdf.addPage();
      cursorY = margin + 10;
    }
    pdf.setFontSize(9.5);
    pdf.setTextColor(130);
    pdf.text(`Highlighted on the paper: ${legendLine}`, margin, cursorY);
    cursorY += 16;
  }

  pdf.setFontSize(8.5);
  pdf.setTextColor(150);
  pdf.text('Generated by EduSphere. AI-assisted grading — the teacher-approved score is the final, authoritative mark.', margin, pageHeight - 16);

  const safeStudentId = (file.studentId || 'student').replace(/[^a-z0-9-_]+/gi, '_');
  pdf.save(`${safeStudentId}-corrected-paper.pdf`);
}
