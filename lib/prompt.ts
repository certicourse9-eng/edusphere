import { getSubjectCriteria } from './subjectObjectives';

export function buildSubjectDetectionPrompt(ocrText: string, knownSubjects: string[]): string {
  return `The text below was extracted by OCR from a scanned IB student answer sheet. Based ONLY on the subject matter of the questions and answers, decide which ONE of these subjects it belongs to:

${knownSubjects.map(s => `- ${s}`).join('\n')}

Respond with ONLY the exact subject name from that list, copied exactly as written above - no punctuation, no explanation, nothing else. If the content clearly matches none of them, or the text is too garbled/sparse to tell, respond with exactly: General / Other

OCR TEXT:
"""
${ocrText}
"""`;
}

export function buildTextGradingPrompt(subject: string, level: string, ocrText: string): string {
  const criteria = getSubjectCriteria(subject);
  const criteriaList = criteria
    .map(c => `- ${c.code}: ${c.name} (out of ${c.maxScore}) — ${c.description}`)
    .join('\n');
  const questionMaxTotal = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const criteriaCodesExample = criteria
    .map(c => `{"code":"${c.code}","name":"${c.name}","score":0,"maxScore":${c.maxScore},"comment":"..."}`)
    .join(',');

  return `You are an IB examiner's grading assistant reviewing a scanned student answer sheet for ${subject} ${level}.

The text below was extracted by a PaddleOCR pass over a scanned PDF of one student's handwritten or typed responses to an IB ${subject} ${level} assessment. It is plain text, not an image — you cannot assess handwriting quality, only the symbolic content. The OCR text may contain recognition errors, garbled symbols, or misplaced line breaks; use your best judgement to reconstruct the intended meaning.

Grade using these ${subject} assessment criteria for EVERY question (do not substitute criteria from a different subject, and do not invent additional criteria):

${criteriaList}

Do the following, in order:
1. Identify each distinct question/answer pair in the OCR text, in order.
2. For each answer, write a 1-3 sentence summary of what the student wrote.
3. For each question, score it against EACH of the ${criteria.length} criteria above individually (each out of its own maxScore shown above), with a short comment of 12 words or fewer per criterion explaining that specific score. Sum the criteria scores into the question's own score, and the criteria maxScores into the question's own maxScore (which will be ${questionMaxTotal} per question, since the criteria above sum to that).
4. Write a single overall feedback comment for the question (12 words or fewer) summarizing across all criteria.
5. Write 2-4 general feedback bullets for the whole sheet, each 14 words or fewer, grounded in the ${subject} criteria.
6. Compute totalScore (the sum of every question's score) and maxTotal (the sum of every question's maxScore).

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{"questions":[{"number":1,"questionText":"...","answerText":"...","score":0,"maxScore":${questionMaxTotal},"feedback":"...","criteria":[${criteriaCodesExample}]}],"generalFeedback":["...","..."],"totalScore":0,"maxTotal":0}

If the OCR text is empty, garbled beyond use, or you cannot identify any questions, respond with exactly:

{"questions":[],"generalFeedback":[],"totalScore":0,"maxTotal":0,"error":"Sheet appears blank or unreadable."}

OCR TEXT:
"""
${ocrText}
"""`;
}
