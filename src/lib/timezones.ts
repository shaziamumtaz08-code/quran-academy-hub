// IANA Timezone list with common timezones
// Timezone is PRIMARY for all scheduling/attendance logic

export interface TimezoneInfo {
  value: string; // IANA timezone identifier
  label: string; // Display label
  offset: number; // Approximate UTC offset (hours) - for sorting
  abbr: string; // Short abbreviation for display
}

export const TIMEZONES: TimezoneInfo[] = [
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (New York)', offset: -5, abbr: 'ET' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)', offset: -6, abbr: 'CT' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)', offset: -7, abbr: 'MT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)', offset: -8, abbr: 'PT' },
  { value: 'America/Toronto', label: 'Eastern Time (Toronto)', offset: -5, abbr: 'ET' },
  { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)', offset: -8, abbr: 'PT' },
  
  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 0, abbr: 'GMT' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 1, abbr: 'CET' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: 1, abbr: 'CET' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', offset: 3, abbr: 'MSK' },
  
  // Middle East
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4, abbr: 'GST' },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST)', offset: 3, abbr: 'AST' },
  { value: 'Asia/Kuwait', label: 'Kuwait (AST)', offset: 3, abbr: 'AST' },
  { value: 'Asia/Bahrain', label: 'Bahrain (AST)', offset: 3, abbr: 'AST' },
  { value: 'Asia/Qatar', label: 'Qatar (AST)', offset: 3, abbr: 'AST' },
  
  // South Asia
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)', offset: 5, abbr: 'PKT' },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 5.5, abbr: 'IST' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (BST)', offset: 6, abbr: 'BST' },
  { value: 'Asia/Colombo', label: 'Sri Lanka (IST)', offset: 5.5, abbr: 'IST' },
  
  // East Asia
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 8, abbr: 'SGT' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', offset: 8, abbr: 'HKT' },
  { value: 'Asia/Shanghai', label: 'China (CST)', offset: 8, abbr: 'CST' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 9, abbr: 'JST' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', offset: 9, abbr: 'KST' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', offset: 7, abbr: 'WIB' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)', offset: 8, abbr: 'MYT' },
  
  // Australia & Pacific
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: 10, abbr: 'AEST' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', offset: 10, abbr: 'AEST' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', offset: 10, abbr: 'AEST' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', offset: 8, abbr: 'AWST' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', offset: 12, abbr: 'NZST' },
  
  // Africa
  { value: 'Africa/Cairo', label: 'Cairo (EET)', offset: 2, abbr: 'EET' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', offset: 2, abbr: 'SAST' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)', offset: 1, abbr: 'WAT' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)', offset: 3, abbr: 'EAT' },
];

// Sort timezones by offset for display
export const TIMEZONES_SORTED = [...TIMEZONES].sort((a, b) => a.offset - b.offset);

/**
 * Get timezone info by IANA value
 */
export function getTimezoneByValue(value: string): TimezoneInfo | undefined {
  return TIMEZONES.find(tz => tz.value === value);
}

/**
 * Get timezone abbreviation for display
 */
export function getTimezoneAbbr(value: string | null | undefined): string {
  if (!value) return 'UTC';
  const tz = getTimezoneByValue(value);
  return tz?.abbr || value.split('/').pop() || 'UTC';
}

/**
 * Get UTC offset for a timezone
 */
export function getTimezoneOffset(value: string): number {
  const tz = getTimezoneByValue(value);
  return tz?.offset ?? 0;
}

/**
 * Convert time between timezones
 * @param time - Time string in HH:MM format
 * @param fromTz - Source timezone
 * @param toTz - Target timezone
 * @returns Time in target timezone
 */
export function convertTimeBetweenTimezones(
  time: string,
  fromTz: string,
  toTz: string
): string {
  const fromOffset = getTimezoneOffset(fromTz);
  const toOffset = getTimezoneOffset(toTz);
  
  const [hours, minutes] = time.split(':').map(Number);
  const fromMinutes = hours * 60 + minutes;
  
  const offsetDiffMinutes = (toOffset - fromOffset) * 60;
  let toMinutes = fromMinutes + offsetDiffMinutes;
  
  // Handle day wraparound
  if (toMinutes < 0) toMinutes += 24 * 60;
  if (toMinutes >= 24 * 60) toMinutes -= 24 * 60;
  
  const toHours = Math.floor(toMinutes / 60);
  const toMins = toMinutes % 60;
  
  return `${toHours.toString().padStart(2, '0')}:${toMins.toString().padStart(2, '0')}`;
}

/**
 * Format time in 12-hour format
 */
export function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get display label for timezone
 */
export function getTimezoneLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const tz = getTimezoneByValue(value);
  return tz?.label || value;
}
