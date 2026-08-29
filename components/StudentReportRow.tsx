'use client';

import { useEffect, useState } from 'react';
import styles from './StudentReportRow.module.css';
import AnnotatedPageView from './AnnotatedPageView';
import ScoreRing from './ScoreRing';
import SubjectIcon from './SubjectIcon';
import TeacherFeedbackBox from './TeacherFeedbackBox';
import WhyThisMarkPanel from './WhyThisMarkPanel';
import { getBand, BAND_LABELS, BAND_COLORS, approxIbGrade } from '@/lib/gradeBands';
import type { GradedQuestion, StudentFile } from '@/lib/types';

interface StudentReportRowProps {
  file: StudentFile;
  onTeacherFeedbackChange: (text: string) => void;
}

export default function StudentReportRow({ file, onTeacherFeedbackChange }: StudentReportRowProps) {
  const [tab, setTab] = useState<'overview' | 'questions' | 'annotated' | 'pdf' | 'ocr'>('overview');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [whyMarkQuestion, setWhyMarkQuestion] = useState<GradedQuestion | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file.file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file.file]);

  const r = file.result;
  if (!r) return null;

  const band = getBand(r.totalScore, r.maxTotal);
  const pct = r.maxTotal > 0 ? r.totalScore / r.maxTotal : 0;
  const grade = approxIbGrade(r.totalScore, r.maxTotal);

  return (
    <div className={`${styles.report} fade-in`}>
      <div className={styles.tabs}>
        <button className={tab === 'overview' ? styles.activeTab : ''} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tab === 'questions' ? styles.activeTab : ''} onClick={() => setTab('questions')}>
          Questions
        </button>
        {file.ocrPages && file.ocrPages.length > 0 && (
          <button className={tab === 'annotated' ? styles.activeTab : ''} onClick={() => setTab('annotated')}>
            Annotated paper
          </button>
        )}
        <button className={tab === 'pdf' ? styles.activeTab : ''} onClick={() => setTab('pdf')}>
          Original PDF
        </button>
        {file.ocrText && (
          <button className={tab === 'ocr' ? styles.activeTab : ''} onClick={() => setTab('ocr')}>
            OCR text
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <div className={styles.overview}>
          <ScoreRing score={r.totalScore} maxScore={r.maxTotal} band={band} />
          <div className={styles.overviewMeta}>
            <p className={styles.subjectLine}>
              <SubjectIcon subject={r.detectedSubject} />
              Detected subject: <strong>{r.detectedSubject}</strong>
            </p>
            <p className={styles.gradeLine}>
              Approx. IB grade: <strong>{grade}</strong> <span className={styles.approxNote}>(approx.)</span>
            </p>
            <div className={styles.scaleBar}>
              <div className={styles.scaleTrack}>
                <div
                  className={styles.scaleFill}
                  style={{ width: `${Math.min(100, pct * 100)}%`, background: BAND_COLORS[band] }}
                />
              </div>
              <div className={styles.scaleLabels}>
                <span>0</span>
                <span>{Math.round(r.maxTotal / 2)}</span>
                <span>{r.maxTotal}</span>
              </div>
            </div>
            {r.generalFeedback.length > 0 && (
              <ul className={styles.feedbackList}>
                {r.generalFeedback.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
            {r.error && <p className={styles.errorNote}>{r.error}</p>}
            {!r.error && file.reviewReason && <p className={styles.reviewNote}>⚠ {file.reviewReason}</p>}
            {typeof file.ocrConfidence === 'number' && (
              <p className={styles.confidenceNote}>OCR confidence: {Math.round(file.ocrConfidence * 100)}%</p>
            )}
            <TeacherFeedbackBox initialValue={file.teacherFeedback} onSave={onTeacherFeedbackChange} />
          </div>
        </div>
      )}

      {tab === 'questions' && (
        <div className={styles.questions}>
          {r.questions.map(q => {
            const qBand = getBand(q.score, q.maxScore);
            const qPct = q.maxScore > 0 ? (q.score / q.maxScore) * 100 : 0;
            return (
              <div key={q.number} className={styles.questionCard}>
                <div className={styles.questionHead}>
                  <span>Q{q.number}</span>
                  <span className={`${styles.tag} ${styles[qBand]}`}>{BAND_LABELS[qBand]}</span>
                </div>
                <div className={styles.miniBarTrack}>
                  <div className={styles.miniBarFill} style={{ width: `${qPct}%`, background: BAND_COLORS[qBand] }} />
                </div>
                <p className={styles.questionText}>{q.questionText}</p>
                <p className={styles.answerText}>{q.answerText}</p>
                <p className={styles.feedback}>
                  <span>{q.feedback}</span>
                  <button
                    type="button"
                    className={styles.scoreTag}
                    onClick={() => setWhyMarkQuestion(q)}
                    title="Why this mark?"
                  >
                    {q.score}/{q.maxScore} <span aria-hidden="true">ⓘ</span>
                  </button>
                </p>
                {q.criteria.length > 0 && (
                  <div className={styles.criteriaList}>
                    {q.criteria.map(c => (
                      <div key={c.code} className={styles.criterionRow}>
                        <div className={styles.criterionHead}>
                          <span className={styles.criterionName}>
                            {c.code}: {c.name}
                          </span>
                          <span className={styles.criterionScore}>
                            {c.score}/{c.maxScore}
                          </span>
                        </div>
                        {c.comment && <p className={styles.criterionComment}>{c.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'annotated' && file.ocrPages && (
        <AnnotatedPageView pages={file.ocrPages} annotations={r.annotations} />
      )}

      {tab === 'pdf' && (
        <div className={styles.pdfPane}>
          {pdfUrl ? (
            <iframe src={pdfUrl} title={`${file.fileName} - original scanned sheet`} className={styles.pdfFrame} />
          ) : (
            <p className={styles.ocrHint}>Loading PDF…</p>
          )}
        </div>
      )}

      {tab === 'ocr' && file.ocrText && (
        <div className={styles.ocrPane}>
          <p className={styles.ocrHint}>Raw text extracted by PaddleOCR, before it was sent to Groq for grading.</p>
          <pre className={styles.ocrText}>{file.ocrText}</pre>
        </div>
      )}

      <WhyThisMarkPanel question={whyMarkQuestion} onClose={() => setWhyMarkQuestion(null)} />
    </div>
  );
}
