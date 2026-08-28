export type Level = 'SL' | 'HL';

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

export interface GradingResult {
  questions: GradedQuestion[];
  generalFeedback: string[];
  totalScore: number;
  maxTotal: number;
  error?: string;
  detectedSubject: string;
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
}
