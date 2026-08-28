import { getSubjectObjectives } from './subjectObjectives';

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
  const objectives = getSubjectObjectives(subject);

  return `You are an IB examiner's grading assistant reviewing a scanned student answer sheet for ${subject} ${level}.

The text below was extracted by a PaddleOCR pass over a scanned PDF of one student's handwritten or typed responses to an IB ${subject} ${level} assessment. It is plain text, not an image — you cannot assess handwriting quality, only the symbolic content. The OCR text may contain recognition errors, garbled symbols, or misplaced line breaks; use your best judgement to reconstruct the intended meaning.

For ${subject}, grade specifically against these IB-style assessment objectives (do not substitute a generic rubric from a different subject): ${objectives}.

Do the following, in order:
1. Identify each distinct question/answer pair in the OCR text, in order.
2. For each answer, write a 1-3 sentence summary of what the student wrote.
3. Score each answer out of 7 marks against the ${subject} assessment objectives above, and give a feedback comment of 12 words or fewer that reflects those specific objectives (e.g. reference source evaluation for History, mathematical reasoning for Mathematics, experimental method for a science, literary technique for English, and so on - whichever apply to ${subject}).
4. Write 2-4 general feedback bullets for the whole sheet, each 14 words or fewer, similarly grounded in the ${subject} assessment objectives.
5. Compute totalScore (the sum of the question scores) and maxTotal (the sum of the question maxScores).

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{"questions":[{"number":1,"questionText":"...","answerText":"...","score":5,"maxScore":7,"feedback":"..."}],"generalFeedback":["...","..."],"totalScore":0,"maxTotal":0}

If the OCR text is empty, garbled beyond use, or you cannot identify any questions, respond with exactly:

{"questions":[],"generalFeedback":[],"totalScore":0,"maxTotal":0,"error":"Sheet appears blank or unreadable."}

OCR TEXT:
"""
${ocrText}
"""`;
}
