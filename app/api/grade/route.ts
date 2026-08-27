import { NextRequest, NextResponse } from 'next/server';
import { buildTextGradingPrompt } from '@/lib/prompt';
import { parseGradingResponse } from '@/lib/parseGradingResponse';

interface GradeRequestBody {
  ocrText?: string;
  subject?: string;
  level?: string;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
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

  const { ocrText, subject, level } = body;
  if (!ocrText || typeof ocrText !== 'string') {
    return NextResponse.json({ error: 'Request body must include an "ocrText" string' }, { status: 400 });
  }
  if (!subject || !level) {
    return NextResponse.json({ error: 'Request body must include "subject" and "level"' }, { status: 400 });
  }

  const prompt = buildTextGradingPrompt(subject, level, ocrText);

  let groqResp: Response;
  try {
    groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
  } catch (err) {
    return NextResponse.json({ error: `Could not reach Groq API: ${(err as Error).message}` }, { status: 502 });
  }

  let data: GroqResponse;
  try {
    data = await groqResp.json();
  } catch {
    return NextResponse.json(
      { error: `Groq API returned a non-JSON response (status ${groqResp.status})` },
      { status: 502 }
    );
  }

  if (!groqResp.ok) {
    return NextResponse.json(
      { error: data.error?.message || `Groq API error (status ${groqResp.status})` },
      { status: groqResp.status }
    );
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    return NextResponse.json({ error: 'Groq API response had no text content' }, { status: 502 });
  }

  try {
    const result = parseGradingResponse(text);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
