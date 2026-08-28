import type { GradingResult, Level } from './types';

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

export async function ocrFile(pdfBase64: string): Promise<string> {
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
  const text = (data as { text?: string } | null)?.text;
  if (!text) throw new Error('OCR response did not include extracted text');
  return text;
}

export async function gradeText(ocrText: string, subject: string, level: Level): Promise<GradingResult> {
  let resp: Response;
  try {
    resp = await fetch('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrText, subject, level })
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
}

export async function gradeFile(
  file: File,
  subject: string,
  level: Level,
  onOcrStart?: () => void
): Promise<GradeFileOutcome> {
  const pdfBase64 = await fileToBase64(file);
  onOcrStart?.();
  const ocrText = await ocrFile(pdfBase64);
  const result = await gradeText(ocrText, subject, level);
  return { result, ocrText };
}
