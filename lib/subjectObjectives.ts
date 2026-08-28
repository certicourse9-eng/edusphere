/**
 * IB DP-style assessment criteria per subject group, used so grading is
 * broken down the way a real IB examiner's markscheme is structured -
 * several named criteria per question, not one blended score. Criterion
 * names follow the general shape of each subject group's published IB DP
 * assessment objectives; descriptions here are original summaries written
 * for this demo, not copied from official IB subject guides or markschemes.
 * maxScore is fixed per criterion (not official IB weighting) purely so
 * totals stay consistent across gradings in this demo.
 */
export interface SubjectCriterion {
  code: string;
  name: string;
  description: string;
  maxScore: number;
}

const sciencesCriteria: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant facts, concepts, and terminology correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to analyse, interpret, or solve the specific problem asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse methods, data, or explanations, and evaluate their strengths, limitations, or validity.', maxScore: 2 },
  { code: 'AO4', name: 'Scientific communication', description: 'Use correct scientific terminology, units, and a clear, well-structured written explanation.', maxScore: 2 }
];

const mathCriteria: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and technique', description: 'Recall and correctly apply the relevant mathematical concepts and techniques.', maxScore: 2 },
  { code: 'AO2', name: 'Problem-solving', description: 'Select and use an appropriate strategy to solve the specific problem posed.', maxScore: 2 },
  { code: 'AO3', name: 'Reasoning', description: 'Reason logically, justify steps, and reach a valid, well-supported conclusion.', maxScore: 2 },
  { code: 'AO4', name: 'Communication', description: 'Show working clearly, using correct mathematical notation and a logical layout.', maxScore: 2 }
];

const computerScienceCriteria: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant computing concepts, structures, or algorithms correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to design or trace a solution to the specific problem asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse a solution, algorithm, or system design, and evaluate its efficiency or correctness.', maxScore: 2 },
  { code: 'AO4', name: 'Technical communication', description: 'Use correct technical terminology and clear, logically-structured explanation or pseudocode.', maxScore: 2 }
];

const individualsAndSocietiesCriteria: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant concepts, theories, events, or terminology correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to the specific scenario, source, or question asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse evidence or arguments, and evaluate differing perspectives, evidence, or interpretations.', maxScore: 2 },
  { code: 'AO4', name: 'Structured argument', description: 'Construct a clear, well-organized, and well-substantiated written argument.', maxScore: 2 }
];

const languageAndLiteratureCriteria: SubjectCriterion[] = [
  { code: 'A', name: 'Knowledge, understanding and interpretation', description: 'Show understanding of the text/passage and interpret its meaning appropriately.', maxScore: 2 },
  { code: 'B', name: 'Analysis and evaluation', description: 'Analyse how language, style, and structure create meaning and effect.', maxScore: 2 },
  { code: 'C', name: 'Focus and organization', description: 'Organize ideas into a clear, coherent, well-structured response.', maxScore: 2 },
  { code: 'D', name: 'Language', description: 'Use accurate, appropriately-styled written expression.', maxScore: 2 }
];

const generalCriteria: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant subject matter correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to the specific question asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse and evaluate ideas, evidence, or working critically.', maxScore: 2 },
  { code: 'AO4', name: 'Communication', description: 'Communicate the response clearly and in a well-organized way.', maxScore: 2 }
];

export const SUBJECT_CRITERIA: Record<string, SubjectCriterion[]> = {
  Biology: sciencesCriteria,
  Chemistry: sciencesCriteria,
  Physics: sciencesCriteria,
  'Computer Science': computerScienceCriteria,
  'Mathematics AA': mathCriteria,
  'Mathematics AI': mathCriteria,
  'Business Management': individualsAndSocietiesCriteria,
  Economics: individualsAndSocietiesCriteria,
  History: individualsAndSocietiesCriteria,
  Psychology: individualsAndSocietiesCriteria,
  'English A Language & Literature': languageAndLiteratureCriteria,
  'General / Other': generalCriteria
};

export function getSubjectCriteria(subject: string): SubjectCriterion[] {
  return SUBJECT_CRITERIA[subject] ?? generalCriteria;
}
