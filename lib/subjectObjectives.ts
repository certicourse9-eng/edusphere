import type { CourseworkType, IBProgramme } from './types';

/**
 * IB DP-style assessment criteria, used so grading is broken down the way a
 * real IB examiner's markscheme is structured - several named criteria per
 * piece of work, not one blended score. Criterion names/structures follow
 * the general shape of each subject group's published IB DP assessment
 * objectives and coursework components (Internal Assessment, Extended
 * Essay, TOK, external exam papers); descriptions here are original
 * summaries written for this demo, not copied from official IB subject
 * guides or markschemes. This is a demo approximation, not an official
 * IB resource - always verify against the current subject guide for real
 * grading decisions.
 */
export interface SubjectCriterion {
  code: string;
  name: string;
  description: string;
  maxScore: number;
}

const GENERAL_SUBJECT = 'General / Other';

// ---------- External Assessment (exam-style answer sheets) ----------

const sciencesExternal: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant facts, concepts, and terminology correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to analyse, interpret, or solve the specific problem asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse methods, data, or explanations, and evaluate their strengths, limitations, or validity.', maxScore: 2 },
  { code: 'AO4', name: 'Scientific communication', description: 'Use correct scientific terminology, units, and a clear, well-structured written explanation.', maxScore: 2 }
];

const mathExternal: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and technique', description: 'Recall and correctly apply the relevant mathematical concepts and techniques.', maxScore: 2 },
  { code: 'AO2', name: 'Problem-solving', description: 'Select and use an appropriate strategy to solve the specific problem posed.', maxScore: 2 },
  { code: 'AO3', name: 'Reasoning', description: 'Reason logically, justify steps, and reach a valid, well-supported conclusion.', maxScore: 2 },
  { code: 'AO4', name: 'Communication', description: 'Show working clearly, using correct mathematical notation and a logical layout.', maxScore: 2 }
];

const computerScienceExternal: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant computing concepts, structures, or algorithms correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to design or trace a solution to the specific problem asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse a solution, algorithm, or system design, and evaluate its efficiency or correctness.', maxScore: 2 },
  { code: 'AO4', name: 'Technical communication', description: 'Use correct technical terminology and clear, logically-structured explanation or pseudocode.', maxScore: 2 }
];

const individualsAndSocietiesExternal: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant concepts, theories, events, or terminology correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to the specific scenario, source, or question asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse evidence or arguments, and evaluate differing perspectives, evidence, or interpretations.', maxScore: 2 },
  { code: 'AO4', name: 'Structured argument', description: 'Construct a clear, well-organized, and well-substantiated written argument.', maxScore: 2 }
];

const languageAndLiteratureExternal: SubjectCriterion[] = [
  { code: 'A', name: 'Knowledge, understanding and interpretation', description: 'Show understanding of the text/passage and interpret its meaning appropriately.', maxScore: 2 },
  { code: 'B', name: 'Analysis and evaluation', description: 'Analyse how language, style, and structure create meaning and effect.', maxScore: 2 },
  { code: 'C', name: 'Focus and organization', description: 'Organize ideas into a clear, coherent, well-structured response.', maxScore: 2 },
  { code: 'D', name: 'Language', description: 'Use accurate, appropriately-styled written expression.', maxScore: 2 }
];

const generalExternal: SubjectCriterion[] = [
  { code: 'AO1', name: 'Knowledge and understanding', description: 'Recall and explain relevant subject matter correctly.', maxScore: 2 },
  { code: 'AO2', name: 'Application', description: 'Apply that knowledge to the specific question asked.', maxScore: 2 },
  { code: 'AO3', name: 'Analysis and evaluation', description: 'Analyse and evaluate ideas, evidence, or working critically.', maxScore: 2 },
  { code: 'AO4', name: 'Communication', description: 'Communicate the response clearly and in a well-organized way.', maxScore: 2 }
];

const EXTERNAL_CRITERIA: Record<string, SubjectCriterion[]> = {
  Biology: sciencesExternal,
  Chemistry: sciencesExternal,
  Physics: sciencesExternal,
  'Computer Science': computerScienceExternal,
  'Mathematics AA': mathExternal,
  'Mathematics AI': mathExternal,
  'Business Management': individualsAndSocietiesExternal,
  Economics: individualsAndSocietiesExternal,
  History: individualsAndSocietiesExternal,
  Psychology: individualsAndSocietiesExternal,
  'English A Language & Literature': languageAndLiteratureExternal,
  [GENERAL_SUBJECT]: generalExternal
};

// ---------- Internal Assessment (subject-specific coursework) ----------

const sciencesInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Personal engagement', description: 'Show genuine personal interest, initiative, or independent thinking in the investigation.', maxScore: 1 },
  { code: 'B', name: 'Exploration', description: 'Establish a focused, researchable topic with an appropriate, well-designed methodology.', maxScore: 2 },
  { code: 'C', name: 'Analysis', description: 'Process and analyse data or evidence appropriately, with recognition of uncertainty/limitations.', maxScore: 2 },
  { code: 'D', name: 'Evaluation', description: 'Evaluate the investigation’s validity and suggest realistic, relevant improvements.', maxScore: 2 },
  { code: 'E', name: 'Communication', description: 'Present the investigation clearly, concisely, and in a well-structured way.', maxScore: 1 }
];

const mathInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Presentation', description: 'Organize the exploration into a coherent, well-structured, easy-to-follow piece of work.', maxScore: 1 },
  { code: 'B', name: 'Mathematical communication', description: 'Use appropriate mathematical language, notation, and representations consistently.', maxScore: 1 },
  { code: 'C', name: 'Personal engagement', description: 'Show independent thinking, creativity, or a genuine personal interest in the topic.', maxScore: 1 },
  { code: 'D', name: 'Reflection', description: 'Critically reflect on findings, methods used, and their implications or limitations.', maxScore: 1 },
  { code: 'E', name: 'Use of mathematics', description: 'Apply mathematics that is correct, relevant, and appropriately rigorous for the level.', maxScore: 2 }
];

const computerScienceInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Planning', description: 'Define a clear, appropriately-scoped problem and a realistic plan of action.', maxScore: 1 },
  { code: 'B', name: 'Solution overview', description: 'Describe the proposed solution’s design, structure, and key techniques clearly.', maxScore: 1 },
  { code: 'C', name: 'Development', description: 'Implement a solution that reflects sound technique and is fit for purpose.', maxScore: 2 },
  { code: 'D', name: 'Functionality and extensibility', description: 'Demonstrate a solution that works as intended and could reasonably be extended.', maxScore: 1 },
  { code: 'E', name: 'Evaluation', description: 'Evaluate the solution’s success against the original goals, with justified improvements.', maxScore: 1 }
];

const historyInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Focus and method', description: 'Set out a clear, focused research question with an appropriate method/sources.', maxScore: 1 },
  { code: 'B', name: 'Knowledge and understanding', description: 'Show accurate, relevant historical knowledge and context.', maxScore: 2 },
  { code: 'C', name: 'Critical analysis', description: 'Analyse and evaluate evidence and differing historical perspectives critically.', maxScore: 2 },
  { code: 'D', name: 'Conclusion', description: 'Reach a conclusion that is clearly linked to the evidence and argument presented.', maxScore: 1 },
  { code: 'E', name: 'Presentation', description: 'Structure and reference the work clearly and consistently.', maxScore: 1 }
];

const economicsInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Diagrams', description: 'Use correct, clearly-labelled economic diagrams relevant to the argument.', maxScore: 1 },
  { code: 'B', name: 'Terminology', description: 'Use economic terminology accurately and appropriately throughout.', maxScore: 1 },
  { code: 'C', name: 'Application and analysis', description: 'Apply economic theory to the real-world article/situation with clear analysis.', maxScore: 2 },
  { code: 'D', name: 'Evaluation', description: 'Evaluate the economic issue critically, considering different stakeholders or viewpoints.', maxScore: 2 },
  { code: 'E', name: 'Structure', description: 'Present the commentary within a clear, well-organized structure.', maxScore: 1 }
];

const businessManagementInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Research', description: 'Use relevant, appropriately-referenced research or data to support the investigation.', maxScore: 1 },
  { code: 'B', name: 'Conceptual understanding', description: 'Show accurate understanding of relevant business concepts and tools.', maxScore: 1 },
  { code: 'C', name: 'Application', description: 'Apply business tools/theories appropriately to the specific organization or issue.', maxScore: 2 },
  { code: 'D', name: 'Analysis and evaluation', description: 'Analyse findings critically and evaluate them to reach a justified conclusion.', maxScore: 2 },
  { code: 'E', name: 'Presentation', description: 'Present the work clearly, logically, and within a professional structure.', maxScore: 1 }
];

const psychologyInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Focus and method', description: 'State a clear, appropriate research question and replicate a method soundly.', maxScore: 1 },
  { code: 'B', name: 'Knowledge and understanding', description: 'Show accurate understanding of the psychological theory/study being applied.', maxScore: 2 },
  { code: 'C', name: 'Analysis', description: 'Analyse results or data appropriately, including relevant statistics or observations.', maxScore: 2 },
  { code: 'D', name: 'Evaluation', description: 'Evaluate the investigation’s method, results, and implications critically.', maxScore: 1 },
  { code: 'E', name: 'Communication', description: 'Present the report clearly, concisely, and in the expected structure.', maxScore: 1 }
];

const languageAndLiteratureInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Knowledge and understanding', description: 'Show understanding of the text(s)/topic discussed and its context.', maxScore: 2 },
  { code: 'B', name: 'Analysis and evaluation', description: 'Analyse how language, technique, and structure create meaning and effect.', maxScore: 2 },
  { code: 'C', name: 'Focus and organization', description: 'Organize the response with a clear focus and logical structure.', maxScore: 1 },
  { code: 'D', name: 'Language', description: 'Use accurate, appropriately-registered language throughout.', maxScore: 1 }
];

const generalInternal: SubjectCriterion[] = [
  { code: 'A', name: 'Personal engagement', description: 'Show genuine initiative, curiosity, or independent thinking in the work.', maxScore: 1 },
  { code: 'B', name: 'Knowledge and understanding', description: 'Show accurate, relevant subject knowledge.', maxScore: 2 },
  { code: 'C', name: 'Analysis and evaluation', description: 'Analyse findings or evidence and evaluate them critically.', maxScore: 2 },
  { code: 'D', name: 'Communication', description: 'Present the work clearly and in a well-organized structure.', maxScore: 1 }
];

const INTERNAL_CRITERIA: Record<string, SubjectCriterion[]> = {
  Biology: sciencesInternal,
  Chemistry: sciencesInternal,
  Physics: sciencesInternal,
  'Computer Science': computerScienceInternal,
  'Mathematics AA': mathInternal,
  'Mathematics AI': mathInternal,
  'Business Management': businessManagementInternal,
  Economics: economicsInternal,
  History: historyInternal,
  Psychology: psychologyInternal,
  'English A Language & Literature': languageAndLiteratureInternal,
  [GENERAL_SUBJECT]: generalInternal
};

// ---------- Extended Essay (subject-agnostic, fixed criteria) ----------
// Criterion names and point totals follow the current EE assessment
// structure (A-E, out of 34 total); descriptions are original wording.

const EXTENDED_ESSAY_CRITERIA: SubjectCriterion[] = [
  { code: 'A', name: 'Focus and method', description: 'A clear, focused research question with an appropriate, well-justified methodology.', maxScore: 6 },
  { code: 'B', name: 'Knowledge and understanding', description: 'Accurate subject knowledge and understanding situated in relevant context.', maxScore: 6 },
  { code: 'C', name: 'Critical thinking', description: 'Clear evidence of analysis, evaluation, and synthesis leading to a well-supported argument.', maxScore: 12 },
  { code: 'D', name: 'Presentation', description: 'A well-structured essay following the required layout and academic conventions.', maxScore: 4 },
  { code: 'E', name: 'Engagement', description: 'Genuine reflection on the research process and personal engagement with the topic.', maxScore: 6 }
];

// ---------- TOK essay/exhibition (subject-agnostic, fixed criteria) ----------
// Real TOK essays are officially marked with a single holistic impression
// rather than separate weighted criteria - these are broken into components
// here purely so this demo can give more specific, actionable feedback per
// aspect of the response; treat this as a pedagogical simplification, not
// the official TOK marking method.

const TOK_CRITERIA: SubjectCriterion[] = [
  { code: 'A', name: 'Knowledge question focus', description: 'Clearly identifies and develops a genuine, relevant knowledge question.', maxScore: 3 },
  { code: 'B', name: 'Use of examples/areas of knowledge', description: 'Uses specific, well-chosen examples across relevant areas of knowledge.', maxScore: 3 },
  { code: 'C', name: 'Argumentation and depth', description: 'Develops a reasoned argument, considering counterclaims and implications.', maxScore: 2 },
  { code: 'D', name: 'Structure and clarity', description: 'Organizes the response clearly with coherent, well-expressed ideas.', maxScore: 2 }
];

// ---------- MYP (Middle Years Programme) subject-group criteria ----------
// MYP grades each subject against exactly 4 criteria (A-D), each scored as an
// achievement LEVEL from 0-8 (not raw exam marks) - a structurally different
// model from DP's assessment-objective marking above. Criteria are assigned
// per MYP subject GROUP (Sciences, Mathematics, Individuals & Societies,
// Language and Literature, Design) since that's what the real MYP subject
// guides define; EduSphere's subject list is DP-flavoured, so each DP
// subject name below maps to its corresponding MYP subject-group criteria.
// Names follow the shape of the published MYP subject-group criteria;
// descriptions are original wording, not copied from official IB guides.

const mypSciences: SubjectCriterion[] = [
  { code: 'A', name: 'Knowing and understanding', description: 'Recall scientific knowledge and apply it to construct explanations of phenomena and solve problems.', maxScore: 8 },
  { code: 'B', name: 'Inquiring and designing', description: 'Formulate a testable question or hypothesis and design a methodical, controlled investigation.', maxScore: 8 },
  { code: 'C', name: 'Processing and evaluating', description: 'Present, interpret, and process data accurately, and evaluate the investigation’s validity.', maxScore: 8 },
  { code: 'D', name: 'Reflecting on the impacts of science', description: 'Explain the ways science is applied to solve problems and evaluate its implications.', maxScore: 8 }
];

const mypMathematics: SubjectCriterion[] = [
  { code: 'A', name: 'Knowing and understanding', description: 'Select and apply the appropriate mathematical knowledge and techniques correctly.', maxScore: 8 },
  { code: 'B', name: 'Investigating patterns', description: 'Look for patterns, describe them as relationships or rules, and justify or verify them.', maxScore: 8 },
  { code: 'C', name: 'Communicating', description: 'Use appropriate mathematical language and multiple forms of representation clearly.', maxScore: 8 },
  { code: 'D', name: 'Applying mathematics in real-life contexts', description: 'Identify relevant elements of a real-world situation and apply mathematics to solve it.', maxScore: 8 }
];

const mypIndividualsAndSocieties: SubjectCriterion[] = [
  { code: 'A', name: 'Knowing and understanding', description: 'Recall relevant terminology, concepts, and content accurately.', maxScore: 8 },
  { code: 'B', name: 'Investigating', description: 'Formulate a clear, focused question and plan and follow a research process to answer it.', maxScore: 8 },
  { code: 'C', name: 'Communicating', description: 'Communicate ideas using appropriate terminology in a style suited to the audience and purpose.', maxScore: 8 },
  { code: 'D', name: 'Thinking critically', description: 'Analyse and evaluate a range of sources, evidence, and perspectives to form a conclusion.', maxScore: 8 }
];

const mypLanguageAndLiterature: SubjectCriterion[] = [
  { code: 'A', name: 'Analysing', description: 'Analyse content, context, language, structure, technique, and style in a range of texts.', maxScore: 8 },
  { code: 'B', name: 'Organizing', description: 'Organize ideas and arguments coherently, with an effective, logical structure.', maxScore: 8 },
  { code: 'C', name: 'Producing text', description: 'Produce imaginative, coherent, and stylistically effective text for a range of purposes.', maxScore: 8 },
  { code: 'D', name: 'Using language', description: 'Use accurate, varied language appropriate to the context and register.', maxScore: 8 }
];

const mypDesign: SubjectCriterion[] = [
  { code: 'A', name: 'Inquiring and analysing', description: 'Explain and justify the need for a solution to a problem, and analyse relevant research.', maxScore: 8 },
  { code: 'B', name: 'Developing ideas', description: 'Develop feasible design specifications and a range of justified, testable design ideas.', maxScore: 8 },
  { code: 'C', name: 'Creating the solution', description: 'Follow a plan to create a solution that is fit for purpose.', maxScore: 8 },
  { code: 'D', name: 'Evaluating', description: 'Evaluate the solution’s success against the design specification, with justified improvements.', maxScore: 8 }
];

const mypGeneral: SubjectCriterion[] = [
  { code: 'A', name: 'Knowing and understanding', description: 'Recall and explain relevant subject knowledge accurately.', maxScore: 8 },
  { code: 'B', name: 'Investigating / applying', description: 'Apply knowledge and skills to investigate or solve the specific task set.', maxScore: 8 },
  { code: 'C', name: 'Communicating', description: 'Communicate ideas clearly, using appropriate terminology and structure.', maxScore: 8 },
  { code: 'D', name: 'Thinking critically / reflecting', description: 'Analyse, evaluate, or reflect critically on the work and its wider implications.', maxScore: 8 }
];

const MYP_CRITERIA: Record<string, SubjectCriterion[]> = {
  Biology: mypSciences,
  Chemistry: mypSciences,
  Physics: mypSciences,
  'Computer Science': mypDesign,
  'Mathematics AA': mypMathematics,
  'Mathematics AI': mypMathematics,
  'Business Management': mypIndividualsAndSocieties,
  Economics: mypIndividualsAndSocieties,
  History: mypIndividualsAndSocieties,
  Psychology: mypIndividualsAndSocieties,
  'English A Language & Literature': mypLanguageAndLiterature,
  [GENERAL_SUBJECT]: mypGeneral
};

export function getCriteria(programme: IBProgramme, courseworkType: CourseworkType, subject: string): SubjectCriterion[] {
  // Extended Essay and TOK are DP/CP components with no MYP equivalent - grade them the
  // same fixed way regardless of programme rather than inventing an MYP-flavoured version.
  if (courseworkType === 'extended-essay') return EXTENDED_ESSAY_CRITERIA;
  if (courseworkType === 'tok') return TOK_CRITERIA;

  if (programme === 'MYP') return MYP_CRITERIA[subject] ?? mypGeneral;

  if (courseworkType === 'internal-assessment') return INTERNAL_CRITERIA[subject] ?? generalInternal;
  // 'external-assessment' and 'exam' are graded the same way — externally-set,
  // subject-specific assessment objective criteria.
  return EXTERNAL_CRITERIA[subject] ?? generalExternal;
}

/** True for criteria scored as an MYP achievement level (0-8) rather than DP-style raw marks. */
export function isMypCriteria(programme: IBProgramme, courseworkType: CourseworkType): boolean {
  return programme === 'MYP' && courseworkType !== 'extended-essay' && courseworkType !== 'tok';
}
