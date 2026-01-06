// Report Card Template Types (Marks-based)

export interface ReportCriteriaRow {
  id: string;
  criteria_name: string;
  max_marks: number;
}

export interface ReportSection {
  id: string;
  title: string;
  criteria: ReportCriteriaRow[];
  showSubtotal?: boolean;
}

export interface TemplateStructure {
  sections: ReportSection[];
}

// UI state for examiner entry
export interface CriteriaValue {
  criteriaId: string;
  sectionId: string;
  obtained_marks: number | null;
  remarks?: string;
}

// Payload shape we persist in exams.criteria_values_json (STRICT)
export interface StoredCriteriaEntry {
  criteria_name: string;
  obtained_marks: number;
  max_marks: number;
  remarks?: string;
}

export const createEmptySection = (): ReportSection => ({
  id: crypto.randomUUID(),
  title: '',
  criteria: [],
  showSubtotal: true,
});

export const createEmptyCriteria = (): ReportCriteriaRow => ({
  id: crypto.randomUUID(),
  criteria_name: '',
  max_marks: 10,
});

export const calculateMaxScore = (structure: TemplateStructure): number => {
  let total = 0;
  for (const section of structure.sections) {
    for (const criteria of section.criteria) {
      total += Number(criteria.max_marks) || 0;
    }
  }
  return total;
};

export const calculateSectionMaxScore = (section: ReportSection): number => {
  let total = 0;
  for (const criteria of section.criteria) {
    total += Number(criteria.max_marks) || 0;
  }
  return total;
};

