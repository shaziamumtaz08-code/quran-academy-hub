// Report Card Template Types

export type CriteriaType = 'numeric' | 'skill';

export interface SkillLevel {
  label: string;
  value: number; // 1, 2, 3 for ordering/scoring
}

export interface Criteria {
  id: string;
  title: string;
  type: CriteriaType;
  maxMarks?: number; // Only for numeric type
  skillLabels?: string[]; // Only for skill type, e.g., ["Beginning", "Progressing", "Mastered"]
  isPublic: boolean;
}

export interface Section {
  id: string;
  title: string;
  criteria: Criteria[];
}

export interface TemplateStructure {
  sections: Section[];
}

// Default skill labels
export const DEFAULT_SKILL_LABELS = ['Beginning', 'Progressing', 'Mastered'];

// Helper to create empty section
export const createEmptySection = (): Section => ({
  id: crypto.randomUUID(),
  title: '',
  criteria: [],
});

// Helper to create empty criteria
export const createEmptyCriteria = (): Criteria => ({
  id: crypto.randomUUID(),
  title: '',
  type: 'numeric',
  maxMarks: 10,
  isPublic: true,
});

// Helper to calculate max possible score from structure
export const calculateMaxScore = (structure: TemplateStructure): number => {
  let total = 0;
  for (const section of structure.sections) {
    for (const criteria of section.criteria) {
      if (criteria.type === 'numeric' && criteria.maxMarks) {
        total += criteria.maxMarks;
      } else if (criteria.type === 'skill') {
        total += 3; // Skill levels are scored 1-3
      }
    }
  }
  return total;
};

// Submission value for a criteria
export interface CriteriaValue {
  criteriaId: string;
  sectionId: string;
  value: number | string; // number for numeric, skill label for skill type
  numericValue: number; // Always a number for calculations
}
