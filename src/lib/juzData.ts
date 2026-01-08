// Juz (Para) and Ruku Data for Quran

export interface JuzInfo {
  number: number;
  name: string;
  rukuCount: number;
  quarters: string[]; // Maqra/Quarter names
}

// 30 Juz with their Ruku counts
export const JUZ_DATA: JuzInfo[] = [
  { number: 1, name: 'Alif Lam Meem', rukuCount: 19, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 2, name: 'Sayaqool', rukuCount: 16, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 3, name: 'Tilkal Rusul', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 4, name: 'Lan Tana Loo', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 5, name: 'Wal Mohsanat', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 6, name: 'La Yuhibbullah', rukuCount: 17, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 7, name: 'Wa Iza Samiu', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 8, name: 'Wa Lau Annana', rukuCount: 17, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 9, name: 'Qalal Mala', rukuCount: 17, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 10, name: 'Wa Alamu', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 11, name: 'Yatazeroon', rukuCount: 17, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 12, name: 'Wa Ma Min Dabbah', rukuCount: 16, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 13, name: 'Wa Ma Ubarriu', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 14, name: 'Rubama', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 15, name: 'Subhanallazi', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 16, name: 'Qal Alam', rukuCount: 15, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 17, name: 'Iqtaraba', rukuCount: 17, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 18, name: 'Qad Aflaha', rukuCount: 15, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 19, name: 'Wa Qalallazina', rukuCount: 15, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 20, name: 'Amman Khalaq', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 21, name: 'Utlu Ma Oohi', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 22, name: 'Wa Manyaqnut', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 23, name: 'Wa Mali', rukuCount: 16, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 24, name: 'Faman Azlam', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 25, name: 'Elahe Yuruddo', rukuCount: 13, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 26, name: 'Ha Meem', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 27, name: 'Qala Fama Khatbukum', rukuCount: 14, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 28, name: 'Qad Sami Allah', rukuCount: 15, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 29, name: 'Tabarakallazi', rukuCount: 18, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
  { number: 30, name: 'Amma', rukuCount: 37, quarters: ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] },
];

// Get Juz by number
export function getJuzByNumber(number: number): JuzInfo | undefined {
  return JUZ_DATA.find(j => j.number === number);
}

// Get ruku count for a specific Juz
export function getRukuCountForJuz(juzNumber: number): number {
  const juz = getJuzByNumber(juzNumber);
  return juz?.rukuCount || 0;
}

// Calculate total rukus from Juz range
export function calculateTotalRukus(
  fromJuz: number,
  fromRuku: number,
  toJuz: number,
  toRuku: number
): number {
  if (!fromJuz || !toJuz || !fromRuku || !toRuku) return 0;
  
  if (fromJuz === toJuz) {
    return Math.max(0, toRuku - fromRuku + 1);
  }
  
  let total = 0;
  
  // Rukus remaining in fromJuz
  const fromJuzInfo = getJuzByNumber(fromJuz);
  if (fromJuzInfo) {
    total += fromJuzInfo.rukuCount - fromRuku + 1;
  }
  
  // Full Juz in between
  for (let j = fromJuz + 1; j < toJuz; j++) {
    const juzInfo = getJuzByNumber(j);
    if (juzInfo) {
      total += juzInfo.rukuCount;
    }
  }
  
  // Rukus in toJuz
  total += toRuku;
  
  return total;
}

// Calculate total quarters from Juz range
export function calculateTotalQuarters(
  fromJuz: number,
  fromQuarter: number,
  toJuz: number,
  toQuarter: number
): number {
  if (!fromJuz || !toJuz || !fromQuarter || !toQuarter) return 0;
  
  const quartersPerJuz = 4;
  
  if (fromJuz === toJuz) {
    return Math.max(0, toQuarter - fromQuarter + 1);
  }
  
  let total = 0;
  
  // Quarters remaining in fromJuz
  total += quartersPerJuz - fromQuarter + 1;
  
  // Full Juz in between
  total += (toJuz - fromJuz - 1) * quartersPerJuz;
  
  // Quarters in toJuz
  total += toQuarter;
  
  return total;
}
