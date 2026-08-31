'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { gradeFile } from './gradeClient';
import { deriveStudentId } from './studentId';
import { buildCsv, downloadCsv } from './csv';
import { runWithConcurrency } from './concurrency';
import type { StudentFile, Level, CourseworkType, IBProgramme, FileStatus, GradeBoundary } from './types';
import { FINISHED_STATUSES } from './types';

const MAX_CONCURRENCY = 5;

/** How many AI accounts currently look usable, so a bulk run doesn't parallelize more than
 *  the pool can actually support - with only one account configured, this keeps grading
 *  sequential (parallel requests would just fight over the same rate limit); with several
 *  healthy accounts, it fans work out across them. Falls back to 1 (sequential) if the
 *  status check itself fails, rather than guessing. */
async function getSafeConcurrency(): Promise<number> {
  try {
    const resp = await fetch('/api/ai-status');
    if (!resp.ok) return 1;
    const data = (await resp.json()) as { accounts?: { health?: { status?: string } }[] };
    const healthy = (data.accounts ?? []).filter(a => a.health?.status !== 'disabled').length;
    return Math.max(1, Math.min(healthy || 1, MAX_CONCURRENCY));
  } catch {
    return 1;
  }
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `file-${Date.now()}-${idCounter}`;
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;

interface ClassSessionValue {
  programme: IBProgramme;
  setProgramme: (p: IBProgramme) => void;
  gradeYear: string;
  setGradeYear: (v: string) => void;
  courseworkType: CourseworkType;
  setCourseworkType: (t: CourseworkType) => void;
  subject: string;
  setSubject: (s: string) => void;
  level: Level;
  setLevel: (l: Level) => void;
  expectedStudentCount: string;
  setExpectedStudentCount: (v: string) => void;
  gradeBoundaries: GradeBoundary[];
  setGradeBoundaries: (b: GradeBoundary[]) => void;
  files: StudentFile[];
  running: boolean;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  updateTeacherFeedback: (id: string, text: string) => void;
  approveFile: (id: string) => void;
  setTeacherOverrideScore: (id: string, score: number | null) => void;
  runPipeline: () => Promise<void>;
  handleExport: () => void;
  total: number;
  expected: number;
  evaluatedCount: number;
  processingCount: number;
  pendingCount: number;
  needsReviewCount: number;
  approvedCount: number;
  failedCount: number;
  finishedCount: number;
  progressLabel: string;
  canRun: boolean;
}

const ClassSessionContext = createContext<ClassSessionValue | null>(null);

/** Owns the whole class-grading session's state (setup, files, pipeline) at the layout
 *  level - shared by the main dashboard and the dedicated analytics page so navigating
 *  between them (a normal client-side route change) never loses in-progress work, since
 *  nothing here unmounts. No persistence beyond this in-memory session, by design. */
export function ClassSessionProvider({ children }: { children: React.ReactNode }) {
  const [programme, setProgramme] = useState<IBProgramme>('DP');
  const [gradeYear, setGradeYear] = useState('');
  const [courseworkType, setCourseworkType] = useState<CourseworkType>('external-assessment');
  const [subject, setSubject] = useState('Mathematics AA');
  const [level, setLevel] = useState<Level>('HL');
  const [expectedStudentCount, setExpectedStudentCount] = useState('');
  const [gradeBoundaries, setGradeBoundaries] = useState<GradeBoundary[]>([]);
  const [files, setFiles] = useState<StudentFile[]>([]);
  const [running, setRunning] = useState(false);

  const addFiles = useCallback((incoming: File[]) => {
    const pdfsOnly = incoming.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const entries: StudentFile[] = pdfsOnly.map(file => ({
      id: makeId(),
      file,
      fileName: file.name,
      studentId: deriveStudentId(file.name),
      status: 'uploaded',
      result: null,
      error: null,
      teacherFeedback: ''
    }));
    if (entries.length > 0) setFiles(prev => [...prev, ...entries]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateTeacherFeedback = useCallback((id: string, text: string) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, teacherFeedback: text } : f)));
  }, []);

  const approveFile = useCallback((id: string) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: 'teacher-approved' as FileStatus } : f)));
  }, []);

  const setTeacherOverrideScore = useCallback((id: string, score: number | null) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, teacherOverrideScore: score } : f)));
  }, []);

  const setStatus = useCallback((id: string, status: FileStatus) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status } : f)));
  }, []);

  const runPipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const runProgramme = programme;
    const runCourseworkType = courseworkType;
    const runSubject = subject;
    const runLevel = level;
    const toRun = files.filter(f => f.status === 'uploaded' || f.status === 'failed');
    const concurrency = await getSafeConcurrency();

    await runWithConcurrency(toRun, concurrency, async entry => {
      setFiles(prev => prev.map(f => (f.id === entry.id ? { ...f, error: null, reviewReason: undefined } : f)));
      try {
        const { result, ocrText, ocrPages, ocrConfidence } = await gradeFile(
          entry.file,
          runProgramme,
          runCourseworkType,
          runSubject,
          runLevel,
          status => setStatus(entry.id, status)
        );

        let finalStatus: FileStatus = 'evaluated';
        let reviewReason: string | undefined;
        if (result.error) {
          finalStatus = 'needs-review';
          reviewReason = result.error;
        } else if (ocrConfidence !== null && ocrConfidence < LOW_CONFIDENCE_THRESHOLD) {
          finalStatus = 'needs-review';
          reviewReason = `Low OCR confidence (${Math.round(ocrConfidence * 100)}%) — some handwriting may be unclear. Check the Annotated paper and OCR text tabs before trusting this score.`;
        }

        setFiles(prev =>
          prev.map(f =>
            f.id === entry.id
              ? {
                  ...f,
                  status: finalStatus,
                  result,
                  ocrText,
                  ocrPages,
                  ocrConfidence: ocrConfidence ?? undefined,
                  reviewReason,
                  programme: runProgramme
                }
              : f
          )
        );
      } catch (err) {
        setFiles(prev =>
          prev.map(f => (f.id === entry.id ? { ...f, status: 'failed' as FileStatus, error: (err as Error).message } : f))
        );
      }
    });

    setRunning(false);
  }, [files, running, programme, courseworkType, subject, level, setStatus]);

  const handleExport = useCallback(() => {
    downloadCsv(buildCsv(files, gradeBoundaries), 'grading-results.csv');
  }, [files, gradeBoundaries]);

  const total = files.length;
  const expected = parseInt(expectedStudentCount, 10) || 0;
  const evaluatedCount = files.filter(f => f.status === 'evaluated' || f.status === 'teacher-approved').length;
  const processingCount = files.filter(f => f.status === 'ocr-processing' || f.status === 'ocr-completed' || f.status === 'evaluating').length;
  const pendingCount = files.filter(f => f.status === 'uploaded').length;
  const needsReviewCount = files.filter(f => f.status === 'needs-review').length;
  const approvedCount = files.filter(f => f.status === 'teacher-approved').length;
  const failedCount = files.filter(f => f.status === 'failed').length;
  const finishedCount = files.filter(f => FINISHED_STATUSES.includes(f.status)).length;

  const progressLabel = total > 0 ? `${finishedCount} / ${total} processed` : '';
  const canRun = !running && files.some(f => f.status === 'uploaded' || f.status === 'failed');

  const value: ClassSessionValue = {
    programme,
    setProgramme,
    gradeYear,
    setGradeYear,
    courseworkType,
    setCourseworkType,
    subject,
    setSubject,
    level,
    setLevel,
    expectedStudentCount,
    setExpectedStudentCount,
    gradeBoundaries,
    setGradeBoundaries,
    files,
    running,
    addFiles,
    removeFile,
    updateTeacherFeedback,
    approveFile,
    setTeacherOverrideScore,
    runPipeline,
    handleExport,
    total,
    expected,
    evaluatedCount,
    processingCount,
    pendingCount,
    needsReviewCount,
    approvedCount,
    failedCount,
    finishedCount,
    progressLabel,
    canRun
  };

  return <ClassSessionContext.Provider value={value}>{children}</ClassSessionContext.Provider>;
}

export function useClassSession(): ClassSessionValue {
  const ctx = useContext(ClassSessionContext);
  if (!ctx) throw new Error('useClassSession must be used within a ClassSessionProvider');
  return ctx;
}
