# Lovable Feature — Prayer Times Widget
## Location-aware, same API call as Hijri date (AlAdhan)

---

## KEY INSIGHT — ZERO EXTRA API CALLS

The AlAdhan API call we already make for the Hijri date returns
prayer times in the SAME response. No second fetch needed.

Response structure (already in our cache):
```json
{
  "data": {
    "timings": {
      "Fajr":    "05:04",
      "Sunrise": "06:28",
      "Dhuhr":   "12:23",
      "Asr":     "15:48",
      "Sunset":  "18:31",
      "Maghrib": "18:31",
      "Isha":    "19:53",
      "Imsak":   "04:54"   ← Suhoor end time (Ramadan only)
    },
    "date": {
      "hijri": { ... }     ← already using this
    }
  }
}
```

Just extract `data.timings` from the same cached response.
Update the existing `fetchIslamicDate()` function to also return
`timings` alongside the Hijri date object.

---

## THE WIDGET — Design & Behaviour

### Location on dashboard
Place BELOW the Next Class countdown card and ABOVE the Student
Smart Cards. It is contextual information, not an action item.

### Widget states

#### COLLAPSED (default — compact, 1 row):
```
[🕌]  NEXT PRAYER
      🌅 Maghrib · 18:31          [1h 23m]▼
      ─────────────────────────────────────
      ☪️ Ramadan · Imsak (Suhoor ends)  04:54
```

- Left: mosque icon in dark navy rounded square
- Center: next prayer name + icon + time
- Right: live countdown pill — "1h 23m" or "23m 45s" (seconds
  visible when under 1 hour) — ticking every second
- Imsak strip only shown during Ramadan (when Imsak time exists
  AND current month is Ramadan in the Hijri calendar)
- Chevron (▼/▲) to expand

#### EXPANDED (tap to toggle):
Shows all 5 prayer times in a row of 5 equal cards:

```
[🌙 Fajr]  [☀️ Dhuhr]  [🌤 Asr]  [🌅 Maghrib]  [🌃 Isha]
[05:04]    [12:23]    [15:48]   [18:31]        [19:53]
                                  NEXT ↑
```

Card states:
- **Current prayer** (the one happening now — between its time
  and next prayer time): light teal background, teal text, "NOW" label
- **Next prayer**: dark navy gradient, white text, "NEXT" label
- **Past/upcoming**: white card, normal text

---

## IMPLEMENTATION

### Step 1 — Update fetchIslamicDate to return timings too

```javascript
// In the existing fetchIslamicDate() function,
// change the return value to include timings:

const timings = json.data.timings;
const result = {
  // ... existing hijri fields ...
  day: parseInt(hijri.day),
  monthName: cleanHijriMonth(hijri.month.en),
  monthNumber: hijri.month.number,
  year: parseInt(hijri.year),
  formatted: `${parseInt(hijri.day)} ${cleanHijriMonth(hijri.month.en)} ${hijri.year} AH`,
  
  // ADD THESE:
  prayers: {
    Fajr:    timings.Fajr,
    Dhuhr:   timings.Dhuhr,
    Asr:     timings.Asr,
    Maghrib: timings.Maghrib,
    Isha:    timings.Isha,
    Imsak:   timings.Imsak,   // for Ramadan suhoor
    Sunrise: timings.Sunrise,
  },
  isRamadan: parseInt(hijri.month.number) === 9,
};
```

### Step 2 — Next prayer detection logic

```javascript
const PRAYER_ORDER = [
  { key: "Fajr",    label: "Fajr",    icon: "🌙" },
  { key: "Dhuhr",   label: "Dhuhr",   icon: "☀️" },
  { key: "Asr",     label: "Asr",     icon: "🌤️" },
  { key: "Maghrib", label: "Maghrib", icon: "🌅" },
  { key: "Isha",    label: "Isha",    icon: "🌃" },
];

function getNextPrayer(prayers, now) {
  for (const p of PRAYER_ORDER) {
    const [h, m] = prayers[p.key].split(":").map(Number);
    const prayerTime = new Date(now);
    prayerTime.setHours(h, m, 0, 0);
    if (prayerTime > now) {
      return {
        ...p,
        time: prayers[p.key],
        date: prayerTime,
        msUntil: prayerTime - now,
      };
    }
  }
  // All 5 done for today — next is Fajr tomorrow
  const [h, m] = prayers["Fajr"].split(":").map(Number);
  const fajrTomorrow = new Date(now);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  fajrTomorrow.setHours(h, m, 0, 0);
  return {
    ...PRAYER_ORDER[0],
    time: prayers["Fajr"],
    date: fajrTomorrow,
    msUntil: fajrTomorrow - now,
  };
}

function getCurrentPrayer(prayers, now) {
  // Current prayer = the most recent one that has passed
  let current = null;
  for (const p of PRAYER_ORDER) {
    const [h, m] = prayers[p.key].split(":").map(Number);
    const t = new Date(now);
    t.setHours(h, m, 0, 0);
    if (t <= now) current = p;
  }
  return current;
}
```

### Step 3 — Live countdown (re-use existing setInterval)

Plug into the existing 1-second clock interval already used for
the header clock. Use the same `now` state variable — don't create
another setInterval.

```javascript
const msUntil = nextPrayer ? Math.max(0, nextPrayer.date - now) : 0;
const hoursLeft = Math.floor(msUntil / 3600000);
const minsLeft  = Math.floor((msUntil % 3600000) / 60000);
const secsLeft  = Math.floor((msUntil % 60000) / 1000);

const countdownDisplay = hoursLeft > 0
  ? `${hoursLeft}h ${minsLeft}m`
  : `${minsLeft}m ${secsLeft}s`;
```

---

## PRAYER ICONS MAPPING

```
Fajr    → 🌙  (pre-dawn)
Dhuhr   → ☀️  (midday)
Asr     → 🌤️  (afternoon)
Maghrib → 🌅  (sunset)
Isha    → 🌃  (night)
Imsak   → 🌠  (suhoor)
```

---

## COLORS FOR PRAYER WIDGET

```javascript
// Next prayer card: dark navy gradient
background: "linear-gradient(135deg, #1A3A5C, #0D1B2A)"
color: "#FFFFFF"

// Current prayer card: teal
background: "#E8F7F2"
border: "1.5px solid #1A8C6E"
color: "#1A8C6E"

// Imsak Ramadan strip:
background: "linear-gradient(90deg, #0D1B2A, #1B2E45)"
text: "#F0B429"  (gold — special Ramadan colour)

// Countdown pill:
background: "#EAF4FF"
color: "#3B9ED8"  (sky blue)

// Default prayer card: white with border
background: "#FFFFFF"
border: "1.5px solid #E2E8F0"
```

---

## STUDENT DASHBOARD — SAME COMPONENT

Exact same `PrayerTimesWidget` component.
Pass the student's timezone from their LMS profile:

```javascript
// For student profile with timezone = "Asia/Dubai"
fetchIslamicDate("Asia/Dubai")
// Returns Dubai prayer times + Dubai Hijri date (method=4 Umm Al-Qura)
```

The calculation method auto-selects based on country (see Hijri
API spec for the getCalculationMethod() mapping).

---

## IMPORTANT NOTES

1. **Times are in 24hr format from API** — display as-is or convert
   to 12hr (AM/PM) based on user preference if LMS has that setting.
   For Pakistan, 12hr format is more familiar.

2. **Imsak ≠ Fajr** — Imsak is typically 10 minutes before Fajr.
   It's the moment to stop eating, not the prayer itself.
   Only show the Imsak strip when `isRamadan = true`.

3. **Times are in local time of the queried city** — AlAdhan returns
   times already adjusted for the city's timezone. No conversion needed.

4. **Refresh at midnight** — the cached prayer times are for today.
   The cache key includes today's date, so at midnight a fresh fetch
   automatically gets tomorrow's times.

5. **Asr timing** — Pakistan follows Hanafi school (later Asr time).
   Method=1 (Karachi) handles this correctly. Other countries may
   follow Shafi (earlier Asr). The API `school` param can be set:
   `&school=1` for Hanafi (default in Pakistan).

---

## VERIFICATION

For Karachi on March 10, 2026, expect approximately:
- Fajr:    05:04
- Dhuhr:   12:23
- Asr:     15:48 (Hanafi)
- Maghrib: 18:31
- Isha:    19:53
- Imsak:   04:54

API endpoint to verify:
```
https://api.aladhan.com/v1/timingsByCity/10-03-2026?city=Karachi&country=Pakistan&method=1&school=1
```
