import type { CourseworkType, FileStatus, GradingResult, Level, OcrPage } from './types';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function readJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    throw new Error(`Server returned a non-JSON response (status ${resp.status})`);
  }
}

export interface OcrFileOutcome {
  text: string;
  pages: OcrPage[];
  ocrConfidence: number | null;
}

export async function ocrFile(pdfBase64: string): Promise<OcrFileOutcome> {
  let resp: Response;
  try {
    resp = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64 })
    });
  } catch (err) {
    throw new Error(`Could not reach the OCR server: ${(err as Error).message}`);
  }

  const data = await readJson(resp);
  if (!resp.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || `OCR failed (status ${resp.status})`);
  }
  const parsed = data as { text?: string; pages?: OcrPage[]; ocrConfidence?: number | null } | null;
  if (!parsed?.text) throw new Error('OCR response did not include extracted text');
  return { text: parsed.text, pages: parsed.pages ?? [], ocrConfidence: parsed.ocrConfidence ?? null };
}

/** Prefixes every OCR'd line with a global [L#] marker so the grading model
 *  can reference exactly which line(s) an annotation applies to, without
 *  needing fuzzy text matching to re-locate it afterwards. */
export function buildLineMarkedText(pages: OcrPage[]): string {
  let index = 0;
  const pageBlocks = pages.map(page => page.lines.map(line => `[L${index++}] ${line.text}`).join('\n'));
  return pageBlocks.join('\n\n---\n\n');
}

export async function gradeText(
  markedText: string,
  courseworkType: CourseworkType,
  subject: string,
  level: Level
): Promise<GradingResult> {
  let resp: Response;
  try {
    resp = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrText: markedText, courseworkType, subject, level })
    });
  } catch (err) {
    throw new Error(`Could not reach the grading server: ${(err as Error).message}`);
  }

  const data = await readJson(resp);
  if (!resp.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || `Grading failed (status ${resp.status})`);
  }
  return data as GradingResult;
}

export interface GradeFileOutcome {
  result: GradingResult;
  ocrText: string;
  ocrPages: OcrPage[];
  ocrConfidence: number | null;
}

export async function gradeFile(
  file: File,
  courseworkType: CourseworkType,
  subject: string,
  level: Level,
  onStatusChange?: (status: FileStatus) => void
): Promise<GradeFileOutcome> {
  const pdfBase64 = await fileToBase64(file);
  onStatusChange?.('ocr-processing');
  const { text, pages, ocrConfidence } = await ocrFile(pdfBase64);
  onStatusChange?.('ocr-completed');
  const markedText = buildLineMarkedText(pages);
  onStatusChange?.('evaluating');
  const result = await gradeText(markedText, courseworkType, subject, level);
  return { result, ocrText: text, ocrPages: pages, ocrConfidence };
}
