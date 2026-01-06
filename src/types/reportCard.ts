// Report Card Template Types

export type CriteriaType = 'numeric' | 'skill' | 'star' | 'grade';

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
  starMax?: number; // For star type, default 5
  gradeLabels?: string[]; // For grade type, e.g., ["F", "D", "C", "B", "A"]
  isPublic: boolean;
}

export interface Section {
  id: string;
  title: string;
  criteria: Criteria[];
  showSubtotal?: boolean; // Show section subtotal
}

export interface TemplateStructure {
  sections: Section[];
}

// Default skill labels
export const DEFAULT_SKILL_LABELS = ['Beginning', 'Progressing', 'Mastered'];

// Default star rating max
export const DEFAULT_STAR_MAX = 5;

// Default grade labels (A-F scheme)
export const DEFAULT_GRADE_LABELS = ['F', 'D', 'C', 'B', 'A'];

// Helper to create empty section
export const createEmptySection = (): Section => ({
  id: crypto.randomUUID(),
  title: '',
  criteria: [],
  showSubtotal: true,
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
      } else if (criteria.type === 'star') {
        total += criteria.starMax || DEFAULT_STAR_MAX;
      } else if (criteria.type === 'grade') {
        total += (criteria.gradeLabels?.length || DEFAULT_GRADE_LABELS.length) - 1; // A=4, B=3, C=2, D=1, F=0
      }
    }
  }
  return total;
};

// Calculate section subtotal max score
export const calculateSectionMaxScore = (section: Section): number => {
  let total = 0;
  for (const criteria of section.criteria) {
    if (criteria.type === 'numeric' && criteria.maxMarks) {
      total += criteria.maxMarks;
    } else if (criteria.type === 'skill') {
      total += 3;
    } else if (criteria.type === 'star') {
      total += criteria.starMax || DEFAULT_STAR_MAX;
    } else if (criteria.type === 'grade') {
      total += (criteria.gradeLabels?.length || DEFAULT_GRADE_LABELS.length) - 1;
    }
  }
  return total;
};

// Submission value for a criteria
export interface CriteriaValue {
  criteriaId: string;
  sectionId: string;
  value: number | string; // number for numeric/star, skill/grade label for skill/grade type
  numericValue: number; // Always a number for calculations
}
