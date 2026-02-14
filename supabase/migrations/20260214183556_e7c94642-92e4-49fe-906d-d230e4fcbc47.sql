
-- Step 1: Add missing timezone mappings for cities/countries found in profiles
INSERT INTO timezone_mappings (country, city, timezone) VALUES
  ('Belgium', 'Brussels', 'Europe/Brussels'),
  ('Pakistan', 'Hyderabad', 'Asia/Karachi'),
  ('Pakistan', 'Peshawar', 'Asia/Karachi'),
  ('Pakistan', 'Rahim Yar Khan', 'Asia/Karachi'),
  ('Pakistan', 'Rawalpindi', 'Asia/Karachi'),
  ('Pakistan', 'Sialkot', 'Asia/Karachi'),
  ('Pakistan', 'Thatta', 'Asia/Karachi'),
  ('Qatar', 'Al Khawr', 'Asia/Qatar'),
  ('United Arab Emirates', 'Abu Dhabi Municipality', 'Asia/Dubai'),
  ('United Arab Emirates', 'Ajman', 'Asia/Dubai'),
  ('United Arab Emirates', 'Dubai', 'Asia/Dubai'),
  ('United States', 'Chicago', 'America/Chicago'),
  ('United States', 'Fremont', 'America/Los_Angeles')
ON CONFLICT DO NOTHING;

-- Also add alias country entries for common mismatches
INSERT INTO timezone_mappings (country, city, timezone)
SELECT 'USA', city, timezone FROM timezone_mappings WHERE country = 'United States'
ON CONFLICT DO NOTHING;

INSERT INTO timezone_mappings (country, city, timezone)
SELECT 'UAE', city, timezone FROM timezone_mappings WHERE country = 'United Arab Emirates'
ON CONFLICT DO NOTHING;

-- Step 2: Fix profiles.timezone using timezone_mappings (case-insensitive match)
UPDATE profiles p
SET timezone = tm.timezone
FROM timezone_mappings tm
WHERE LOWER(TRIM(p.country)) = LOWER(TRIM(tm.country))
  AND LOWER(TRIM(p.city)) = LOWER(TRIM(tm.city))
  AND (p.timezone IS NULL OR p.timezone != tm.timezone);

-- Step 3: For profiles with country but no city match, use country-level defaults
UPDATE profiles SET timezone = 'Asia/Karachi' WHERE LOWER(TRIM(country)) IN ('pakistan') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'America/Toronto' WHERE LOWER(TRIM(country)) IN ('canada') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Europe/London' WHERE LOWER(TRIM(country)) IN ('uk', 'united kingdom') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Asia/Dubai' WHERE LOWER(TRIM(country)) IN ('uae', 'united arab emirates') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Asia/Riyadh' WHERE LOWER(TRIM(country)) IN ('saudi arabia', 'ksa') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Asia/Qatar' WHERE LOWER(TRIM(country)) IN ('qatar') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Europe/Brussels' WHERE LOWER(TRIM(country)) IN ('belgium') AND (timezone IS NULL OR timezone = '');
UPDATE profiles SET timezone = 'Australia/Sydney' WHERE LOWER(TRIM(country)) IN ('australia') AND (timezone IS NULL OR timezone = '');

-- Step 4: Update student_teacher_assignments timezone from corrected profiles
UPDATE student_teacher_assignments sta
SET student_timezone = sp.timezone
FROM profiles sp
WHERE sp.id = sta.student_id
  AND sp.timezone IS NOT NULL
  AND sp.timezone != '';

UPDATE student_teacher_assignments sta
SET teacher_timezone = tp.timezone
FROM profiles tp
WHERE tp.id = sta.teacher_id
  AND tp.timezone IS NOT NULL
  AND tp.timezone != '';

-- Step 5: Recalculate teacher_local_time for schedules where student_local_time = teacher_local_time
-- We use the assignment timezones to compute the offset
UPDATE schedules s
SET teacher_local_time = (
  -- Convert student time to teacher time using timezone offset difference
  -- Get offset hours for each timezone, compute difference, apply to student time
  s.student_local_time + 
  (
    CASE sta.teacher_timezone
      WHEN 'Asia/Karachi' THEN 5
      WHEN 'Asia/Dubai' THEN 4
      WHEN 'Asia/Riyadh' THEN 3
      WHEN 'Asia/Qatar' THEN 3
      WHEN 'Asia/Kolkata' THEN 5.5
      WHEN 'Europe/London' THEN 0
      WHEN 'Europe/Brussels' THEN 1
      WHEN 'America/Toronto' THEN -5
      WHEN 'America/New_York' THEN -5
      WHEN 'America/Chicago' THEN -6
      WHEN 'America/Los_Angeles' THEN -8
      WHEN 'America/Vancouver' THEN -8
      WHEN 'Australia/Sydney' THEN 10
      WHEN 'Australia/Melbourne' THEN 10
      ELSE 0
    END
    -
    CASE sta.student_timezone
      WHEN 'Asia/Karachi' THEN 5
      WHEN 'Asia/Dubai' THEN 4
      WHEN 'Asia/Riyadh' THEN 3
      WHEN 'Asia/Qatar' THEN 3
      WHEN 'Asia/Kolkata' THEN 5.5
      WHEN 'Europe/London' THEN 0
      WHEN 'Europe/Brussels' THEN 1
      WHEN 'America/Toronto' THEN -5
      WHEN 'America/New_York' THEN -5
      WHEN 'America/Chicago' THEN -6
      WHEN 'America/Los_Angeles' THEN -8
      WHEN 'America/Vancouver' THEN -8
      WHEN 'Australia/Sydney' THEN 10
      WHEN 'Australia/Melbourne' THEN 10
      ELSE 0
    END
  ) * INTERVAL '1 hour'
)::time
FROM student_teacher_assignments sta
WHERE s.assignment_id = sta.id
  AND s.student_local_time = s.teacher_local_time
  AND sta.student_timezone IS NOT NULL
  AND sta.teacher_timezone IS NOT NULL
  AND sta.student_timezone != sta.teacher_timezone;

-- Step 6: Remove hardcoded defaults on student_teacher_assignments columns
ALTER TABLE student_teacher_assignments ALTER COLUMN student_timezone DROP DEFAULT;
ALTER TABLE student_teacher_assignments ALTER COLUMN teacher_timezone DROP DEFAULT;
