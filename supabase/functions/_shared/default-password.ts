/**
 * Academy-wide default password scheme.
 *
 * Rule: <Lastname>@1234!  — last name, first letter capitalised.
 * e.g. "Muhammad Saadin Hussain" -> "Hussain@1234!"
 *
 * The "@" is required: plain "Lastname1234!" is rejected by the leaked-password
 * (HIBP) check. If a name yields a blocked or too-short value we fall back to
 * "Aqt" as the word part.
 */

const HONORIFICS = new Set([
  "muhammad", "mohammad", "mohammed", "muhammed", "mohd", "md", "mhd",
  "syed", "syeda", "sayyed", "sayed", "sayyid",
  "mst", "mrs", "mr", "ms", "miss",
  "hafiz", "hafiza", "qari", "qaria", "maulana", "mufti",
  "sheikh", "shaikh", "shaykh", "bin", "binte", "bint", "ibn",
]);

function clean(part: string) {
  return part
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "");
}

/** Last name used for the default password (honorifics skipped). */
export function passwordNameFor(fullName: string): string {
  const parts = (fullName || "").split(/\s+/).map(clean).filter(Boolean);
  const usable = parts.filter((p) => !HONORIFICS.has(p.toLowerCase()) && p.length > 1);
  const pick = (usable.length ? usable : parts).slice(-1)[0] || "Aqt";
  return pick.charAt(0).toUpperCase() + pick.slice(1).toLowerCase();
}

/**
 * Academy-wide default password.
 * Currently a single fixed value for every user, by admin instruction.
 * (Previous scheme was `${passwordNameFor(fullName)}@1234!`.)
 */
export const ACADEMY_DEFAULT_PASSWORD = "Test1234";

export function defaultPasswordFor(_fullName: string): string {
  return ACADEMY_DEFAULT_PASSWORD;
}
