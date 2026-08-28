import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages?: unknown;
  context?: unknown;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

const SYSTEM_PROMPT = `You are the "IB Teaching Assistant", a helpful chatbot embedded inside EduSphere - a platform teachers use to grade scanned IB Diploma Programme (DP) and Middle Years Programme (MYP) student answer sheets. EduSphere's pipeline: a teacher sets up a class (programme, subject, level, coursework/assessment type), uploads scanned PDFs, PaddleOCR extracts the text, an AI model grades each paper against subject-specific criteria, and the teacher reviews/approves the result.

You help teachers with things like:
- Explaining how EduSphere's evaluation pipeline works
- Explaining IB concepts in general: DP vs MYP, assessment types (Exam/External Assessment, Internal Assessment, Extended Essay, TOK essay/exhibition), and how marking criteria/rubrics generally work in the IB
- Helping a teacher understand a SPECIFIC student's AI-generated evaluation (why a mark was given, what the feedback means)
- Suggesting improvements to feedback wording
- Explaining class performance and question-wise trends
- Helping teachers navigate and use EduSphere's own features

STRICT RULES - follow these exactly:
1. For anything about THIS class, THIS student, THIS score, or THIS feedback, use ONLY the CURRENT CONTEXT DATA block below. Never invent, guess, or estimate a mark, criterion, question, student detail, or class statistic that isn't present in that data.
2. If the teacher asks about a student, question, or statistic that ISN'T in the context data - for example no student row is currently open, or a breakdown EduSphere doesn't compute (like topic tags, which aren't tracked - only per-question scores are) - say so plainly rather than guessing. Suggest what they could do instead (e.g. "open that student's row on the Mark sheet and ask me again").
3. You may explain general IB knowledge (what DP/MYP/IA/EE/TOK/assessment objectives mean in general, how IB marking philosophy works) from your own knowledge, but always make it clear when you're explaining general IB practice versus something specific to the paper in front of the teacher.
4. You are an assistant, not a replacement for the teacher. Never present a mark or a piece of feedback as final - the teacher always has final control over marks, feedback, and evaluation decisions. Frame your suggestions as suggestions.
5. Keep responses concise and practical - teachers are busy. Prefer short paragraphs or bullet points over long essays.`;

function isChatMessage(v: unknown): v is ChatMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0;
}

async function callGroq(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.4 })
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
  if (!text) throw new Error('Groq API response had no text content');
  return text;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server is missing GROQ_API_KEY' }, { status: 500 });
  }
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages.filter(isChatMessage);
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Request body must include a non-empty "messages" array' }, { status: 400 });
  }
  // Keep the token footprint bounded regardless of how long the session's chat gets.
  const recent = messages.slice(-12);

  const contextJson = JSON.stringify(body.context ?? {}, null, 2);
  const systemPrompt = `${SYSTEM_PROMPT}\n\nCURRENT CONTEXT DATA (JSON - this is the ONLY source of truth for this class/student, do not use anything outside it for specifics):\n${contextJson}`;

  const groqMessages = [{ role: 'system', content: systemPrompt }, ...recent.map(m => ({ role: m.role, content: m.content }))];

  let reply: string;
  try {
    reply = await callGroq(apiKey, model, groqMessages);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
