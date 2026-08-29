'use client';

import { useMemo } from 'react';
import styles from './analytics.module.css';
import ProgressRing from './ProgressRing';
import DonutChart from './DonutChart';
import CriteriaRadarChart from './CriteriaRadarChart';
import StudentScoreBarChart from './StudentScoreBarChart';
import QuestionBarChart from './QuestionBarChart';
import ScoreTrendLine from './ScoreTrendLine';
import PerformanceHeatmap from './PerformanceHeatmap';
import { getBandCounts, getStudentScores, getQuestionAverages, getCriteriaAverages, getHeatmapData } from '@/lib/analytics';
import type { StudentFile } from '@/lib/types';

interface AnalyticsSectionProps {
  files: StudentFile[];
  evaluatedCount: number;
  expectedStudentCount: number;
}

export default function AnalyticsSection({ files, evaluatedCount, expectedStudentCount }: AnalyticsSectionProps) {
  const bandCounts = useMemo(() => getBandCounts(files), [files]);
  const studentScores = useMemo(() => getStudentScores(files), [files]);
  const questionAverages = useMemo(() => getQuestionAverages(files), [files]);
  const criteriaAverages = useMemo(() => getCriteriaAverages(files), [files]);
  const heatmapData = useMemo(() => getHeatmapData(files), [files]);

  if (files.length === 0) return null;

  const progressTotal = expectedStudentCount > 0 ? expectedStudentCount : files.length;

  return (
    <section className={`${styles.section} fade-in`}>
      <div className={styles.sectionHead}>
        <h2>Class analytics</h2>
        <p className={styles.sectionSub}>Visual breakdown of this class&apos;s grading, updated as papers are evaluated.</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.span4}>
          <ProgressRing evaluated={evaluatedCount} total={progressTotal} />
        </div>
        <div className={styles.span4}>
          <DonutChart counts={bandCounts} />
        </div>
        <div className={styles.span4}>
          <CriteriaRadarChart criteria={criteriaAverages} />
        </div>

        <div className={styles.span12}>
          <StudentScoreBarChart scores={studentScores} />
        </div>

        <div className={styles.span6}>
          <QuestionBarChart questions={questionAverages} />
        </div>
        <div className={styles.span6}>
          <ScoreTrendLine questions={questionAverages} />
        </div>

        <div className={styles.span12}>
          <PerformanceHeatmap data={heatmapData} />
        </div>
      </div>
    </section>
  );
}
