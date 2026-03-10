/**
 * AlAdhan API integration for accurate Hijri date + prayer times.
 * Fetches BOTH today and tomorrow to support Maghrib-based day flip.
 * Islamic day starts at Maghrib — after Maghrib, show tomorrow's Hijri date.
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
  
  // Get current time in the user's timezone
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

  const HIJRI_MONTHS = [
    "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
    "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
    "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah",
  ];

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
  const cacheKey = 'hijri_date_cache_v2';
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.date === today && parsed.tz === timezone && parsed.todayData && parsed.tomorrowData) {
        // Use cached data but still apply Maghrib flip logic
        return applyMaghribFlip(parsed.todayData, parsed.tomorrowData, timezone);
      }
    }
  } catch {}

  const { city, country } = getCityCountry(timezone);
  const method = getCalculationMethod(country);
  const school = getSchool(country);

  const todayStr = formatDateForApi(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDateForApi(tomorrow);

  const baseUrl = `https://api.aladhan.com/v1/timingsByCity`;
  const params = `city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;

  try {
    // Fetch both today and tomorrow in parallel
    const [todayRes, tomorrowRes] = await Promise.all([
      fetch(`${baseUrl}/${todayStr}?${params}`).then(r => r.json()),
      fetch(`${baseUrl}/${tomorrowStr}?${params}`).then(r => r.json()),
    ]);

    const todayData = parseApiResponse(todayRes);
    const tomorrowData = parseApiResponse(tomorrowRes);

    if (todayData && tomorrowData) {
      // Cache both days
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          date: today,
          tz: timezone,
          todayData,
          tomorrowData,
        }));
      } catch {}

      return applyMaghribFlip(todayData, tomorrowData, timezone);
    }

    // If only today succeeded
    if (todayData) {
      return buildResult(todayData);
    }
  } catch (err) {
    console.warn('AlAdhan API failed, using local fallback:', err);
  }

  return localHijriFallback();
}

/** Apply Maghrib-based Hijri day flip: after Maghrib, show tomorrow's Hijri */
function applyMaghribFlip(todayData: DayData, tomorrowData: DayData, timezone: string): IslamicDateData {
  const pastMaghrib = isPastMaghrib(todayData.prayers.Maghrib, timezone);

  // After Maghrib: show tomorrow's Hijri date but TODAY's prayer times
  const hijriSource = pastMaghrib ? tomorrowData : todayData;

  return {
    day: hijriSource.hijri.day,
    monthName: hijriSource.hijri.monthName,
    monthNumber: hijriSource.hijri.monthNumber,
    year: hijriSource.hijri.year,
    formatted: `${hijriSource.hijri.day} ${hijriSource.hijri.monthName} ${hijriSource.hijri.year} AH`,
    isRamadan: hijriSource.hijri.monthNumber === 9,
    // Always use today's prayer times (they're for today's physical day)
    prayers: todayData.prayers,
  };
}

function buildResult(data: DayData): IslamicDateData {
  return {
    day: data.hijri.day,
    monthName: data.hijri.monthName,
    monthNumber: data.hijri.monthNumber,
    year: data.hijri.year,
    formatted: `${data.hijri.day} ${data.hijri.monthName} ${data.hijri.year} AH`,
    isRamadan: data.hijri.monthNumber === 9,
    prayers: data.prayers,
  };
}
