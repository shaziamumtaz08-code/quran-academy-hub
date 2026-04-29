// Subject Type Detection and Working Days Calculator

export type SubjectType = 'qaida' | 'hifz' | 'nazra' | 'academic';

// Keyword tables (lowercased). Each entry is matched against the trimmed,
// lowercased subject name with String.includes — so multi-word names like
// "Tahfeez Class" or "حفظ القرآن" are detected.
const HIFZ_KEYWORDS = ['hifz', 'hifdh', 'memorization', 'حفظ', 'tahfeez', 'tahfiz'];
const NAZRA_KEYWORDS = ['nazra', 'nazrah', 'reading', 'ناظرہ', 'recitation'];
const QAIDA_KEYWORDS = ['qaida', 'noorani', 'qaidah', 'noor', 'قاعدہ'];

/**
 * Detect subject type from subject name (and optional explicit type column).
 *
 * @param subjectName - Free-text subject name to keyword-match against.
 * @param explicitType - Optional value from a future `subjects.subject_type`
 *                      column. If it matches a known SubjectType, it wins
 *                      over keyword detection. Currently the schema has no
 *                      such column, so this argument is reserved for forward
 *                      compatibility.
 */
export function getSubjectType(
  subjectName: string | null | undefined,
  explicitType?: string | null
): SubjectType {
  // 1. Honour explicit type column if provided and recognised.
  if (explicitType) {
    const t = explicitType.toLowerCase().trim();
    if (t === 'qaida' || t === 'hifz' || t === 'nazra' || t === 'academic') {
      return t;
    }
  }

  // 2. Keyword match (case-insensitive, trimmed).
  if (!subjectName) return 'academic';
  const name = subjectName.toLowerCase().trim();
  if (!name) return 'academic';

  if (QAIDA_KEYWORDS.some(k => name.includes(k))) return 'qaida';
  if (HIFZ_KEYWORDS.some(k => name.includes(k))) return 'hifz';
  if (NAZRA_KEYWORDS.some(k => name.includes(k))) return 'nazra';

  return 'academic';
}

/**
 * Check if subject is Quran-related (Hifz, Nazra, or Qaida)
 */
export function isQuranSubject(subjectName: string | null | undefined): boolean {
  const type = getSubjectType(subjectName);
  return type !== 'academic';
}

/**
 * Check if subject is Hifz or Nazra (requires Surah/Verse tracking)
 */
export function isHifzOrNazra(subjectName: string | null | undefined): boolean {
  const type = getSubjectType(subjectName);
  return type === 'hifz' || type === 'nazra';
}

/**
 * Get day of week index (0 = Sunday, 1 = Monday, etc.)
 */
function getDayIndex(day: string): number {
  const days: Record<string, number> = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6,
  };
  return days[day.toLowerCase()] ?? -1;
}

/**
 * Calculate the number of working days in a given month based on schedule
 * @param scheduleDays - Array of day names (e.g., ['monday', 'wednesday', 'friday'])
 * @param year - Year number
 * @param month - Month number (1-12)
 * @returns Total number of teaching days in the month
 */
export function calculateWorkingDaysInMonth(
  scheduleDays: string[],
  year: number,
  month: number
): number {
  if (!scheduleDays || scheduleDays.length === 0) return 0;
  
  // Get first and last day of the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  
  // Convert schedule days to day indices
  const dayIndices = scheduleDays
    .map(d => getDayIndex(d))
    .filter(i => i >= 0);
  
  if (dayIndices.length === 0) return 0;
  
  let count = 0;
  const current = new Date(firstDay);
  
  while (current <= lastDay) {
    if (dayIndices.includes(current.getDay())) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate daily target based on monthly target and working days
 */
export function calculateDailyTarget(monthlyTarget: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  return Math.round((monthlyTarget / workingDays) * 100) / 100;
}

/**
 * Get subject type label for display
 */
export function getSubjectTypeLabel(type: SubjectType): string {
  const labels: Record<SubjectType, string> = {
    qaida: 'Qaida',
    hifz: 'Hifz',
    nazra: 'Nazra',
    academic: 'Academic',
  };
  return labels[type] || 'Academic';
}

/**
 * Teaching strategy type
 */
export type TeachingStrategy = 'normal' | 'reverse';

/**
 * Get teaching strategy label
 */
export function getTeachingStrategyLabel(strategy: TeachingStrategy): string {
  return strategy === 'normal' 
    ? 'Normal (Al-Fatiha → An-Nas)' 
    : 'Reverse (An-Nas → Al-Fatiha)';
}
