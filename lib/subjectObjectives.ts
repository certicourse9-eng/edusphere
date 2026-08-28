/**
 * Approximate IB-style assessment objectives per subject group, used to make
 * grading criteria actually differ by subject instead of applying one
 * generic rubric to every answer sheet. These are simplified, demo-purpose
 * summaries of the general shape of each subject group's real AOs - not a
 * substitute for an actual subject's official mark scheme.
 */
export const SUBJECT_OBJECTIVES: Record<string, string> = {
  Biology:
    'scientific knowledge and understanding of biological concepts; application of that knowledge to analyse, interpret, and solve problems; evaluation of scientific methods, data, and hypotheses; and accurate use of biological terminology and scientific communication',
  Chemistry:
    'scientific knowledge and understanding of chemical concepts; application of that knowledge to analyse, interpret, and solve problems; evaluation of experimental methods, data, and hypotheses; and accurate use of chemical terminology, formulae, and scientific communication',
  Physics:
    'scientific knowledge and understanding of physical concepts and principles; application of that knowledge to analyse, interpret, and solve problems, including calculations; evaluation of experimental methods, data, and hypotheses; and accurate use of physics terminology, units, and scientific communication',
  'Computer Science':
    'knowledge and understanding of computing concepts, algorithms, and systems; application of that knowledge to design, analyse, and solve computational problems; evaluation of solutions, algorithms, and system designs for efficiency and correctness; and accurate use of computer science terminology and clear technical communication',
  'Mathematics AA':
    'knowledge and understanding of mathematical concepts and techniques; problem-solving using appropriate mathematical strategies; accurate mathematical reasoning and proof; and clear, correctly-notated communication of mathematical working and conclusions',
  'Mathematics AI':
    'knowledge and understanding of mathematical and statistical concepts and techniques, with an emphasis on real-world application and modelling; problem-solving using appropriate tools and technology; accurate reasoning and interpretation of results in context; and clear, correctly-notated communication of mathematical working and conclusions',
  'Business Management':
    'knowledge and understanding of business concepts, theories, and tools; application of that knowledge to real or hypothetical business situations; analysis and evaluation of business decisions, strategies, and data using appropriate frameworks; and clear, well-structured business communication and argument',
  Economics:
    'knowledge and understanding of economic concepts, theories, and terminology; application of economic theory to real-world situations, often using diagrams; analysis and evaluation of economic arguments, policies, and trade-offs from multiple perspectives; and clear, well-structured economic argument',
  History:
    'knowledge and understanding of historical events, developments, and context; analysis of historical sources, causation, and change; evaluation of differing historical perspectives and interpretations, with appropriate use of evidence; and construction of a clear, well-substantiated historical argument',
  Psychology:
    'knowledge and understanding of psychological theories, studies, and concepts; application of that knowledge to explain behaviour and real-world scenarios; analysis and evaluation of research methodology, evidence, and competing explanations; and clear, well-structured psychological argument',
  'English A Language & Literature':
    'knowledge and understanding of the text(s) and their context; analysis of language, style, structure, and literary technique; evaluation of how meaning and effect are constructed, including alternative interpretations; and clear, well-organized, appropriately-styled written expression',
  'General / Other':
    'knowledge and understanding of the subject matter; application of that knowledge to the questions asked; analysis and evaluation of ideas, evidence, or working; and clear, well-organized communication'
};

export function getSubjectObjectives(subject: string): string {
  return SUBJECT_OBJECTIVES[subject] ?? SUBJECT_OBJECTIVES['General / Other'];
}
