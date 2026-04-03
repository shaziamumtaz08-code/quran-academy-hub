/**
 * AlAdhan API integration for accurate Hijri date + prayer times.
 * Islamic day starts at Maghrib — after Maghrib, add +1 to today's Hijri day.
 */

const TZ_MAP: Record<string, { city: string; country: string }> = {
  'Asia/Karachi':        { city: 'Karachi',      country: 'Pakistan' },
  'Asia/Kolkata':        { city: 'Mumbai',        country: 'India' },
  'Asia/Dhaka':          { city: 'Dhaka',         country: 'Bangladesh' },
  'Asia/Dubai':          { city: 'Dubai',         country: 'UAE' },
  'Asia/Riyadh':         { city: 'Riyadh',        country: 'Saudi Arabia' },
  'Asia/Baghdad':        { city: 'Baghdad',       country: 'Iraq' },
  'Africa/Cairo':        { city: 'Cairo',         country: 'Egypt' },
  'Europe/London':       { city: 'London',        country: 'UK' },
  'America/New_York':    { city: 'New York',      country: 'United States' },
  'America/Chicago':     { city: 'Chicago',       country: 'United States' },
  'America/Los_Angeles': { city: 'Los Angeles',   country: 'United States' },
  'Australia/Sydney':    { city: 'Sydney',        country: 'Australia' },
  'Europe/Paris':        { city: 'Paris',         country: 'France' },
  'Asia/Kuala_Lumpur':   { city: 'Kuala Lumpur',  country: 'Malaysia' },
  'Asia/Jakarta':        { city: 'Jakarta',       country: 'Indonesia' },
  'Africa/Lagos':        { city: 'Lagos',         country: 'Nigeria' },
  'Africa/Nairobi':      { city: 'Nairobi',       country: 'Kenya' },
  'Asia/Istanbul':       { city: 'Istanbul',      country: 'Turkey' },
};

function getCityCountry(timezone: string) {
  return TZ_MAP[timezone] || { city: 'Karachi', country: 'Pakistan' };
}

function getCalculationMethod(country: string): number {
  const methods: Record<string, number> = {
    'Pakistan': 1, 'India': 1, 'Bangladesh': 1, 'Afghanistan': 1,
    'Saudi Arabia': 4, 'UAE': 4, 'Kuwait': 4, 'Qatar': 4,
    'Egypt': 5, 'United States': 2, 'Canada': 2,
    'United Kingdom': 3, 'UK': 3, 'France': 3, 'Germany': 3,
    'Australia': 3, 'Malaysia': 3, 'Singapore': 3,
    'Indonesia': 20, 'Turkey': 13, 'Nigeria': 3,
  };
  return methods[country] || 3;
}

function getSchool(country: string): number {
  const hanafiCountries = ['Pakistan', 'India', 'Bangladesh', 'Afghanistan', 'Turkey'];
  return hanafiCountries.includes(country) ? 1 : 0;
}

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah",
];

const CLEAN_MONTHS: Record<string, string> = {
  "Muḥarram": "Muharram",
  "Ṣafar": "Safar",
  "Rabīʿ al-awwal": "Rabi al-Awwal",
  "Rabīʿ al-thānī": "Rabi al-Thani",
  "Jumādá al-ūlá": "Jumada al-Awwal",
  "Jumādá al-ākhirah": "Jumada al-Thani",
  "Rajab": "Rajab",
  "Shaʿbān": "Sha'ban",
  "Ramaḍān": "Ramadan",
  "Shawwāl": "Shawwal",
  "Dhū al-Qaʿdah": "Dhul Qi'dah",
  "Dhū al-Ḥijjah": "Dhul Hijjah",
};

function cleanMonth(name: string): string {
  return CLEAN_MONTHS[name] || name;
}

const cleanTime = (t: string) => t?.replace(/\s*\(.*\)/, '') || '';

export interface IslamicDateData {
  day: number;
  monthName: string;
  monthNumber: number;
  year: number;
  formatted: string;
  isRamadan: boolean;
  prayers: {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    Imsak: string;
    Sunrise: string;
  };
}

interface DayData {
  hijri: {
    day: number;
    monthName: string;
    monthNumber: number;
    year: number;
    daysInMonth: number;
  };
  prayers: IslamicDateData['prayers'];
}

function parseApiResponse(json: any): DayData | null {
  if (json?.code !== 200) return null;
  const hijri = json.data.date.hijri;
  const timings = json.data.timings;
  return {
    hijri: {
      day: parseInt(hijri.day),
      monthName: cleanMonth(hijri.month.en),
      monthNumber: hijri.month.number,
      year: parseInt(hijri.year),
      daysInMonth: parseInt(hijri.month.days || '30'),
    },
    prayers: {
      Fajr: cleanTime(timings.Fajr),
      Dhuhr: cleanTime(timings.Dhuhr),
      Asr: cleanTime(timings.Asr),
      Maghrib: cleanTime(timings.Maghrib),
      Isha: cleanTime(timings.Isha),
      Imsak: cleanTime(timings.Imsak),
      Sunrise: cleanTime(timings.Sunrise),
    },
  };
}

function formatDateForApi(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** Check if current time is past Maghrib */
function isPastMaghrib(maghribStr: string, timezone: string): boolean {
  if (!maghribStr) return false;
  const [mH, mM] = maghribStr.split(':').map(Number);

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const nowH = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const nowM = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

  return (nowH * 60 + nowM) >= (mH * 60 + mM);
}

// Local fallback
function localHijriFallback(): IslamicDateData {
  const date = new Date();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let jd = Math.floor((14 - month) / 12);
  let y = year + 4800 - jd;
  let m = month + 12 * jd - 3;
  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  let l = jdn - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  let hMonth = Math.floor((24 * l) / 709);
  let hDay = l - Math.floor((709 * hMonth) / 24);
  let hYear = 30 * n + j - 30;

  return {
    day: hDay,
    monthName: HIJRI_MONTHS[hMonth - 1] || 'Unknown',
    monthNumber: hMonth,
    year: hYear,
    formatted: `${hDay} ${HIJRI_MONTHS[hMonth - 1]} ${hYear} AH`,
    isRamadan: hMonth === 9,
    prayers: { Fajr: '', Dhuhr: '', Asr: '', Maghrib: '', Isha: '', Imsak: '', Sunrise: '' },
  };
}

export async function fetchIslamicDate(timezone: string = 'Asia/Karachi'): Promise<IslamicDateData> {
  const cacheKey = 'hijri_date_cache_v3';
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.date === today && parsed.tz === timezone && parsed.todayData) {
        return applyMaghribFlip(parsed.todayData, timezone);
      }
    }
  } catch {}

  const { city, country } = getCityCountry(timezone);
  const method = getCalculationMethod(country);
  const school = getSchool(country);

  const todayStr = formatDateForApi(now);
  const baseUrl = `https://api.aladhan.com/v1/timingsByCity`;
  const params = `city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const todayRes = await fetch(`${baseUrl}/${todayStr}?${params}`, { signal: controller.signal }).then(r => r.json());
    clearTimeout(timeoutId);
    const todayData = parseApiResponse(todayRes);

    if (todayData) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          date: today,
          tz: timezone,
          todayData,
        }));
      } catch {}

      return applyMaghribFlip(todayData, timezone);
    }
  } catch (err) {
    console.warn('AlAdhan API failed, using local fallback:', err);
  }

  return localHijriFallback();
}

/**
 * Maghrib-based Hijri day flip:
 * The API returns the correct base Hijri date for the Gregorian day.
 * After Maghrib, we simply add +1 to the day (with month rollover).
 * Prayer times always stay as today's.
 */
function applyMaghribFlip(todayData: DayData, timezone: string): IslamicDateData {
  const pastMaghrib = isPastMaghrib(todayData.prayers.Maghrib, timezone);

  let { day, monthName, monthNumber, year, daysInMonth } = todayData.hijri;

  if (pastMaghrib) {
    day += 1;
    // Handle month rollover
    if (day > daysInMonth) {
      day = 1;
      monthNumber += 1;
      if (monthNumber > 12) {
        monthNumber = 1;
        year += 1;
      }
      monthName = HIJRI_MONTHS[monthNumber - 1] || monthName;
    }
  }

  return {
    day,
    monthName,
    monthNumber,
    year,
    formatted: `${day} ${monthName} ${year} AH`,
    isRamadan: monthNumber === 9,
    prayers: todayData.prayers,
  };
}
