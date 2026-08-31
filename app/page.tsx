'use client';

import UploadPanel from '@/components/UploadPanel';
import FileQueue from '@/components/FileQueue';
import ClassProgressBar from '@/components/ClassProgressBar';
import Dashboard from '@/components/Dashboard';
import HeroBlobs from '@/components/HeroBlobs';
import AnalyticsPreviewCard from '@/components/analytics/AnalyticsPreviewCard';
import GradeBoundariesPanel from '@/components/GradeBoundariesPanel';
import { useClassSession } from '@/lib/ClassSessionContext';

export default function Page() {
  const {
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
  } = useClassSession();

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

      <GradeBoundariesPanel programme={programme} boundaries={gradeBoundaries} onChange={setGradeBoundaries} />

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

      <AnalyticsPreviewCard files={files} evaluatedCount={evaluatedCount} expectedStudentCount={expected} />

      <FileQueue files={files} onRemove={removeFile} />
      <Dashboard
        files={files}
        onTeacherFeedbackChange={updateTeacherFeedback}
        onApprove={approveFile}
        onTeacherOverrideScoreChange={setTeacherOverrideScore}
        onExport={handleExport}
        exportDisabled={finishedCount === 0}
        gradeBoundaries={gradeBoundaries}
        programme={programme}
      />
    </main>
  );
}
