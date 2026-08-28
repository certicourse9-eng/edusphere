import { FINISHED_STATUSES } from './types';
import type { CourseworkType, IBProgramme, Level, StudentFile } from './types';

export interface ChatClassSetup {
  programme: IBProgramme;
  gradeYear: string;
  courseworkType: CourseworkType;
  subject: string;
  level: Level;
  expectedStudentCount: number | null;
}

export interface ChatStudentSummary {
  studentId: string;
  fileName: string;
  status: string;
  subject: string | null;
  totalScore: number | null;
  maxTotal: number | null;
  questionScores: { number: number; score: number; maxScore: number }[] | null;
}

export interface ChatFocusedStudent {
  studentId: string;
  fileName: string;
  subject: string;
  totalScore: number;
  maxTotal: number;
  generalFeedback: string[];
  teacherFeedback: string;
  error: string | null;
  reviewReason: string | null;
  questions: {
    number: number;
    questionText: string;
    answerText: string;
    score: number;
    maxScore: number;
    feedback: string;
    criteria: { code: string; name: string; score: number; maxScore: number; comment: string }[];
  }[];
}

export interface ChatContext {
  classSetup: ChatClassSetup;
  classStats: {
    totalPapers: number;
    evaluated: number;
    needsReview: number;
    approved: number;
    failed: number;
    pending: number;
    processing: number;
    classAverage: string;
  };
  /** Lightweight summary of every uploaded paper - enough for class/question-wide questions
   *  without blowing up the token budget for a large class. */
  students: ChatStudentSummary[];
  /** Full per-question/per-criterion detail for whichever student row the teacher currently
   *  has expanded on the Mark sheet, if any - this is what lets the bot answer "why did THIS
   *  student lose marks on Q3" instead of only class-wide questions. */
  focusedStudent: ChatFocusedStudent | null;
}

export function buildChatContext(classSetup: ChatClassSetup, files: StudentFile[], focusedFileId: string | null): ChatContext {
  const finished = files.filter(f => FINISHED_STATUSES.includes(f.status));
  const totalScore = finished.reduce((s, f) => s + (f.result?.totalScore ?? 0), 0);
  const totalMax = finished.reduce((s, f) => s + (f.result?.maxTotal ?? 0), 0);
  const classAverage =
    finished.length > 0 ? `${(totalScore / finished.length).toFixed(1)} / ${(totalMax / finished.length).toFixed(0)}` : 'no evaluated papers yet';

  const students: ChatStudentSummary[] = files.map(f => ({
    studentId: f.studentId,
    fileName: f.fileName,
    status: f.status,
    subject: f.result?.detectedSubject ?? null,
    totalScore: f.result?.totalScore ?? null,
    maxTotal: f.result?.maxTotal ?? null,
    questionScores: f.result ? f.result.questions.map(q => ({ number: q.number, score: q.score, maxScore: q.maxScore })) : null
  }));

  const focused = focusedFileId ? files.find(f => f.id === focusedFileId) : undefined;
  const focusedStudent: ChatFocusedStudent | null =
    focused && focused.result
      ? {
          studentId: focused.studentId,
          fileName: focused.fileName,
          subject: focused.result.detectedSubject,
          totalScore: focused.result.totalScore,
          maxTotal: focused.result.maxTotal,
          generalFeedback: focused.result.generalFeedback,
          teacherFeedback: focused.teacherFeedback,
          error: focused.result.error ?? null,
          reviewReason: focused.reviewReason ?? null,
          questions: focused.result.questions.map(q => ({
            number: q.number,
            questionText: q.questionText,
            answerText: q.answerText,
            score: q.score,
            maxScore: q.maxScore,
            feedback: q.feedback,
            criteria: q.criteria
          }))
        }
      : null;

  return {
    classSetup,
    classStats: {
      totalPapers: files.length,
      evaluated: files.filter(f => f.status === 'evaluated' || f.status === 'teacher-approved').length,
      needsReview: files.filter(f => f.status === 'needs-review').length,
      approved: files.filter(f => f.status === 'teacher-approved').length,
      failed: files.filter(f => f.status === 'failed').length,
      pending: files.filter(f => f.status === 'uploaded').length,
      processing: files.filter(f => f.status === 'ocr-processing' || f.status === 'ocr-completed' || f.status === 'evaluating').length,
      classAverage
    },
    students,
    focusedStudent
  };
}
