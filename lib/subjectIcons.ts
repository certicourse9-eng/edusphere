export type IconAnimation = 'spin' | 'bounce' | 'wiggle' | 'pulse' | 'flip';

export interface SubjectIconMeta {
  emoji: string;
  animation: IconAnimation;
}

export const SUBJECT_ICONS: Record<string, SubjectIconMeta> = {
  Biology: { emoji: '🧬', animation: 'spin' },
  Chemistry: { emoji: '🧪', animation: 'wiggle' },
  Physics: { emoji: '⚛️', animation: 'spin' },
  'Mathematics AA': { emoji: '📐', animation: 'pulse' },
  'Mathematics AI': { emoji: '📊', animation: 'bounce' },
  'Business Management': { emoji: '💼', animation: 'wiggle' },
  Economics: { emoji: '📈', animation: 'bounce' },
  'English A Language & Literature': { emoji: '📖', animation: 'flip' },
  History: { emoji: '🏛️', animation: 'pulse' },
  Psychology: { emoji: '🧠', animation: 'pulse' },
  'Computer Science': { emoji: '💻', animation: 'wiggle' },
  'General / Other': { emoji: '📄', animation: 'bounce' }
};

export const SUBJECTS = Object.keys(SUBJECT_ICONS);
