export function buildTextGradingPrompt(subject: string, level: string, ocrText: string): string {
  return `You are an IB examiner's grading assistant reviewing a scanned student answer sheet for ${subject} ${level}.

The text below was extracted by a PaddleOCR pass over a scanned PDF of one student's handwritten or typed responses to an IB ${subject} ${level} assessment. It is plain text, not an image — you cannot assess handwriting quality, only the symbolic content. The OCR text may contain recognition errors, garbled symbols, or misplaced line breaks; use your best judgement to reconstruct the intended meaning.

Do the following, in order:
1. Identify each distinct question/answer pair in the OCR text, in order.
2. For each answer, write a 1-3 sentence summary of what the student wrote.
3. Score each answer out of 7 marks against general IB-style assessment objectives (knowledge & understanding, application, analysis/evaluation, communication), and give a feedback comment of 12 words or fewer.
4. Write 2-4 general feedback bullets for the whole sheet, each 14 words or fewer.
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
