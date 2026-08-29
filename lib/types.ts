export type Level = 'SL' | 'HL';

export type CourseworkType = 'internal-assessment' | 'extended-essay' | 'tok' | 'external-assessment' | 'exam';

export const COURSEWORK_TYPE_LABELS: Record<CourseworkType, string> = {
  'internal-assessment': 'Internal Assessment',
  'extended-essay': 'Extended Essay',
  tok: 'TOK essay/exhibition',
  'external-assessment': 'External Assessment',
  exam: 'Exam'
};

export type IBProgramme = 'DP' | 'MYP';

export const IB_PROGRAMME_LABELS: Record<IBProgramme, string> = {
  DP: 'Diploma Programme (DP)',
  MYP: 'Middle Years Programme (MYP)'
};

export type FileStatus =
  | 'uploaded'
  | 'ocr-processing'
  | 'ocr-completed'
  | 'evaluating'
  | 'evaluated'
  | 'needs-review'
  | 'teacher-approved'
  | 'failed';

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  uploaded: 'Uploaded',
  'ocr-processing': 'OCR Processing',
  'ocr-completed': 'OCR Completed',
  evaluating: 'AI Evaluation Processing',
  evaluated: 'Evaluated',
  'needs-review': 'Needs Teacher Review',
  'teacher-approved': 'Teacher Approved',
  failed: 'Failed'
};

/** Statuses that count as "still in the queue, not yet finished one way or another". */
export const PENDING_STATUSES: FileStatus[] = ['uploaded'];
export const PROCESSING_STATUSES: FileStatus[] = ['ocr-processing', 'ocr-completed', 'evaluating'];
export const FINISHED_STATUSES: FileStatus[] = ['evaluated', 'needs-review', 'teacher-approved', 'failed'];

export interface CriterionScore {
  code: string;
  name: string;
  score: number;
  maxScore: number;
  comment: string;
  /** What in the student's answer earned the awarded marks for this criterion - cited from
   *  their actual answer, not invented. Empty string if the model didn't identify anything. */
  evidence: string;
  /** What's missing, wrong, or incomplete for this criterion. Empty string if full marks
   *  were awarded and nothing is missing. */
  missing: string;
}

export interface GradedQuestion {
  number: number;
  questionText: string;
  answerText: string;
  score: number;
  maxScore: number;
  feedback: string;
  criteria: CriterionScore[];
  /** The model's own confidence (0-1) in its grading of this question, accounting for OCR
   *  clarity and answer ambiguity. Null when the model didn't report one - never fabricated. */
  confidence: number | null;
}

export type AnnotationType = 'strength' | 'weakness' | 'suggestion' | 'criterion';

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  strength: 'Strength',
  weakness: 'Weakness',
  suggestion: 'Suggestion',
  criterion: 'Criterion'
};

export interface Annotation {
  type: AnnotationType;
  criterionCode?: string;
  lineStart: number;
  lineEnd: number;
  comment: string;
}

export interface GradingResult {
  questions: GradedQuestion[];
  generalFeedback: string[];
  totalScore: number;
  maxTotal: number;
  error?: string;
  detectedSubject: string;
  annotations: Annotation[];
}

/** One OCR'd text line and its pixel bounding box [x1, y1, x2, y2] on its page's image. */
export interface OcrLine {
  text: string;
  box: [number, number, number, number];
}

/** One page of the scanned PDF, rendered by PaddleOCR as a data URL, with its detected lines. */
export interface OcrPage {
  imageDataUrl: string;
  lines: OcrLine[];
}

export interface StudentFile {
  id: string;
  file: File;
  fileName: string;
  studentId: string;
  status: FileStatus;
  result: GradingResult | null;
  error: string | null;
  teacherFeedback: string;
  ocrText?: string;
  ocrPages?: OcrPage[];
  /** 0-1 average PaddleOCR recognition confidence across every line on the sheet. */
  ocrConfidence?: number;
  /** Set when status is 'needs-review' or 'failed', explaining why. */
  reviewReason?: string;
}
