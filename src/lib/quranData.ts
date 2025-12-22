// Complete list of all 114 Surahs in the Quran
export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  totalAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export const SURAHS: SurahInfo[] = [
  { number: 1, name: 'Al-Fatihah', englishName: 'The Opening', totalAyahs: 7, revelationType: 'Meccan' },
  { number: 2, name: 'Al-Baqarah', englishName: 'The Cow', totalAyahs: 286, revelationType: 'Medinan' },
  { number: 3, name: 'Aal-E-Imran', englishName: 'The Family of Imran', totalAyahs: 200, revelationType: 'Medinan' },
  { number: 4, name: 'An-Nisa', englishName: 'The Women', totalAyahs: 176, revelationType: 'Medinan' },
  { number: 5, name: 'Al-Ma\'idah', englishName: 'The Table Spread', totalAyahs: 120, revelationType: 'Medinan' },
  { number: 6, name: 'Al-An\'am', englishName: 'The Cattle', totalAyahs: 165, revelationType: 'Meccan' },
  { number: 7, name: 'Al-A\'raf', englishName: 'The Heights', totalAyahs: 206, revelationType: 'Meccan' },
  { number: 8, name: 'Al-Anfal', englishName: 'The Spoils of War', totalAyahs: 75, revelationType: 'Medinan' },
  { number: 9, name: 'At-Tawbah', englishName: 'The Repentance', totalAyahs: 129, revelationType: 'Medinan' },
  { number: 10, name: 'Yunus', englishName: 'Jonah', totalAyahs: 109, revelationType: 'Meccan' },
  { number: 11, name: 'Hud', englishName: 'Hud', totalAyahs: 123, revelationType: 'Meccan' },
  { number: 12, name: 'Yusuf', englishName: 'Joseph', totalAyahs: 111, revelationType: 'Meccan' },
  { number: 13, name: 'Ar-Ra\'d', englishName: 'The Thunder', totalAyahs: 43, revelationType: 'Medinan' },
  { number: 14, name: 'Ibrahim', englishName: 'Abraham', totalAyahs: 52, revelationType: 'Meccan' },
  { number: 15, name: 'Al-Hijr', englishName: 'The Rocky Tract', totalAyahs: 99, revelationType: 'Meccan' },
  { number: 16, name: 'An-Nahl', englishName: 'The Bee', totalAyahs: 128, revelationType: 'Meccan' },
  { number: 17, name: 'Al-Isra', englishName: 'The Night Journey', totalAyahs: 111, revelationType: 'Meccan' },
  { number: 18, name: 'Al-Kahf', englishName: 'The Cave', totalAyahs: 110, revelationType: 'Meccan' },
  { number: 19, name: 'Maryam', englishName: 'Mary', totalAyahs: 98, revelationType: 'Meccan' },
  { number: 20, name: 'Ta-Ha', englishName: 'Ta-Ha', totalAyahs: 135, revelationType: 'Meccan' },
  { number: 21, name: 'Al-Anbiya', englishName: 'The Prophets', totalAyahs: 112, revelationType: 'Meccan' },
  { number: 22, name: 'Al-Hajj', englishName: 'The Pilgrimage', totalAyahs: 78, revelationType: 'Medinan' },
  { number: 23, name: 'Al-Mu\'minun', englishName: 'The Believers', totalAyahs: 118, revelationType: 'Meccan' },
  { number: 24, name: 'An-Nur', englishName: 'The Light', totalAyahs: 64, revelationType: 'Medinan' },
  { number: 25, name: 'Al-Furqan', englishName: 'The Criterion', totalAyahs: 77, revelationType: 'Meccan' },
  { number: 26, name: 'Ash-Shu\'ara', englishName: 'The Poets', totalAyahs: 227, revelationType: 'Meccan' },
  { number: 27, name: 'An-Naml', englishName: 'The Ant', totalAyahs: 93, revelationType: 'Meccan' },
  { number: 28, name: 'Al-Qasas', englishName: 'The Stories', totalAyahs: 88, revelationType: 'Meccan' },
  { number: 29, name: 'Al-Ankabut', englishName: 'The Spider', totalAyahs: 69, revelationType: 'Meccan' },
  { number: 30, name: 'Ar-Rum', englishName: 'The Romans', totalAyahs: 60, revelationType: 'Meccan' },
  { number: 31, name: 'Luqman', englishName: 'Luqman', totalAyahs: 34, revelationType: 'Meccan' },
  { number: 32, name: 'As-Sajdah', englishName: 'The Prostration', totalAyahs: 30, revelationType: 'Meccan' },
  { number: 33, name: 'Al-Ahzab', englishName: 'The Combined Forces', totalAyahs: 73, revelationType: 'Medinan' },
  { number: 34, name: 'Saba', englishName: 'Sheba', totalAyahs: 54, revelationType: 'Meccan' },
  { number: 35, name: 'Fatir', englishName: 'The Originator', totalAyahs: 45, revelationType: 'Meccan' },
  { number: 36, name: 'Ya-Sin', englishName: 'Ya-Sin', totalAyahs: 83, revelationType: 'Meccan' },
  { number: 37, name: 'As-Saffat', englishName: 'Those Ranged in Ranks', totalAyahs: 182, revelationType: 'Meccan' },
  { number: 38, name: 'Sad', englishName: 'The Letter Sad', totalAyahs: 88, revelationType: 'Meccan' },
  { number: 39, name: 'Az-Zumar', englishName: 'The Groups', totalAyahs: 75, revelationType: 'Meccan' },
  { number: 40, name: 'Ghafir', englishName: 'The Forgiver', totalAyahs: 85, revelationType: 'Meccan' },
  { number: 41, name: 'Fussilat', englishName: 'Explained in Detail', totalAyahs: 54, revelationType: 'Meccan' },
  { number: 42, name: 'Ash-Shura', englishName: 'The Consultation', totalAyahs: 53, revelationType: 'Meccan' },
  { number: 43, name: 'Az-Zukhruf', englishName: 'The Gold Adornments', totalAyahs: 89, revelationType: 'Meccan' },
  { number: 44, name: 'Ad-Dukhan', englishName: 'The Smoke', totalAyahs: 59, revelationType: 'Meccan' },
  { number: 45, name: 'Al-Jathiyah', englishName: 'The Crouching', totalAyahs: 37, revelationType: 'Meccan' },
  { number: 46, name: 'Al-Ahqaf', englishName: 'The Wind-Curved Sandhills', totalAyahs: 35, revelationType: 'Meccan' },
  { number: 47, name: 'Muhammad', englishName: 'Muhammad', totalAyahs: 38, revelationType: 'Medinan' },
  { number: 48, name: 'Al-Fath', englishName: 'The Victory', totalAyahs: 29, revelationType: 'Medinan' },
  { number: 49, name: 'Al-Hujurat', englishName: 'The Rooms', totalAyahs: 18, revelationType: 'Medinan' },
  { number: 50, name: 'Qaf', englishName: 'The Letter Qaf', totalAyahs: 45, revelationType: 'Meccan' },
  { number: 51, name: 'Adh-Dhariyat', englishName: 'The Winnowing Winds', totalAyahs: 60, revelationType: 'Meccan' },
  { number: 52, name: 'At-Tur', englishName: 'The Mount', totalAyahs: 49, revelationType: 'Meccan' },
  { number: 53, name: 'An-Najm', englishName: 'The Star', totalAyahs: 62, revelationType: 'Meccan' },
  { number: 54, name: 'Al-Qamar', englishName: 'The Moon', totalAyahs: 55, revelationType: 'Meccan' },
  { number: 55, name: 'Ar-Rahman', englishName: 'The Beneficent', totalAyahs: 78, revelationType: 'Medinan' },
  { number: 56, name: 'Al-Waqi\'ah', englishName: 'The Inevitable', totalAyahs: 96, revelationType: 'Meccan' },
  { number: 57, name: 'Al-Hadid', englishName: 'The Iron', totalAyahs: 29, revelationType: 'Medinan' },
  { number: 58, name: 'Al-Mujadila', englishName: 'The Pleading Woman', totalAyahs: 22, revelationType: 'Medinan' },
  { number: 59, name: 'Al-Hashr', englishName: 'The Exile', totalAyahs: 24, revelationType: 'Medinan' },
  { number: 60, name: 'Al-Mumtahanah', englishName: 'She That is to be Examined', totalAyahs: 13, revelationType: 'Medinan' },
  { number: 61, name: 'As-Saff', englishName: 'The Ranks', totalAyahs: 14, revelationType: 'Medinan' },
  { number: 62, name: 'Al-Jumu\'ah', englishName: 'The Congregation', totalAyahs: 11, revelationType: 'Medinan' },
  { number: 63, name: 'Al-Munafiqun', englishName: 'The Hypocrites', totalAyahs: 11, revelationType: 'Medinan' },
  { number: 64, name: 'At-Taghabun', englishName: 'The Mutual Disillusion', totalAyahs: 18, revelationType: 'Medinan' },
  { number: 65, name: 'At-Talaq', englishName: 'The Divorce', totalAyahs: 12, revelationType: 'Medinan' },
  { number: 66, name: 'At-Tahrim', englishName: 'The Prohibition', totalAyahs: 12, revelationType: 'Medinan' },
  { number: 67, name: 'Al-Mulk', englishName: 'The Sovereignty', totalAyahs: 30, revelationType: 'Meccan' },
  { number: 68, name: 'Al-Qalam', englishName: 'The Pen', totalAyahs: 52, revelationType: 'Meccan' },
  { number: 69, name: 'Al-Haqqah', englishName: 'The Reality', totalAyahs: 52, revelationType: 'Meccan' },
  { number: 70, name: 'Al-Ma\'arij', englishName: 'The Ascending Stairways', totalAyahs: 44, revelationType: 'Meccan' },
  { number: 71, name: 'Nuh', englishName: 'Noah', totalAyahs: 28, revelationType: 'Meccan' },
  { number: 72, name: 'Al-Jinn', englishName: 'The Jinn', totalAyahs: 28, revelationType: 'Meccan' },
  { number: 73, name: 'Al-Muzzammil', englishName: 'The Enshrouded One', totalAyahs: 20, revelationType: 'Meccan' },
  { number: 74, name: 'Al-Muddaththir', englishName: 'The Cloaked One', totalAyahs: 56, revelationType: 'Meccan' },
  { number: 75, name: 'Al-Qiyamah', englishName: 'The Resurrection', totalAyahs: 40, revelationType: 'Meccan' },
  { number: 76, name: 'Al-Insan', englishName: 'The Human', totalAyahs: 31, revelationType: 'Medinan' },
  { number: 77, name: 'Al-Mursalat', englishName: 'The Emissaries', totalAyahs: 50, revelationType: 'Meccan' },
  { number: 78, name: 'An-Naba', englishName: 'The Tidings', totalAyahs: 40, revelationType: 'Meccan' },
  { number: 79, name: 'An-Nazi\'at', englishName: 'Those Who Drag Forth', totalAyahs: 46, revelationType: 'Meccan' },
  { number: 80, name: 'Abasa', englishName: 'He Frowned', totalAyahs: 42, revelationType: 'Meccan' },
  { number: 81, name: 'At-Takwir', englishName: 'The Overthrowing', totalAyahs: 29, revelationType: 'Meccan' },
  { number: 82, name: 'Al-Infitar', englishName: 'The Cleaving', totalAyahs: 19, revelationType: 'Meccan' },
  { number: 83, name: 'Al-Mutaffifin', englishName: 'The Defrauding', totalAyahs: 36, revelationType: 'Meccan' },
  { number: 84, name: 'Al-Inshiqaq', englishName: 'The Sundering', totalAyahs: 25, revelationType: 'Meccan' },
  { number: 85, name: 'Al-Buruj', englishName: 'The Mansions of the Stars', totalAyahs: 22, revelationType: 'Meccan' },
  { number: 86, name: 'At-Tariq', englishName: 'The Night-Comer', totalAyahs: 17, revelationType: 'Meccan' },
  { number: 87, name: 'Al-A\'la', englishName: 'The Most High', totalAyahs: 19, revelationType: 'Meccan' },
  { number: 88, name: 'Al-Ghashiyah', englishName: 'The Overwhelming', totalAyahs: 26, revelationType: 'Meccan' },
  { number: 89, name: 'Al-Fajr', englishName: 'The Dawn', totalAyahs: 30, revelationType: 'Meccan' },
  { number: 90, name: 'Al-Balad', englishName: 'The City', totalAyahs: 20, revelationType: 'Meccan' },
  { number: 91, name: 'Ash-Shams', englishName: 'The Sun', totalAyahs: 15, revelationType: 'Meccan' },
  { number: 92, name: 'Al-Layl', englishName: 'The Night', totalAyahs: 21, revelationType: 'Meccan' },
  { number: 93, name: 'Ad-Duhaa', englishName: 'The Morning Hours', totalAyahs: 11, revelationType: 'Meccan' },
  { number: 94, name: 'Ash-Sharh', englishName: 'The Relief', totalAyahs: 8, revelationType: 'Meccan' },
  { number: 95, name: 'At-Tin', englishName: 'The Fig', totalAyahs: 8, revelationType: 'Meccan' },
  { number: 96, name: 'Al-Alaq', englishName: 'The Clot', totalAyahs: 19, revelationType: 'Meccan' },
  { number: 97, name: 'Al-Qadr', englishName: 'The Power', totalAyahs: 5, revelationType: 'Meccan' },
  { number: 98, name: 'Al-Bayyinah', englishName: 'The Clear Proof', totalAyahs: 8, revelationType: 'Medinan' },
  { number: 99, name: 'Az-Zalzalah', englishName: 'The Earthquake', totalAyahs: 8, revelationType: 'Medinan' },
  { number: 100, name: 'Al-Adiyat', englishName: 'The Courser', totalAyahs: 11, revelationType: 'Meccan' },
  { number: 101, name: 'Al-Qari\'ah', englishName: 'The Calamity', totalAyahs: 11, revelationType: 'Meccan' },
  { number: 102, name: 'At-Takathur', englishName: 'The Rivalry in World Increase', totalAyahs: 8, revelationType: 'Meccan' },
  { number: 103, name: 'Al-Asr', englishName: 'The Declining Day', totalAyahs: 3, revelationType: 'Meccan' },
  { number: 104, name: 'Al-Humazah', englishName: 'The Traducer', totalAyahs: 9, revelationType: 'Meccan' },
  { number: 105, name: 'Al-Fil', englishName: 'The Elephant', totalAyahs: 5, revelationType: 'Meccan' },
  { number: 106, name: 'Quraysh', englishName: 'Quraysh', totalAyahs: 4, revelationType: 'Meccan' },
  { number: 107, name: 'Al-Ma\'un', englishName: 'The Small Kindnesses', totalAyahs: 7, revelationType: 'Meccan' },
  { number: 108, name: 'Al-Kawthar', englishName: 'The Abundance', totalAyahs: 3, revelationType: 'Meccan' },
  { number: 109, name: 'Al-Kafirun', englishName: 'The Disbelievers', totalAyahs: 6, revelationType: 'Meccan' },
  { number: 110, name: 'An-Nasr', englishName: 'The Divine Support', totalAyahs: 3, revelationType: 'Medinan' },
  { number: 111, name: 'Al-Masad', englishName: 'The Palm Fiber', totalAyahs: 5, revelationType: 'Meccan' },
  { number: 112, name: 'Al-Ikhlas', englishName: 'The Sincerity', totalAyahs: 4, revelationType: 'Meccan' },
  { number: 113, name: 'Al-Falaq', englishName: 'The Daybreak', totalAyahs: 5, revelationType: 'Meccan' },
  { number: 114, name: 'An-Nas', englishName: 'Mankind', totalAyahs: 6, revelationType: 'Meccan' },
];

// Learning Unit Types
export type LearningUnit = 'lines' | 'pages' | 'rukus' | 'quarters';

export const LEARNING_UNITS: { value: LearningUnit; label: string; shortLabel: string }[] = [
  { value: 'lines', label: 'Lines', shortLabel: 'Lines' },
  { value: 'pages', label: 'Pages', shortLabel: 'Pg' },
  { value: 'rukus', label: 'Rukus (Sections)', shortLabel: 'Ruku' },
  { value: 'quarters', label: 'Quarters (Hizb)', shortLabel: '¼ Hizb' },
];

// Mushaf Types and their line counts
export type MushafType = '13-line' | '15-line' | '16-line';

export const MUSHAF_TYPES: { value: MushafType; label: string; linesPerPage: number }[] = [
  { value: '13-line', label: '13-Line Mushaf', linesPerPage: 13 },
  { value: '15-line', label: '15-Line Mushaf (Standard)', linesPerPage: 15 },
  { value: '16-line', label: '16-Line Mushaf', linesPerPage: 16 },
];

// Conversion Constants
export const CONVERSION_CONSTANTS = {
  LINES_PER_RUKU: 15, // Standard average
  PAGES_PER_QUARTER: 2.5, // 1 Quarter (Hizb) = 2.5 Pages
};

/**
 * Get lines per page based on mushaf type
 */
export function getLinesPerPage(mushafType: MushafType | string): number {
  const mushaf = MUSHAF_TYPES.find(m => m.value === mushafType);
  return mushaf?.linesPerPage || 15; // Default to 15-line
}

/**
 * Convert any unit to line equivalent
 * @param amount - The amount in the specified unit
 * @param unit - The unit type (lines, pages, rukus, quarters)
 * @param mushafType - The mushaf type for page conversion
 * @returns The equivalent number of lines
 */
export function convertToLines(
  amount: number,
  unit: LearningUnit,
  mushafType: MushafType | string = '15-line'
): number {
  const linesPerPage = getLinesPerPage(mushafType);
  
  switch (unit) {
    case 'lines':
      return amount;
    case 'pages':
      return amount * linesPerPage;
    case 'rukus':
      return amount * CONVERSION_CONSTANTS.LINES_PER_RUKU;
    case 'quarters':
      return amount * CONVERSION_CONSTANTS.PAGES_PER_QUARTER * linesPerPage;
    default:
      return amount;
  }
}

/**
 * Convert lines to another unit
 * @param lines - The number of lines
 * @param targetUnit - The target unit type
 * @param mushafType - The mushaf type for page conversion
 * @returns The equivalent amount in the target unit
 */
export function convertFromLines(
  lines: number,
  targetUnit: LearningUnit,
  mushafType: MushafType | string = '15-line'
): number {
  const linesPerPage = getLinesPerPage(mushafType);
  
  switch (targetUnit) {
    case 'lines':
      return lines;
    case 'pages':
      return lines / linesPerPage;
    case 'rukus':
      return lines / CONVERSION_CONSTANTS.LINES_PER_RUKU;
    case 'quarters':
      return lines / (CONVERSION_CONSTANTS.PAGES_PER_QUARTER * linesPerPage);
    default:
      return lines;
  }
}

/**
 * Format unit display with proper pluralization
 */
export function formatUnitDisplay(amount: number, unit: LearningUnit): string {
  const unitInfo = LEARNING_UNITS.find(u => u.value === unit);
  if (!unitInfo) return `${amount}`;
  
  // Handle pluralization
  if (unit === 'rukus') {
    return amount === 1 ? `${amount} Ruku` : `${amount} Rukus`;
  }
  if (unit === 'quarters') {
    return amount === 1 ? `${amount} Quarter` : `${amount} Quarters`;
  }
  if (unit === 'pages') {
    return amount === 1 ? `${amount} Page` : `${amount} Pages`;
  }
  return amount === 1 ? `${amount} Line` : `${amount} Lines`;
}

/**
 * Get Surah by number
 */
export function getSurahByNumber(number: number): SurahInfo | undefined {
  return SURAHS.find(s => s.number === number);
}

/**
 * Get Surah by name (case-insensitive)
 */
export function getSurahByName(name: string): SurahInfo | undefined {
  const normalizedName = name.toLowerCase().trim();
  return SURAHS.find(s => 
    s.name.toLowerCase() === normalizedName ||
    s.englishName.toLowerCase() === normalizedName
  );
}

/**
 * Search Surahs by partial name
 */
export function searchSurahs(query: string): SurahInfo[] {
  if (!query) return SURAHS;
  const normalizedQuery = query.toLowerCase().trim();
  return SURAHS.filter(s => 
    s.name.toLowerCase().includes(normalizedQuery) ||
    s.englishName.toLowerCase().includes(normalizedQuery) ||
    s.number.toString().includes(normalizedQuery)
  );
}
