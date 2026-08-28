import { NextRequest, NextResponse } from 'next/server';
import type { OcrLine, OcrPage } from '@/lib/types';

const JOB_URL = 'https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';
const MODEL = 'PP-OCRv6';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface OcrRequestBody {
  pdfBase64?: string;
}

interface SubmitJobResponse {
  data?: { jobId?: string };
  message?: string;
  errorMsg?: string;
}

interface JobStatusResponse {
  data?: {
    state?: 'pending' | 'running' | 'done' | 'failed';
    errorMsg?: string;
    resultUrl?: { jsonUrl?: string };
  };
  message?: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** PaddleX's per-page OCR result nests recognized lines under prunedResult:
 *  rec_texts[i] is the text of line i, rec_boxes[i] is its [x1,y1,x2,y2] pixel
 *  box on the page image at inputImage - confirmed against a live response
 *  (submitted a real PDF and inspected the raw JSON), not just inferred. */
function extractPageLines(ocrResult: unknown): { lines: OcrLine[]; imageUrl: string | null } | null {
  if (!ocrResult || typeof ocrResult !== 'object') return null;
  const record = ocrResult as Record<string, unknown>;
  const pruned = record.prunedResult;
  if (!pruned || typeof pruned !== 'object') return null;
  const prunedRecord = pruned as Record<string, unknown>;
  const recTexts = prunedRecord.rec_texts;
  const recBoxes = prunedRecord.rec_boxes;
  if (!Array.isArray(recTexts) || !Array.isArray(recBoxes)) return null;

  const lines: OcrLine[] = [];
  for (let i = 0; i < recTexts.length; i++) {
    const text = recTexts[i];
    const box = recBoxes[i];
    if (typeof text !== 'string' || !text.length) continue;
    if (!Array.isArray(box) || box.length !== 4 || box.some(n => typeof n !== 'number')) continue;
    lines.push({ text, box: box as [number, number, number, number] });
  }
  if (lines.length === 0) return null;

  const imageUrl = typeof record.inputImage === 'string' ? record.inputImage : null;
  return { lines, imageUrl };
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await resp.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.PADDLEOCR_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Server is missing PADDLEOCR_ACCESS_TOKEN' }, { status: 500 });
  }

  let body: OcrRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pdfBase64 } = body;
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return NextResponse.json({ error: 'Request body must include a base64 "pdfBase64" string' }, { status: 400 });
  }

  const authHeader = { Authorization: `bearer ${token}` };

  // 1. Submit the job (multipart, local-file mode)
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = Buffer.from(pdfBase64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Could not decode base64 PDF' }, { status: 400 });
  }

  const form = new FormData();
  form.append('model', MODEL);
  form.append(
    'optionalPayload',
    JSON.stringify({ useDocOrientationClassify: false, useDocUnwarping: false, useTextlineOrientation: false })
  );
  form.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), 'sheet.pdf');

  let submitResp: Response;
  try {
    submitResp = await fetch(JOB_URL, { method: 'POST', headers: authHeader, body: form });
  } catch (err) {
    return NextResponse.json({ error: `Could not reach PaddleOCR: ${(err as Error).message}` }, { status: 502 });
  }

  let submitData: SubmitJobResponse;
  try {
    submitData = await submitResp.json();
  } catch {
    return NextResponse.json({ error: 'PaddleOCR job submission returned a non-JSON response' }, { status: 502 });
  }

  if (!submitResp.ok) {
    return NextResponse.json(
      { error: submitData.message || submitData.errorMsg || `PaddleOCR job submission failed (status ${submitResp.status})` },
      { status: 502 }
    );
  }

  const jobId = submitData.data?.jobId;
  if (!jobId) {
    return NextResponse.json({ error: 'PaddleOCR response did not include a jobId' }, { status: 502 });
  }

  // 2. Poll until done / failed / timeout
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let resultJsonUrl: string | undefined;

  while (Date.now() < deadline) {
    let pollResp: Response;
    try {
      pollResp = await fetch(`${JOB_URL}/${jobId}`, { headers: authHeader });
    } catch (err) {
      return NextResponse.json({ error: `Could not poll PaddleOCR job: ${(err as Error).message}` }, { status: 502 });
    }

    let pollData: JobStatusResponse;
    try {
      pollData = await pollResp.json();
    } catch {
      return NextResponse.json({ error: 'PaddleOCR job status returned a non-JSON response' }, { status: 502 });
    }

    if (!pollResp.ok) {
      return NextResponse.json(
        { error: pollData.message || `PaddleOCR job status check failed (status ${pollResp.status})` },
        { status: 502 }
      );
    }

    const state = pollData.data?.state;
    if (state === 'done') {
      resultJsonUrl = pollData.data?.resultUrl?.jsonUrl;
      break;
    }
    if (state === 'failed') {
      return NextResponse.json({ error: pollData.data?.errorMsg || 'PaddleOCR job failed' }, { status: 502 });
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (!resultJsonUrl) {
    return NextResponse.json({ error: 'Timed out waiting for PaddleOCR job to complete' }, { status: 504 });
  }

  // 3. Fetch and parse the JSONL result
  let jsonlResp: Response;
  try {
    jsonlResp = await fetch(resultJsonUrl);
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch PaddleOCR result: ${(err as Error).message}` }, { status: 502 });
  }
  if (!jsonlResp.ok) {
    return NextResponse.json({ error: `Could not fetch PaddleOCR result (status ${jsonlResp.status})` }, { status: 502 });
  }

  const jsonlText = await jsonlResp.text();
  const pageResults: { lines: OcrLine[]; imageUrl: string | null }[] = [];

  for (const line of jsonlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const ocrResults = (parsed as { result?: { ocrResults?: unknown[] } })?.result?.ocrResults;
    if (!Array.isArray(ocrResults)) continue;
    for (const res of ocrResults) {
      const pageData = extractPageLines(res);
      if (pageData) pageResults.push(pageData);
    }
  }

  if (pageResults.length === 0) {
    return NextResponse.json(
      { error: 'PaddleOCR job completed but no recognized text (rec_texts/rec_boxes) was found in the result — the response shape may differ from what app/api/ocr/route.ts expects.' },
      { status: 502 }
    );
  }

  // Download each page's rendered image so it can be displayed later without
  // depending on PaddleOCR's signed URL, which may expire.
  const pages: OcrPage[] = [];
  for (const { lines, imageUrl } of pageResults) {
    const imageDataUrl = imageUrl ? await fetchAsDataUrl(imageUrl) : null;
    pages.push({ imageDataUrl: imageDataUrl ?? '', lines });
  }

  const text = pages.map(p => p.lines.map(l => l.text).join('\n')).join('\n\n---\n\n');
  if (!text) {
    return NextResponse.json({ error: 'PaddleOCR extracted pages but no line text was present' }, { status: 502 });
  }

  return NextResponse.json({ text, pages }, { status: 200 });
}
