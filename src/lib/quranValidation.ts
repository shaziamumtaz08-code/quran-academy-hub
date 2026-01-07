// Quran Validation Utilities - Validates Surah/Ayah inputs against Quran metadata

import { SURAHS, getSurahByName, type SurahInfo } from './quranData';

/**
 * Validate if an ayah number is within valid range for a surah
 */
export function isValidAyah(surahName: string, ayahNumber: number): boolean {
  const surah = getSurahByName(surahName);
  if (!surah) return false;
  return ayahNumber >= 1 && ayahNumber <= surah.totalAyahs;
}

/**
 * Get max ayahs for a surah by name
 */
export function getMaxAyahs(surahName: string): number {
  const surah = getSurahByName(surahName);
  return surah?.totalAyahs || 0;
}

/**
 * Validate a complete Surah/Ayah range
 */
export interface RangeValidation {
  isValid: boolean;
  fromError?: string;
  toError?: string;
}

export function validateSurahRange(
  surahFrom: string,
  ayahFrom: number | string,
  surahTo: string,
  ayahTo: number | string
): RangeValidation {
  const fromAyah = typeof ayahFrom === 'string' ? parseInt(ayahFrom) || 0 : ayahFrom;
  const toAyah = typeof ayahTo === 'string' ? parseInt(ayahTo) || 0 : ayahTo;
  
  const errors: RangeValidation = { isValid: true };
  
  // Validate "from" surah and ayah
  if (surahFrom) {
    const fromSurah = getSurahByName(surahFrom);
    if (!fromSurah) {
      errors.isValid = false;
      errors.fromError = 'Invalid Surah';
    } else if (fromAyah > 0 && fromAyah > fromSurah.totalAyahs) {
      errors.isValid = false;
      errors.fromError = `Max ${fromSurah.totalAyahs} ayahs in ${fromSurah.name}`;
    }
  }
  
  // Validate "to" surah and ayah
  if (surahTo) {
    const toSurah = getSurahByName(surahTo);
    if (!toSurah) {
      errors.isValid = false;
      errors.toError = 'Invalid Surah';
    } else if (toAyah > 0 && toAyah > toSurah.totalAyahs) {
      errors.isValid = false;
      errors.toError = `Max ${toSurah.totalAyahs} ayahs in ${toSurah.name}`;
    }
  }
  
  // Validate order (to must come after from in Quran order)
  if (surahFrom && surahTo && errors.isValid) {
    const fromIndex = SURAHS.findIndex(s => s.name === surahFrom);
    const toIndex = SURAHS.findIndex(s => s.name === surahTo);
    
    if (fromIndex > toIndex) {
      errors.isValid = false;
      errors.toError = '"To" must come after "From" in Quran order';
    } else if (fromIndex === toIndex && fromAyah > 0 && toAyah > 0 && toAyah < fromAyah) {
      errors.isValid = false;
      errors.toError = 'Ending ayah must be greater than starting ayah';
    }
  }
  
  return errors;
}

/**
 * Check if two lessons are identical (repeat lesson detection)
 */
export interface LessonPosition {
  surahFrom: string;
  ayahFrom: number | string;
  surahTo?: string;
  ayahTo?: number | string;
}

export function isRepeatLesson(today: LessonPosition, yesterday: LessonPosition): boolean {
  if (!today.surahFrom || !yesterday.surahFrom) return false;
  
  const todayFrom = typeof today.ayahFrom === 'string' ? parseInt(today.ayahFrom) || 0 : today.ayahFrom;
  const yesterdayFrom = typeof yesterday.ayahFrom === 'string' ? parseInt(yesterday.ayahFrom) || 0 : yesterday.ayahFrom;
  
  // Same starting position
  if (today.surahFrom !== yesterday.surahFrom) return false;
  if (todayFrom !== yesterdayFrom) return false;
  
  // If both have ending positions, check those too
  if (today.surahTo && yesterday.surahTo) {
    if (today.surahTo !== yesterday.surahTo) return false;
    
    const todayTo = typeof today.ayahTo === 'string' ? parseInt(today.ayahTo) || 0 : today.ayahTo;
    const yesterdayTo = typeof yesterday.ayahTo === 'string' ? parseInt(yesterday.ayahTo) || 0 : yesterday.ayahTo;
    
    if (todayTo !== yesterdayTo) return false;
  }
  
  return true;
}

/**
 * Format lesson position for display
 */
export function formatLessonPosition(position: LessonPosition): string {
  if (!position.surahFrom) return '';
  
  const fromAyah = typeof position.ayahFrom === 'string' ? parseInt(position.ayahFrom) || 0 : position.ayahFrom;
  
  let result = position.surahFrom;
  if (fromAyah > 0) {
    result += ` ${fromAyah}`;
  }
  
  if (position.surahTo) {
    const toAyah = typeof position.ayahTo === 'string' ? parseInt(position.ayahTo) || 0 : position.ayahTo;
    result += ` - ${position.surahTo}`;
    if (toAyah > 0) {
      result += ` ${toAyah}`;
    }
  }
  
  return result;
}
