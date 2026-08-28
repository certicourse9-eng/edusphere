export type Level = 'SL' | 'HL';

export type CourseworkType = 'internal-assessment' | 'extended-essay' | 'tok' | 'external-assessment';

export const COURSEWORK_TYPE_LABELS: Record<CourseworkType, string> = {
  'internal-assessment': 'Internal Assessment',
  'extended-essay': 'Extended Essay',
  tok: 'TOK essay/exhibition',
  'external-assessment': 'External Assessment'
};

export type FileStatus = 'queued' | 'ocr' | 'processing' | 'done' | 'error';

export interface CriterionScore {
  code: string;
  name: string;
  score: number;
  maxScore: number;
  comment: string;
}

export interface GradedQuestion {
  number: number;
  questionText: string;
  answerText: string;
  score: number;
  maxScore: number;
  feedback: string;
  criteria: CriterionScore[];
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
}
