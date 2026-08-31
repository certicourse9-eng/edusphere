import { getCriteria, isMypCriteria } from './subjectObjectives';
import type { CourseworkType, IBProgramme } from './types';

export function buildSubjectDetectionPrompt(ocrText: string, knownSubjects: string[]): string {
  return `The text below was extracted by OCR from a scanned IB student answer sheet. Based ONLY on the subject matter of the questions and answers, decide which ONE of these subjects it belongs to:

${knownSubjects.map(s => `- ${s}`).join('\n')}

Respond with ONLY the exact subject name from that list, copied exactly as written above - no punctuation, no explanation, nothing else. If the content clearly matches none of them, or the text is too garbled/sparse to tell, respond with exactly: General / Other

OCR TEXT:
"""
${ocrText}
"""`;
}

function criteriaBlock(criteria: ReturnType<typeof getCriteria>) {
  const list = criteria.map(c => `- ${c.code}: ${c.name} (out of ${c.maxScore}) — ${c.description}`).join('\n');
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const example = criteria
    .map(
      c =>
        `{"code":"${c.code}","name":"${c.name}","score":0,"maxScore":${c.maxScore},"comment":"...","evidence":"...","missing":"..."}`
    )
    .join(',');
  return { list, maxTotal, example };
}

const EVIDENCE_INSTRUCTION = `For EACH criterion, in addition to the score and comment, also give:
- "evidence": what in the student's actual answer earned those marks (20 words or fewer). Use "" only if zero marks were awarded and there's nothing to cite.
- "missing": what's missing, wrong, or incomplete for that criterion, specific enough that a teacher could point to it (20 words or fewer). Use "" only if full marks were awarded and nothing is missing.
Both must be grounded in the actual OCR text below - never invent an answer the student didn't give. IMPORTANT for valid JSON: describe/paraphrase in your own plain words rather than copying the student's text verbatim, and never include a quotation mark (" or ') inside these strings.`;

const EMPTY_RESULT_JSON =
  '{"questions":[],"generalFeedback":[],"totalScore":0,"maxTotal":0,"annotations":[],"error":"Sheet appears blank or unreadable."}';

const ANNOTATIONS_INSTRUCTION = `Every line of the OCR text below is prefixed with a marker like [L12] - a global line number. In ADDITION to the scoring above, produce an "annotations" array: one entry per specific point worth marking directly on the original scanned page (praise, an error, a missed opportunity, or a note tied to one criterion). For each annotation:
- "type": one of "strength", "weakness", "suggestion", "criterion"
- "questionNumber": the question "number" this annotation belongs to (from the questions above)
- "criterionCode": the matching criterion code from above if this annotation is specifically about one named criterion (use "" if it's more general)
- "lineStart" and "lineEnd": the first and last line marker NUMBERS (just the number, not the letter L) this annotation refers to - use the same number for both if it's a single line
- "comment": a short note (20 words or fewer) explaining this specific point, written directly to the student

Produce 3-8 annotations, covering a mix of strengths, weaknesses, and suggestions spread across different lines (not all clustered on one line) - these are the kinds of things a teacher would circle or underline directly on the paper.`;

const ANNOTATIONS_EXAMPLE = '"annotations":[{"type":"strength","questionNumber":1,"criterionCode":"","lineStart":0,"lineEnd":0,"comment":"..."}]';

export function buildTextGradingPrompt(
  programme: IBProgramme,
  courseworkType: CourseworkType,
  subject: string,
  level: string,
  ocrText: string
): string {
  const criteria = getCriteria(programme, courseworkType, subject);
  const { list, maxTotal, example } = criteriaBlock(criteria);
  const isMyp = isMypCriteria(programme, courseworkType);
  const unit = isMyp ? 'achievement level' : 'mark';
  const scoringNote = isMyp
    ? `These are MYP achievement LEVELS (whole numbers 0-${criteria[0]?.maxScore ?? 8} per criterion, not raw exam marks) - award the level whose descriptor best fits the work as a whole for that criterion, using your best judgement of where it sits against the strand of increasing quality the criterion represents.`
    : `These are raw marks - award the mark for each criterion based on exactly what the answer demonstrates, the way an IB examiner would apply a markscheme.`;

  if (courseworkType === 'extended-essay' || courseworkType === 'tok') {
    const pieceLabel = courseworkType === 'extended-essay' ? 'IB Extended Essay' : 'IB TOK essay or exhibition commentary';
    const subjectLine =
      courseworkType === 'extended-essay' ? ` in ${subject}` : '';

    return `You are an IB examiner's grading assistant reviewing a scanned ${pieceLabel}${subjectLine}.

The text below was extracted by a PaddleOCR pass over a scanned PDF of the student's full written piece. It is plain text, not an image — you cannot assess handwriting or layout, only the written content. The OCR text may contain recognition errors, garbled symbols, or misplaced line breaks; use your best judgement to reconstruct the intended meaning. This is ONE continuous piece of writing, not a set of separate question/answer pairs — do not split it into multiple questions.

Grade the whole piece using these criteria (do not substitute criteria from a different coursework type, and do not invent additional criteria):

${list}

Do the following, in order:
1. Identify the essay's research question, knowledge question, or central focus (whatever is most applicable), and write a 1-3 sentence summary of the piece's overall argument/content.
2. Score the WHOLE piece against EACH of the ${criteria.length} criteria above individually (each out of its own maxScore shown above), with a short comment of 15 words or fewer per criterion explaining that score. Sum the criteria scores into an overall score, and the criteria maxScores into an overall maxScore (which will be ${maxTotal}, since the criteria above sum to that).
3. ${EVIDENCE_INSTRUCTION}
4. Write one overall feedback comment (15 words or fewer) summarizing across all criteria.
5. Write 2-4 general feedback bullets for the whole piece, each 16 words or fewer, grounded in the criteria above.
6. Give a "confidence" from 0 to 1 (e.g. 0.9) for how confident you are in this grading - lower it when the OCR text looks garbled, ambiguous, or borderline between two scores.
7. ${ANNOTATIONS_INSTRUCTION}

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape (the "questions" array will contain exactly ONE entry, representing the whole piece):

{"questions":[{"number":1,"questionText":"<research question / knowledge question / central focus>","answerText":"<1-3 sentence summary of the piece>","score":0,"maxScore":${maxTotal},"feedback":"...","criteria":[${example}],"confidence":0.9}],"generalFeedback":["...","..."],"totalScore":0,"maxTotal":${maxTotal},${ANNOTATIONS_EXAMPLE}}

If the OCR text is empty or garbled beyond use, respond with exactly:

${EMPTY_RESULT_JSON}

OCR TEXT:
"""
${ocrText}
"""`;
  }

  const courseworkLabel =
    courseworkType === 'internal-assessment' ? 'Internal Assessment' : courseworkType === 'exam' ? 'exam' : 'external assessment';
  const programmeLabel = programme === 'MYP' ? 'IB MYP' : 'IB DP';
  // SL/HL is a DP-only concept - never mention it for MYP, which has no such split.
  const levelSuffix = programme === 'MYP' ? '' : ` ${level}`;

  return `You are an IB examiner's grading assistant reviewing a scanned student ${courseworkLabel} answer sheet for ${programmeLabel} ${subject}${levelSuffix}.

The text below was extracted by a PaddleOCR pass over a scanned PDF of one student's handwritten or typed responses to an ${programmeLabel} ${subject}${levelSuffix} ${courseworkLabel}. It is plain text, not an image — you cannot assess handwriting quality, only the symbolic content. The OCR text may contain recognition errors, garbled symbols, or misplaced line breaks; use your best judgement to reconstruct the intended meaning.

Grade using these ${subject} ${courseworkLabel} criteria for EVERY question (do not substitute criteria from a different subject or coursework type, and do not invent additional criteria):

${list}

${scoringNote}

Do the following, in order:
1. Identify each distinct question/answer pair in the OCR text, in order.
2. For each answer, write a 1-3 sentence summary of what the student wrote.
3. For each question, ${isMyp ? 'assign' : 'score'} EACH of the ${criteria.length} criteria above individually (each out of its own maxScore shown above, as a ${unit}), with a short comment of 12 words or fewer per criterion explaining that specific ${unit}. Sum the criteria ${isMyp ? 'levels' : 'scores'} into the question's own score, and the criteria maxScores into the question's own maxScore (which will be ${maxTotal} per question, since the criteria above sum to that).
4. ${EVIDENCE_INSTRUCTION}
5. Write a single overall feedback comment for the question (12 words or fewer) summarizing across all criteria.
6. Write 2-4 general feedback bullets for the whole sheet, each 14 words or fewer, grounded in the criteria above.
7. Compute totalScore (the sum of every question's score) and maxTotal (the sum of every question's maxScore).
8. For EACH question, give a "confidence" from 0 to 1 (e.g. 0.9) for how confident you are in that question's grading - lower it when the OCR text for that answer looks garbled, ambiguous, or borderline between two scores.
9. ${ANNOTATIONS_INSTRUCTION}

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{"questions":[{"number":1,"questionText":"...","answerText":"...","score":0,"maxScore":${maxTotal},"feedback":"...","criteria":[${example}],"confidence":0.9}],"generalFeedback":["...","..."],"totalScore":0,"maxTotal":0,${ANNOTATIONS_EXAMPLE}}

If the OCR text is empty, garbled beyond use, or you cannot identify any questions, respond with exactly:

${EMPTY_RESULT_JSON}

OCR TEXT:
"""
${ocrText}
"""`;
}
