import { useState, useEffect } from "react";

// ── Hijri (Islamic) Date Converter ──────────────────────────────────────────
function toHijri(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Julian Day Number
  let jd =
    Math.floor((14 - month) / 12);
  let y = year + 4800 - jd;
  let m = month + 12 * jd - 3;
  let jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // Hijri conversion
  let l = jdn - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  let hMonth = Math.floor((24 * l) / 709);
  let hDay = l - Math.floor((709 * hMonth) / 24);
  let hYear = 30 * n + j - 30;

  // Correct off-by-one: algorithm epoch lands +1 ahead
  if (hDay > 1) hDay -= 1;

  const HIJRI_MONTHS = [
    "Muharram","Safar","Rabi' al-Awwal","Rabi' al-Thani",
    "Jumada al-Awwal","Jumada al-Thani","Rajab","Sha'ban",
    "Ramadan","Shawwal","Dhul Qi'dah","Dhul Hijjah",
  ];
  return { day: hDay, month: hMonth, year: hYear, monthName: HIJRI_MONTHS[hMonth - 1] };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── Prayer Times (AlAdhan API — same call as Hijri date) ─────────────────────
const PRAYERS = [
  { key: "Fajr",    label: "Fajr",    icon: "🌙" },
  { key: "Dhuhr",   label: "Dhuhr",   icon: "☀️" },
  { key: "Asr",     label: "Asr",     icon: "🌤️" },
  { key: "Maghrib", label: "Maghrib", icon: "🌅" },
  { key: "Isha",    label: "Isha",    icon: "🌃" },
];

function parseTime(timeStr, referenceDate) {
  // timeStr = "HH:MM" in local time
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(referenceDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function usePrayerTimes(timezone = "Asia/Karachi") {
  const [data, setData] = useState(null);
  useEffect(() => {
    const cacheKey = "prayer_times_cache";
    const today = new Date().toISOString().split("T")[0];
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.date === today) { setData(cached.data); return; }
    } catch (e) {}

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();

    // Simulate API response with realistic Karachi times for demo
    // In production: fetch(`https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=Karachi&country=Pakistan&method=1`)
    const mockTimings = {
      Fajr: "05:04", Dhuhr: "12:23", Asr: "15:48",
      Maghrib: "18:31", Isha: "19:53", Imsak: "04:54",
      hijri: { day: 20, monthName: "Ramadan", year: 1447 }
    };
    setData(mockTimings);
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ date: today, data: mockTimings }));
    } catch (e) {}
  }, []);
  return data;
}

function getNextPrayer(prayerTimes, now) {
  if (!prayerTimes) return null;
  for (const p of PRAYERS) {
    const t = parseTime(prayerTimes[p.key], now);
    if (t > now) return { ...p, time: prayerTimes[p.key], date: t };
  }
  // All prayers done — next is Fajr tomorrow
  const fajrTomorrow = parseTime(prayerTimes["Fajr"], now);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  return { ...PRAYERS[0], time: prayerTimes["Fajr"], date: fajrTomorrow };
}

function PrayerTimesWidget({ prayerTimes }) {
  const now = useLiveClock();
  const next = getNextPrayer(prayerTimes, now);
  const [expanded, setExpanded] = useState(false);

  if (!prayerTimes) return null;

  // Countdown to next prayer
  const diff = next ? Math.max(0, next.date - now) : 0;
  const hrs  = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  const isCurrentPrayer = (key) => {
    const idx = PRAYERS.findIndex(p => p.key === key);
    const nextIdx = PRAYERS.findIndex(p => p.key === next?.key);
    return idx === (nextIdx - 1 + PRAYERS.length) % PRAYERS.length;
  };

  return (
    <div style={{
      background: COLORS.card,
      borderRadius: 16,
      border: `1px solid ${COLORS.border}`,
      marginBottom: 14,
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      {/* Collapsed header — always visible */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div style={{
          background: "linear-gradient(135deg, #1A3A5C, #0D1B2A)",
          borderRadius: 10,
          width: 38, height: 38,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>
          🕌
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: 0.8 }}>
            NEXT PRAYER
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.navy }}>
            {next?.icon} {next?.label}
            <span style={{ fontWeight: 500, color: COLORS.muted, fontSize: 13 }}>
              {" "}· {next?.time}
            </span>
          </div>
        </div>
        {/* Countdown pill */}
        <div style={{
          background: "#EAF4FF",
          borderRadius: 10,
          padding: "5px 10px",
          textAlign: "center",
          minWidth: 68,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: COLORS.sky,
            fontFamily: "'Courier New', monospace",
          }}>
            {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`}
          </div>
          <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: 600 }}>remaining</div>
        </div>
        <div style={{ color: COLORS.muted, fontSize: 13 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Ramadan Imsak strip */}
      {prayerTimes.Imsak && (
        <div style={{
          margin: "0 16px",
          background: "linear-gradient(90deg, #0D1B2A, #1B2E45)",
          borderRadius: 8,
          padding: "5px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: expanded ? 0 : 12,
        }}>
          <span style={{ fontSize: 11, color: "#8AACCC", fontWeight: 600 }}>
            ☪️ Ramadan · Imsak (Suhoor ends)
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.goldLight }}>
            {prayerTimes.Imsak}
          </span>
        </div>
      )}

      {/* Expanded — all 5 prayers */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${COLORS.border}`,
          padding: "10px 16px 14px",
          background: "#FAFBFD",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {PRAYERS.map((p) => {
              const isNext = p.key === next?.key;
              const isCurrent = isCurrentPrayer(p.key);
              return (
                <div key={p.key} style={{
                  flex: 1,
                  textAlign: "center",
                  borderRadius: 10,
                  padding: "8px 4px",
                  background: isNext
                    ? "linear-gradient(135deg, #1A3A5C, #0D1B2A)"
                    : isCurrent
                    ? "#E8F7F2"
                    : "#fff",
                  border: `1.5px solid ${isNext ? "transparent" : isCurrent ? COLORS.teal : COLORS.border}`,
                }}>
                  <div style={{ fontSize: 14 }}>{p.icon}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, marginTop: 2,
                    color: isNext ? "#8AACCC" : isCurrent ? COLORS.teal : COLORS.muted,
                  }}>
                    {p.label}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 800, marginTop: 2,
                    color: isNext ? "#fff" : isCurrent ? COLORS.teal : COLORS.navy,
                  }}>
                    {prayerTimes[p.key]}
                  </div>
                  {isNext && (
                    <div style={{
                      fontSize: 8, color: COLORS.tealLight,
                      fontWeight: 600, marginTop: 2,
                    }}>NEXT</div>
                  )}
                  {isCurrent && (
                    <div style={{
                      fontSize: 8, color: COLORS.teal,
                      fontWeight: 600, marginTop: 2,
                    }}>NOW</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


const COLORS = {
  navy: "#0D1B2A",
  navyMid: "#1B2E45",
  teal: "#1A8C6E",
  tealLight: "#22A882",
  gold: "#C8960C",
  goldLight: "#F0B429",
  alert: "#E05C5C",
  alertBg: "#FFF0F0",
  sky: "#3B9ED8",
  bg: "#F4F6F9",
  card: "#FFFFFF",
  muted: "#8A97A8",
  border: "#E2E8F0",
};

const students = [
  {
    id: 1,
    name: "Roomana Ashraf",
    age: 58,
    gender: "Female",
    course: "Nazra",
    pace: "10 lines/day",
    currentSurah: "Al-Baqarah",
    currentAyah: 45,
    lastLesson: null,
    missedSessions: 3,
    nextClass: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    attendanceRate: 78,
    avatar: "RA",
    avatarColor: "#6C63FF",
    monthlyPlan: {
      submitted: true,
      approvedOn: "Feb 01",
      subject: "Nazra",
      fromPosition: "Juz 14 R-null",
      toPosition: "Juz 15 R20",
      monthlyTarget: "0 Rukus",
      notes: "In sha ALLAH once she covers full Juz 14 we will move to Juz 15",
      status: "Approved",
      currentActual: "Juz 14 R8",          // where she actually is right now
      targetMonth: "March 2026",
      planFilled: false,                    // March plan NOT yet submitted
    },
  },
  {
    id: 2,
    name: "Hina Baig",
    age: 34,
    gender: "Female",
    course: "Qaida",
    pace: "5 lines/day",
    currentSurah: "Al-Fatiha",
    currentAyah: 3,
    lastLesson: "Lesson 12 - Harakat",
    missedSessions: 0,
    nextClass: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    attendanceRate: 95,
    avatar: "HB",
    avatarColor: "#E05C8A",
    monthlyPlan: {
      submitted: true,
      approvedOn: "Feb 01",
      subject: "Qaida",
      fromPosition: "Takhti 11, Pages 20–22",
      toPosition: "Takhti 12, Pages 1–5",
      monthlyTarget: "3 pages",
      notes: "2 pages cover harakat revision",
      status: "Approved",
      currentActual: "Takhti 11, Page 21",
      targetMonth: "March 2026",
      planFilled: true,                     // March plan already submitted
    },
  },
];

const missedAttendance = [
  { date: "Mar 06", student: "Roomana Ashraf", course: "Nazra" },
  { date: "Mar 04", student: "Roomana Ashraf", course: "Nazra" },
  { date: "Mar 02", student: "Roomana Ashraf", course: "Nazra" },
];

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({});
  useEffect(() => {
    const calc = () => {
      const diff = targetDate - Date.now();
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return timeLeft;
}

function CountdownBadge({ date }) {
  const t = useCountdown(date);
  if (t.days > 0)
    return (
      <span style={{ color: COLORS.sky, fontWeight: 700, fontSize: 15 }}>
        {t.days}d {t.hours}h {t.mins}m
      </span>
    );
  return (
    <span style={{ color: COLORS.teal, fontWeight: 700, fontSize: 15 }}>
      {t.hours}h {t.mins}m {t.secs}s
    </span>
  );
}

function AttendanceTicker({ missed }) {
  const [visible, setVisible] = useState(true);
  if (!missed.length || !visible) return null;
  return (
    <div
      style={{
        background: "#FFF3CD",
        border: `1.5px solid ${COLORS.goldLight}`,
        borderRadius: 14,
        padding: "10px 14px",
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        position: "relative",
      }}
    >
      <span style={{ fontSize: 20 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#7A5200", marginBottom: 3 }}>
          {missed.length} Attendance{missed.length > 1 ? "s" : ""} Not Marked
        </div>
        {missed.slice(0, 2).map((m, i) => (
          <div key={i} style={{ fontSize: 12, color: "#996600" }}>
            • {m.student} — {m.date} ({m.course})
          </div>
        ))}
        {missed.length > 2 && (
          <div style={{ fontSize: 12, color: COLORS.gold, fontWeight: 600, marginTop: 2 }}>
            +{missed.length - 2} more
          </div>
        )}
        <button
          style={{
            marginTop: 8,
            background: COLORS.gold,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Mark Now →
        </button>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16, position: "absolute", top: 8, right: 10 }}
      >
        ✕
      </button>
    </div>
  );
}

function NextClassCard({ student }) {
  const t = useCountdown(student.nextClass);
  const urgent = t.days === 0;
  return (
    <div
      style={{
        background: urgent
          ? `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.tealLight})`
          : `linear-gradient(135deg, ${COLORS.navyMid}, ${COLORS.navy})`,
        borderRadius: 18,
        padding: "16px 18px",
        marginBottom: 14,
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -20,
          top: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
        }}
      />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
        {urgent ? "🟢 Coming Up Soon" : "⏰ Next Class"}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{student.name}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
        {student.course} · {student.currentSurah} Ayah {student.currentAyah}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.days || t.hours}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>{t.days > 0 ? "DAYS" : "HRS"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.days > 0 ? t.hours : t.mins}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>{t.days > 0 ? "HRS" : "MINS"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{t.days > 0 ? t.mins : t.secs}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>{t.days > 0 ? "MINS" : "SECS"}</div>
        </div>
        <button
          style={{
            marginLeft: "auto",
            background: "#fff",
            color: urgent ? COLORS.teal : COLORS.navy,
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          🎥 Start
        </button>
      </div>
    </div>
  );
}

function StudentQuickCard({ student, onMarkAttendance }) {
  const [expanded, setExpanded] = useState(false);
  const attended = student.attendanceRate;
  const missed = student.missedSessions;

  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 16,
        border: `1.5px solid ${missed > 0 ? "#FFD580" : COLORS.border}`,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header row */}
      <div
        style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: student.avatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {student.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.navy }}>{student.name}</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            {student.course} · {student.currentSurah}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {missed > 0 && (
            <div
              style={{
                background: "#FFF3CD",
                color: "#7A5200",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                padding: "2px 7px",
                marginBottom: 3,
              }}
            >
              {missed} missed
            </div>
          )}
          <div style={{ fontSize: 12, color: attended >= 85 ? COLORS.teal : COLORS.gold, fontWeight: 700 }}>{attended}% att.</div>
        </div>
        <div style={{ color: COLORS.muted, fontSize: 16 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: COLORS.border, margin: "0 16px" }}>
        <div
          style={{
            height: "100%",
            width: `${attended}%`,
            background: attended >= 85 ? COLORS.teal : COLORS.gold,
            borderRadius: 3,
            transition: "width 0.6s",
          }}
        />
      </div>

      {/* Quick actions always visible */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
        <button
          onClick={() => onMarkAttendance(student)}
          style={{
            flex: 1,
            background: COLORS.teal,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "10px 0",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          ✓ Mark Attendance
        </button>
        <button
          style={{
            flex: 1,
            background: COLORS.bg,
            color: COLORS.navy,
            border: `1.5px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: "10px 0",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          📖 Lesson Log
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: "12px 16px 14px",
            background: "#FAFBFD",
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "8px 10px", border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600 }}>LAST LESSON</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>
                {student.lastLesson || "Not recorded yet"}
              </div>
            </div>
            <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "8px 10px", border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600 }}>PACE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>{student.pace}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{
                flex: 1,
                background: "#fff",
                color: COLORS.sky,
                border: `1.5px solid ${COLORS.sky}`,
                borderRadius: 8,
                padding: "7px 0",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📅 Schedule
            </button>
            <button
              style={{
                flex: 1,
                background: "#fff",
                color: COLORS.navyMid,
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "7px 0",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📊 Reports
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanReminderBanner({ plan, studentName }) {
  // Show if current month plan not filled
  if (plan?.planFilled) return null;
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FFF3E0, #FFF8F0)",
        border: `1.5px solid ${COLORS.goldLight}`,
        borderRadius: 12,
        padding: "11px 14px",
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: "#7A4500", marginBottom: 2 }}>
          March Plan Not Submitted
        </div>
        <div style={{ fontSize: 12, color: "#996600", lineHeight: 1.5 }}>
          {studentName}'s monthly planning form for March 2026 is pending. It should be filled by month-end.
        </div>
        <button
          style={{
            marginTop: 8,
            background: COLORS.gold,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Fill Plan Now →
        </button>
      </div>
    </div>
  );
}

function PlanContextPanel({ plan }) {
  if (!plan) return null;
  const lastMonth = plan.targetMonth?.replace("March", "February") || "Last Month";
  return (
    <div
      style={{
        background: "#F0F7FF",
        border: `1.5px solid #C3DCF5`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📖</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: COLORS.navy }}>Monthly Plan — {lastMonth}</span>
        </div>
        <span
          style={{
            background: "#D4F5E9",
            color: COLORS.teal,
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          ✓ {plan.status}
        </span>
      </div>

      {/* Progress: from → to */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          borderRadius: 10,
          padding: "9px 12px",
          marginBottom: 10,
          border: `1px solid #D6E8FA`,
        }}
      >
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>START</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.navy }}>{plan.fromPosition}</div>
        </div>
        <div style={{ fontSize: 18, color: COLORS.sky }}>→</div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600, marginBottom: 2 }}>TARGET</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.teal }}>{plan.toPosition}</div>
        </div>
      </div>

      {/* Current actual vs target */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 9,
            padding: "8px 10px",
            border: `1px solid #D6E8FA`,
          }}
        >
          <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600 }}>CURRENTLY AT</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.sky, marginTop: 2 }}>{plan.currentActual}</div>
        </div>
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 9,
            padding: "8px 10px",
            border: `1px solid #D6E8FA`,
          }}
        >
          <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 600 }}>MONTHLY TARGET</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.gold, marginTop: 2 }}>{plan.monthlyTarget}</div>
        </div>
      </div>

      {/* Teacher's own note from last plan */}
      {plan.notes && (
        <div
          style={{
            background: "#EAF4FF",
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 12,
            color: "#4A6E8A",
            fontStyle: "italic",
            borderLeft: `3px solid ${COLORS.sky}`,
          }}
        >
          💬 "{plan.notes}"
        </div>
      )}
    </div>
  );
}

function AttendanceModal({ student, onClose }) {
  const [status, setStatus] = useState("present");
  const [lesson, setLesson] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const plan = student?.monthlyPlan;

  if (!student) return null;
  if (done)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20,
        }}
      >
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, textAlign: "center", maxWidth: 320, width: "100%" }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.navy, marginBottom: 6 }}>Attendance Marked!</div>
          <div style={{ color: COLORS.muted, fontSize: 14, marginBottom: 20 }}>
            {student.name} — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
          {!plan?.planFilled && (
            <div
              style={{
                background: "#FFF8E1",
                border: `1px solid ${COLORS.goldLight}`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 12,
                color: "#7A5200",
              }}
            >
              📋 Don't forget — March plan for {student.name} is still pending!
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: COLORS.teal,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "12px 32px",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Done
          </button>
        </div>
      </div>
    );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "20px 20px 36px",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 40, height: 4, background: COLORS.border, borderRadius: 2, margin: "0 auto 18px" }} />

        {/* Student header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: 12,
              background: student.avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 15,
            }}
          >
            {student.avatar}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.navy }}>Mark Attendance</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>{student.name} · {student.course}</div>
          </div>
        </div>

        {/* ── PLAN NOT SUBMITTED REMINDER ── */}
        <PlanReminderBanner plan={plan} studentName={student.name} />

        {/* ── LAST MONTH PLAN CONTEXT ── */}
        <PlanContextPanel plan={plan} />

        {/* Divider */}
        <div style={{ height: 1, background: COLORS.border, marginBottom: 14 }} />

        <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 8 }}>Today's Status</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["present", "absent", "late"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10,
                border: `2px solid ${status === s ? (s === "present" ? COLORS.teal : s === "absent" ? COLORS.alert : COLORS.gold) : COLORS.border}`,
                background: status === s ? (s === "present" ? "#E8F7F2" : s === "absent" ? "#FFF0F0" : "#FFF8E1") : "#fff",
                color: status === s ? (s === "present" ? COLORS.teal : s === "absent" ? COLORS.alert : COLORS.gold) : COLORS.muted,
                fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {s === "present" ? "✓ Present" : s === "absent" ? "✗ Absent" : "⏱ Late"}
            </button>
          ))}
        </div>

        <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 6 }}>Lesson Covered (optional)</div>
        <input
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          placeholder={`e.g. ${plan?.currentActual || student.currentSurah}`}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: `1.5px solid ${COLORS.border}`, fontSize: 14,
            marginBottom: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
          }}
        />

        <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy, marginBottom: 6 }}>Notes (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Student was struggling with tajweed..."
          rows={2}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            border: `1.5px solid ${COLORS.border}`, fontSize: 14,
            marginBottom: 18, outline: "none", resize: "none",
            boxSizing: "border-box", fontFamily: "inherit",
          }}
        />

        <button
          onClick={() => setDone(true)}
          style={{
            width: "100%", background: COLORS.teal, color: "#fff",
            border: "none", borderRadius: 12, padding: "14px 0",
            fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}
        >
          Save Attendance

        </button>
      </div>
    </div>
  );
}

function TopBar() {
  const now = useLiveClock();
  const hijri = toHijri(now);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
  const adDate = now.toLocaleDateString("en-US", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div
      style={{
        background: COLORS.navy,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Date / Time strip */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "8px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {/* Islamic date */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>☪️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#C8E6FF", letterSpacing: 0.2 }}>
              {hijri.day} {hijri.monthName} {hijri.year} AH
            </div>
          </div>
        </div>

        {/* Live clock */}
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "4px 10px",
            fontFamily: "'Courier New', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.tealLight,
            letterSpacing: 1,
            minWidth: 100,
            textAlign: "center",
          }}
        >
          {timeStr}
        </div>

        {/* AD date */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8AACCC" }}>{adDate}</div>
        </div>
      </div>

      {/* Main header row */}
      <div style={{ padding: "12px 18px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, color: "#4A7CA0", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
            Al-Quran Academy
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            Assalamu Alaikum, Sana 👋
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 10,
              width: 38,
              height: 38,
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
              position: "relative",
            }}
          >
            🔔
            <span
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 7,
                height: 7,
                background: COLORS.alert,
                borderRadius: "50%",
                border: `2px solid ${COLORS.navy}`,
              }}
            />
          </button>
          <div
            style={{
              background: COLORS.teal,
              borderRadius: 10,
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            SS
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const [activeModal, setActiveModal] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const nextStudent = [...students].sort((a, b) => a.nextClass - b.nextClass)[0];
  const prayerTimes = usePrayerTimes("Asia/Karachi");

  return (
    <div
      style={{
        background: COLORS.bg,
        minHeight: "100vh",
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <TopBar />

      {/* SCROLLABLE CONTENT */}
      <div style={{ padding: "16px 16px 90px" }}>
        {/* MISSED ATTENDANCE TICKER */}
        <AttendanceTicker missed={missedAttendance} />

        {/* NEXT CLASS — REAL-TIME COUNTDOWN */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Next Scheduled Class
          </div>
          <NextClassCard student={nextStudent} />
        </div>

        {/* PRAYER TIMES WIDGET */}
        <PrayerTimesWidget prayerTimes={prayerTimes} />

        {/* MY STUDENTS — SMART CARDS */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.navy }}>👩‍🎓 My Students</div>
            <button
              style={{
                fontSize: 12,
                color: COLORS.teal,
                background: "none",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              All Students →
            </button>
          </div>
          {students.map((s) => (
            <StudentQuickCard key={s.id} student={s} onMarkAttendance={(st) => setActiveModal(st)} />
          ))}
        </div>

        {/* QUICK ACTIONS STRIP */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            Quick Actions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "🎥", label: "Start Class", color: COLORS.navy, bg: COLORS.navy, textColor: "#fff" },
              { icon: "✅", label: "Mark Attendance", color: COLORS.teal, bg: "#E8F7F2", textColor: COLORS.teal },
              { icon: "📖", label: "Lesson Log", color: COLORS.sky, bg: "#E8F4FC", textColor: COLORS.sky },
              { icon: "📊", label: "Reports", color: COLORS.gold, bg: "#FFF8E1", textColor: COLORS.gold },
            ].map((a) => (
              <button
                key={a.label}
                style={{
                  background: a.bg,
                  border: `1.5px solid ${a.bg === COLORS.navy ? "transparent" : a.color}22`,
                  borderRadius: 14,
                  padding: "14px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: a.textColor }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TEACHER STATS COMPACT */}
        <div
          style={{
            background: COLORS.card,
            borderRadius: 16,
            padding: "14px 16px",
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.navy, marginBottom: 12 }}>📈 My Stats — March</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { val: "82", label: "Sessions", sub: "This month", color: COLORS.teal },
              { val: "82%", label: "Attendance", sub: "Avg. across students", color: COLORS.sky },
              { val: "2", label: "Students", sub: "Active", color: COLORS.gold },
            ].map((s) => (
              <div
                key={s.label}
                style={{ textAlign: "center", background: COLORS.bg, borderRadius: 10, padding: "10px 6px" }}
              >
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy }}>{s.label}</div>
                <div style={{ fontSize: 10, color: COLORS.muted }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          padding: "10px 0 18px",
          zIndex: 200,
        }}
      >
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "students", icon: "👩‍🎓", label: "Students" },
          { id: "plan", icon: "📅", label: "Planning" },
          { id: "finance", icon: "💰", label: "Salary" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              gap: 3,
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: activeTab === tab.id ? COLORS.teal : COLORS.muted,
              }}
            >
              {tab.label}
            </span>
            {activeTab === tab.id && (
              <div style={{ width: 18, height: 3, background: COLORS.teal, borderRadius: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* ATTENDANCE MODAL */}
      {activeModal && <AttendanceModal student={activeModal} onClose={() => setActiveModal(null)} />}
    </div>
  );
}
