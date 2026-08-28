'use client';

import { useCallback, useMemo, useState } from 'react';
import UploadPanel from '@/components/UploadPanel';
import FileQueue from '@/components/FileQueue';
import ClassProgressBar from '@/components/ClassProgressBar';
import Dashboard from '@/components/Dashboard';
import HeroBlobs from '@/components/HeroBlobs';
import ChatWidget from '@/components/ChatWidget';
import { gradeFile } from '@/lib/gradeClient';
import { deriveStudentId } from '@/lib/studentId';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { buildChatContext } from '@/lib/chatContext';
import type { StudentFile, Level, CourseworkType, IBProgramme, FileStatus } from '@/lib/types';
import { FINISHED_STATUSES } from '@/lib/types';

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `file-${Date.now()}-${idCounter}`;
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export default function Page() {
  const [programme, setProgramme] = useState<IBProgramme>('DP');
  const [gradeYear, setGradeYear] = useState('');
  const [courseworkType, setCourseworkType] = useState<CourseworkType>('external-assessment');
  const [subject, setSubject] = useState('Mathematics AA');
  const [level, setLevel] = useState<Level>('HL');
  const [expectedStudentCount, setExpectedStudentCount] = useState('');
  const [files, setFiles] = useState<StudentFile[]>([]);
  const [running, setRunning] = useState(false);
  const [focusedFileId, setFocusedFileId] = useState<string | null>(null);

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
    setFocusedFileId(prev => (prev === id ? null : prev));
  }, []);

  const updateTeacherFeedback = useCallback((id: string, text: string) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, teacherFeedback: text } : f)));
  }, []);

  const approveFile = useCallback((id: string) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: 'teacher-approved' as FileStatus } : f)));
  }, []);

  const setStatus = useCallback((id: string, status: FileStatus) => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status } : f)));
  }, []);

  const runPipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const runCourseworkType = courseworkType;
    const runSubject = subject;
    const runLevel = level;
    const toRun = files.filter(f => f.status === 'uploaded' || f.status === 'failed');

    for (const entry of toRun) {
      setFiles(prev => prev.map(f => (f.id === entry.id ? { ...f, error: null, reviewReason: undefined } : f)));
      try {
        const { result, ocrText, ocrPages, ocrConfidence } = await gradeFile(
          entry.file,
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
              ? { ...f, status: finalStatus, result, ocrText, ocrPages, ocrConfidence: ocrConfidence ?? undefined, reviewReason }
              : f
          )
        );
      } catch (err) {
        setFiles(prev =>
          prev.map(f =>
            f.id === entry.id ? { ...f, status: 'failed' as FileStatus, error: (err as Error).message } : f
          )
        );
      }
    }

    setRunning(false);
  }, [files, running, courseworkType, subject, level, setStatus]);

  const handleExport = useCallback(() => {
    downloadCsv(buildCsv(files), 'grading-results.csv');
  }, [files]);

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

  const focusedFile = files.find(f => f.id === focusedFileId) ?? null;
  const focusedStudentLabel = focusedFile
    ? `${focusedFile.studentId} · ${focusedFile.result?.detectedSubject ?? subject}`
    : null;
  const chatContext = useMemo(
    () =>
      buildChatContext(
        { programme, gradeYear, courseworkType, subject, level, expectedStudentCount: expected || null },
        files,
        focusedFileId
      ),
    [programme, gradeYear, courseworkType, subject, level, expected, files, focusedFileId]
  );

  return (
    <main className="page">
      <div style={{ position: 'relative' }}>
        <HeroBlobs />
        <header className="hero">
          <h1>
            EduSphere
            <span className="mascot" aria-hidden="true" title="Reading every page for you!">
              <span className="mascotPaper">📝</span>
              <span className="mascotCheck">✅</span>
            </span>
          </h1>
        </header>
      </div>

      <UploadPanel
        programme={programme}
        onProgrammeChange={setProgramme}
        gradeYear={gradeYear}
        onGradeYearChange={setGradeYear}
        courseworkType={courseworkType}
        onCourseworkTypeChange={setCourseworkType}
        subject={subject}
        onSubjectChange={setSubject}
        level={level}
        onLevelChange={setLevel}
        expectedStudentCount={expectedStudentCount}
        onExpectedStudentCountChange={setExpectedStudentCount}
        onFilesAdded={addFiles}
        onRun={runPipeline}
        running={running}
        canRun={canRun}
        progressLabel={progressLabel}
      />

      {total > 0 && (
        <ClassProgressBar
          expected={expected}
          uploaded={total}
          evaluated={evaluatedCount}
          approved={approvedCount}
          processing={processingCount}
          pending={pendingCount}
          needsReview={needsReviewCount}
          failed={failedCount}
        />
      )}

      <FileQueue files={files} onRemove={removeFile} />
      <Dashboard
        files={files}
        onTeacherFeedbackChange={updateTeacherFeedback}
        onApprove={approveFile}
        onExport={handleExport}
        exportDisabled={finishedCount === 0}
        focusedId={focusedFileId}
        onFocusedIdChange={setFocusedFileId}
      />

      <ChatWidget context={chatContext} focusedStudentLabel={focusedStudentLabel} />
    </main>
  );
}
