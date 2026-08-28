import { NextRequest, NextResponse } from 'next/server';
import { buildSubjectDetectionPrompt, buildTextGradingPrompt } from '@/lib/prompt';
import { parseGradingResponse } from '@/lib/parseGradingResponse';
import { SUBJECTS } from '@/lib/subjectIcons';

const GENERAL_SUBJECT = 'General / Other';
const DETECTABLE_SUBJECTS = SUBJECTS.filter(s => s !== GENERAL_SUBJECT);

interface GradeRequestBody {
  ocrText?: string;
  level?: string;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

async function callGroq(apiKey: string, model: string, prompt: string, jsonMode: boolean): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      })
    });
  } catch (err) {
    throw new Error(`Could not reach Groq API: ${(err as Error).message}`);
  }

  let data: GroqResponse;
  try {
    data = await resp.json();
  } catch {
    throw new Error(`Groq API returned a non-JSON response (status ${resp.status})`);
  }

  if (!resp.ok) {
    throw new Error(data.error?.message || `Groq API error (status ${resp.status})`);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API response had no text content');
  }
  return text;
}

function normalizeDetectedSubject(raw: string): string {
  const cleaned = raw.trim().replace(/^["'.\s]+|["'.\s]+$/g, '');
  const match = SUBJECTS.find(s => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? GENERAL_SUBJECT;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server is missing GROQ_API_KEY' }, { status: 500 });
  }
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  let body: GradeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { ocrText, level } = body;
  if (!ocrText || typeof ocrText !== 'string') {
    return NextResponse.json({ error: 'Request body must include an "ocrText" string' }, { status: 400 });
  }
  if (!level) {
    return NextResponse.json({ error: 'Request body must include "level"' }, { status: 400 });
  }

  let detectedSubject: string;
  try {
    const detectionPrompt = buildSubjectDetectionPrompt(ocrText, DETECTABLE_SUBJECTS);
    const rawDetected = await callGroq(apiKey, model, detectionPrompt, false);
    detectedSubject = normalizeDetectedSubject(rawDetected);
  } catch (err) {
    // Subject detection is a best-effort step - fall back to General rather
    // than failing the whole grading pass if only this call breaks.
    detectedSubject = GENERAL_SUBJECT;
  }

  const gradingPrompt = buildTextGradingPrompt(detectedSubject, level, ocrText);

  let text: string;
  try {
    text = await callGroq(apiKey, model, gradingPrompt, true);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  try {
    const result = parseGradingResponse(text, detectedSubject);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
