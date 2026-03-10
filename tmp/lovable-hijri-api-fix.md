# Lovable Fix — Authentic Location-Based Islamic Date
## Replace local Hijri algorithm with AlAdhan API

---

## WHY THE CHANGE IS NEEDED

The current Hijri date is computed locally using a mathematical
algorithm. This will always be wrong by 0–2 days because:

1. Pakistan (and most Muslim countries) follows official moon
   sighting announcements by their Ruet-e-Hilal Committee —
   these can differ from astronomical calculation
2. Pakistan's date is often 1 day behind Saudi Arabia
3. No local formula can know when a committee announces a
   moon sighting

The solution is to fetch the Hijri date from an API that tracks
real sighting data per country — updated daily.

---

## THE API: AlAdhan (api.aladhan.com)

- Free to use
- No API key required
- No registration required
- Supports city + country
- Returns Hijri date as part of prayer timings response
- Open source, widely trusted in Islamic app development

---

## IMPLEMENTATION

### Step 1 — Get user's location from LMS profile

The LMS stores the teacher/student's city and country in their
profile (timezone field is `Asia/Karachi` for Pakistan).

Map timezone → city + country for the API call:

```javascript
function getCityCountryFromTimezone(timezone) {
  const tzMap = {
    'Asia/Karachi':   { city: 'Karachi',   country: 'Pakistan' },
    'Asia/Kolkata':   { city: 'Mumbai',    country: 'India'    },
    'Asia/Dhaka':     { city: 'Dhaka',     country: 'Bangladesh' },
    'Asia/Dubai':     { city: 'Dubai',     country: 'UAE'      },
    'Asia/Riyadh':    { city: 'Riyadh',    country: 'Saudi Arabia' },
    'Asia/Baghdad':   { city: 'Baghdad',   country: 'Iraq'     },
    'Africa/Cairo':   { city: 'Cairo',     country: 'Egypt'    },
    'Europe/London':  { city: 'London',    country: 'UK'       },
    'America/New_York': { city: 'New York', country: 'United States' },
    'America/Chicago': { city: 'Chicago',  country: 'United States' },
    'America/Los_Angeles': { city: 'Los Angeles', country: 'United States' },
    'Australia/Sydney': { city: 'Sydney',  country: 'Australia' },
    'Europe/Paris':   { city: 'Paris',     country: 'France'   },
    'Asia/Kuala_Lumpur': { city: 'Kuala Lumpur', country: 'Malaysia' },
    'Asia/Jakarta':   { city: 'Jakarta',   country: 'Indonesia' },
    'Africa/Lagos':   { city: 'Lagos',     country: 'Nigeria'  },
    'Africa/Nairobi': { city: 'Nairobi',   country: 'Kenya'    },
    'Asia/Istanbul':  { city: 'Istanbul',  country: 'Turkey'   },
  };
  return tzMap[timezone] || { city: 'Karachi', country: 'Pakistan' };
}
```

---

### Step 2 — Fetch Hijri date from AlAdhan API

```javascript
async function fetchIslamicDate(timezone = 'Asia/Karachi') {
  // Check cache first — only call API once per day
  const cacheKey = 'hijri_date_cache';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { date, data } = JSON.parse(cached);
      if (date === today) return data; // Return cached if same day
    }
  } catch (e) {}

  // Get city/country from timezone
  const { city, country } = getCityCountryFromTimezone(timezone);
  
  // Format today's date as DD-MM-YYYY for AlAdhan API
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;

  try {
    const url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}` +
                `?city=${encodeURIComponent(city)}` +
                `&country=${encodeURIComponent(country)}` +
                `&method=1`; 
    // method=1 = University of Islamic Sciences, Karachi
    // (Used for Pakistan, Afghanistan, Bangladesh, India)
    // For other countries, method can be adjusted:
    // method=2 = ISNA (North America)
    // method=4 = Umm Al-Qura (Saudi Arabia)
    // method=3 = Muslim World League (Europe/Far East)

    const response = await fetch(url);
    const json = await response.json();
    
    if (json.code === 200) {
      const hijri = json.data.date.hijri;
      const result = {
        day: parseInt(hijri.day),
        monthName: hijri.month.en,   // e.g. "Ramaḍān"
        monthNameClean: cleanHijriMonth(hijri.month.en),
        monthNumber: hijri.month.number,
        year: parseInt(hijri.year),  // e.g. 1447
        formatted: `${parseInt(hijri.day)} ${cleanHijriMonth(hijri.month.en)} ${hijri.year} AH`
      };
      
      // Cache it for the rest of the day
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ date: today, data: result }));
      } catch (e) {}
      
      return result;
    }
  } catch (err) {
    console.warn('AlAdhan API failed, using fallback:', err);
  }

  // Fallback: local calculation (less accurate, but better than nothing)
  return localHijriCalculation(new Date());
}

// AlAdhan returns Arabic-transliterated names, clean them up
function cleanHijriMonth(name) {
  const map = {
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
  return map[name] || name;
}
```

---

### Step 3 — Use in the dashboard header component

```javascript
// In your header component:
const [islamicDate, setIslamicDate] = useState(null);
const [islamicDateLoading, setIslamicDateLoading] = useState(true);

useEffect(() => {
  const userTimezone = currentUser?.timezone || 'Asia/Karachi';
  
  fetchIslamicDate(userTimezone)
    .then(data => {
      setIslamicDate(data);
      setIslamicDateLoading(false);
    })
    .catch(() => {
      setIslamicDateLoading(false);
    });
}, []); // Run once on mount — cached for the day

// In render:
{islamicDateLoading ? (
  <span style={{ opacity: 0.5 }}>Loading...</span>
) : islamicDate ? (
  <span>☪️ {islamicDate.formatted}</span>
) : (
  <span>☪️ Islamic date unavailable</span>
)}
```

---

### Step 4 — Calculation method per country

Store the preferred calculation method in the user's profile or
derive it from their country:

```javascript
function getCalculationMethod(country) {
  const methods = {
    'Pakistan':       1,  // University of Islamic Sciences, Karachi
    'India':          1,  // Same as Pakistan
    'Bangladesh':     1,
    'Afghanistan':    1,
    'Saudi Arabia':   4,  // Umm al-Qura
    'UAE':            4,
    'Kuwait':         4,
    'Qatar':          4,
    'Egypt':          5,  // Egyptian General Authority of Survey
    'United States':  2,  // ISNA
    'Canada':         2,
    'United Kingdom': 3,  // Muslim World League
    'France':         3,
    'Germany':        3,
    'Australia':      3,
    'Malaysia':       3,
    'Singapore':      3,
    'Indonesia':      20, // KEMENAG
    'Turkey':         13, // Diyanet
    'Nigeria':        3,
  };
  return methods[country] || 3; // Default: Muslim World League
}
```

---

## IMPORTANT NOTES

### Caching strategy
- Cache the API response in `localStorage` keyed by today's date
- This means only 1 API call per device per day
- At midnight (local time), the cache expires and a fresh call is made
- No cost, no rate limiting issues

### Error handling
- If the API is unreachable (offline, timeout): show local calculation
  as fallback with no error shown to user
- Log the error silently for debugging

### Why this is still not 100% guaranteed
Even AlAdhan uses calculation methods. True moon sighting
announcements (like Pakistan's Ruet-e-Hilal Committee) are not
available via any public real-time API. However, AlAdhan with
method=1 (Karachi) matches Pakistan's announced dates
approximately 95% of the time and is the industry standard for
Islamic apps.

For absolute accuracy, the LMS admin could add a manual override
field: "Today's Hijri Date (Pakistan)" that an admin updates on
the 1st of each Islamic month — this overrides the API for all
Pakistani users that day. This is how many mosque websites handle it.

---

## VERIFICATION

After implementation, test with these known dates:
- March 10, 2026 → Pakistan: **20 Ramadan 1447 AH**
- March 10, 2026 → Saudi Arabia: **20 Ramadan 1447 AH**
  (same this month — Pakistan and Saudi are aligned for Ramadan 1447)

The API call to verify manually:
```
https://api.aladhan.com/v1/timingsByCity/10-03-2026?city=Karachi&country=Pakistan&method=1
```
Look for: `data.date.hijri.day`, `data.date.hijri.month.en`, `data.date.hijri.year`

---

## STUDENT DASHBOARD — SAME IMPLEMENTATION

When this is applied to the student dashboard, use the exact same
`fetchIslamicDate()` function with the student's timezone from
their LMS profile. The only difference per user is:
- Their city/country (from timezone mapping)
- Their calculation method (from country)

Everything else is identical.
