import { NextRequest, NextResponse } from 'next/server';
import { buildSubjectDetectionPrompt, buildTextGradingPrompt } from '@/lib/prompt';
import { parseGradingResponse } from '@/lib/parseGradingResponse';
import { SUBJECTS } from '@/lib/subjectIcons';
import type { CourseworkType, GradingResult, IBProgramme } from '@/lib/types';

const GENERAL_SUBJECT = 'General / Other';
const TOK_SUBJECT_LABEL = 'Theory of Knowledge';
const DETECTABLE_SUBJECTS = SUBJECTS.filter(s => s !== GENERAL_SUBJECT);
const COURSEWORK_TYPES: CourseworkType[] = ['internal-assessment', 'extended-essay', 'tok', 'external-assessment', 'exam'];
const PROGRAMMES: IBProgramme[] = ['DP', 'MYP'];

interface GradeRequestBody {
  ocrText?: string;
  subject?: string;
  level?: string;
  courseworkType?: string;
  programme?: string;
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
        // Grading responses grew a lot once per-criterion evidence/missing text and a
        // per-question confidence were added - without an explicit max_tokens, a long
        // paper (many questions x criteria) could get cut off mid-JSON, which Groq's
        // json_object validator rejects with "Failed to generate JSON". This account's
        // tier caps prompt+completion at 8000 tokens total per request, so this has to
        // leave real headroom for the prompt (criteria list + full OCR text) rather than
        // claiming the whole budget for the completion alone.
        ...(jsonMode ? { response_format: { type: 'json_object' }, max_tokens: 4000 } : {})
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
    const rawMessage = data.error?.message || `Groq API error (status ${resp.status})`;
    if (/request too large/i.test(rawMessage)) {
      throw new Error(
        'This paper is too long/text-heavy to grade in one request under the current API plan\'s per-request token limit. Try splitting it into smaller uploads, or upgrade the Groq plan.'
      );
    }
    throw new Error(rawMessage);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API response had no text content');
  }
  return text;
}

/** Groq's json_object mode occasionally rejects a model's own output as invalid JSON
 *  ("Failed to generate JSON. Please adjust...") - this is non-deterministic (the same
 *  prompt often succeeds on a second try), so retry once before surfacing it as a real
 *  failure to the teacher. */
async function callGroqJsonWithRetry(apiKey: string, model: string, prompt: string): Promise<string> {
  try {
    return await callGroq(apiKey, model, prompt, true);
  } catch (err) {
    const message = (err as Error).message;
    if (!/failed to generate json/i.test(message)) throw err;
    return callGroq(apiKey, model, prompt, true);
  }
}

function normalizeDetectedSubject(raw: string): string {
  const cleaned = raw.trim().replace(/^["'.\s]+|["'.\s]+$/g, '');
  const match = SUBJECTS.find(s => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? GENERAL_SUBJECT;
}

function mismatchResult(selectedSubject: string, detectedSubject: string): GradingResult {
  return {
    questions: [],
    generalFeedback: [],
    totalScore: 0,
    maxTotal: 0,
    detectedSubject,
    annotations: [],
    error: `Subject mismatch: this sheet looks like a ${detectedSubject} paper, but ${selectedSubject} was selected. Re-upload with the correct subject selected, or choose "${GENERAL_SUBJECT}" to grade it anyway.`
  };
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

  const { ocrText, subject, level, courseworkType: rawCourseworkType, programme: rawProgramme } = body;
  if (!ocrText || typeof ocrText !== 'string') {
    return NextResponse.json({ error: 'Request body must include an "ocrText" string' }, { status: 400 });
  }
  const courseworkType: CourseworkType = COURSEWORK_TYPES.includes(rawCourseworkType as CourseworkType)
    ? (rawCourseworkType as CourseworkType)
    : 'external-assessment';
  const programme: IBProgramme = PROGRAMMES.includes(rawProgramme as IBProgramme) ? (rawProgramme as IBProgramme) : 'DP';

  // TOK has no subject concept at all - skip subject requirements/verification entirely.
  if (courseworkType === 'tok') {
    const gradingPrompt = buildTextGradingPrompt(programme, courseworkType, TOK_SUBJECT_LABEL, level || '', ocrText);
    let text: string;
    try {
      text = await callGroqJsonWithRetry(apiKey, model, gradingPrompt);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
    try {
      const result = parseGradingResponse(text, TOK_SUBJECT_LABEL);
      return NextResponse.json(result, { status: 200 });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
  }

  if (!subject || !level) {
    return NextResponse.json({ error: 'Request body must include "subject" and "level"' }, { status: 400 });
  }
  const selectedSubject = SUBJECTS.includes(subject) ? subject : GENERAL_SUBJECT;

  // Verify the sheet's actual content against the subject the teacher picked,
  // unless they picked General / Other - in that case any content is fine,
  // so there's nothing to mismatch against and detection is skipped.
  let detectedSubject = selectedSubject;
  if (selectedSubject !== GENERAL_SUBJECT) {
    try {
      const detectionPrompt = buildSubjectDetectionPrompt(ocrText, DETECTABLE_SUBJECTS);
      const rawDetected = await callGroq(apiKey, model, detectionPrompt, false);
      detectedSubject = normalizeDetectedSubject(rawDetected);
    } catch {
      // Detection is a verification step, not the grading itself - if it
      // breaks, give the teacher's chosen subject the benefit of the doubt
      // rather than blocking grading entirely.
      detectedSubject = selectedSubject;
    }

    // Only flag a mismatch when detection confidently found a DIFFERENT,
    // specific subject. An inconclusive ("General / Other") detection isn't
    // evidence of a mismatch - it's just uncertainty - so it proceeds using
    // the teacher's selected subject rather than blocking on it.
    if (detectedSubject !== GENERAL_SUBJECT && detectedSubject !== selectedSubject) {
      return NextResponse.json(mismatchResult(selectedSubject, detectedSubject), { status: 200 });
    }
  }

  const gradingSubject = selectedSubject;
  const gradingPrompt = buildTextGradingPrompt(programme, courseworkType, gradingSubject, level, ocrText);

  let text: string;
  try {
    text = await callGroqJsonWithRetry(apiKey, model, gradingPrompt);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  try {
    const result = parseGradingResponse(text, gradingSubject);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
