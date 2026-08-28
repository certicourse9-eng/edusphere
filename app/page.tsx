'use client';

import { useCallback, useState } from 'react';
import UploadPanel from '@/components/UploadPanel';
import FileQueue from '@/components/FileQueue';
import Dashboard from '@/components/Dashboard';
import HeroBlobs from '@/components/HeroBlobs';
import { gradeFile } from '@/lib/gradeClient';
import { deriveStudentId } from '@/lib/studentId';
import { buildCsv, downloadCsv } from '@/lib/csv';
import type { StudentFile, Level } from '@/lib/types';

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `file-${Date.now()}-${idCounter}`;
}

export default function Page() {
  const [subject, setSubject] = useState('Mathematics AA');
  const [level, setLevel] = useState<Level>('HL');
  const [files, setFiles] = useState<StudentFile[]>([]);
  const [running, setRunning] = useState(false);

  const addFiles = useCallback((incoming: File[]) => {
    const pdfsOnly = incoming.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const entries: StudentFile[] = pdfsOnly.map(file => ({
      id: makeId(),
      file,
      fileName: file.name,
      studentId: deriveStudentId(file.name),
      status: 'queued',
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

  const runPipeline = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const runSubject = subject;
    const runLevel = level;
    const toRun = files.filter(f => f.status === 'queued' || f.status === 'error');

    for (const entry of toRun) {
      setFiles(prev => prev.map(f => (f.id === entry.id ? { ...f, status: 'processing', error: null } : f)));
      try {
        const { result, ocrText } = await gradeFile(entry.file, runSubject, runLevel, () => {
          setFiles(prev => prev.map(f => (f.id === entry.id ? { ...f, status: 'ocr' } : f)));
        });
        setFiles(prev => prev.map(f => (f.id === entry.id ? { ...f, status: 'done', result, ocrText } : f)));
      } catch (err) {
        setFiles(prev =>
          prev.map(f => (f.id === entry.id ? { ...f, status: 'error', error: (err as Error).message } : f))
        );
      }
    }

    setRunning(false);
  }, [files, running, subject, level]);

  const handleExport = useCallback(() => {
    downloadCsv(buildCsv(files), 'grading-results.csv');
  }, [files]);

  const total = files.length;
  const processedCount = files.filter(f => f.status === 'done' || f.status === 'error').length;
  const progressLabel = total > 0 ? `${processedCount} / ${total} processed` : '';
  const canRun = !running && files.some(f => f.status === 'queued' || f.status === 'error');
  const doneCount = files.filter(f => f.status === 'done').length;

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
        subject={subject}
        onSubjectChange={setSubject}
        level={level}
        onLevelChange={setLevel}
        onFilesAdded={addFiles}
        onRun={runPipeline}
        running={running}
        canRun={canRun}
        progressLabel={progressLabel}
      />

      <FileQueue files={files} onRemove={removeFile} />
      <Dashboard
        files={files}
        onTeacherFeedbackChange={updateTeacherFeedback}
        onExport={handleExport}
        exportDisabled={doneCount === 0}
      />
    </main>
  );
}
