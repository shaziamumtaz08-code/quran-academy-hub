/**
 * AQT-branded login identities for students.
 *
 * Rule: parent emails belong to parents, teacher emails belong to teachers.
 * Students never log in with someone else's inbox — the academy issues them a
 * unique `firstname.lastname@alqurantimeacademy.com` login id. These addresses
 * are login-only (no mailbox); all communication stays inside the LMS and
 * password resets are done by an admin.
 */

export const AQT_LOGIN_DOMAIN = "alqurantimeacademy.com";

/** Honorifics / extremely common given names that make a poor, ambiguous alias. */
const SKIP_NAME_PARTS = new Set([
  "muhammad", "mohammad", "mohammed", "muhammed", "mohd", "md", "mhd",
  "syed", "syeda", "sayyed", "sayed", "sayyid",
  "mst", "mstt", "mrs", "mr", "ms", "miss",
  "hafiz", "hafiza", "hafidh", "qari", "qaria", "maulana", "mufti",
  "sheikh", "shaikh", "shaykh", "mirza", "malik", "chaudhry", "ch",
  "al", "ul", "abdul", "abd", "bin", "binte", "bint", "ibn",
]);

function normalisePart(part: string) {
  return part
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Build the local part of the login address from a full name. */
export function aqtHandleFromName(fullName: string): string {
  const parts = (fullName || "")
    .split(/\s+/)
    .map(normalisePart)
    .filter(Boolean);

  if (!parts.length) return "";

  let distinctive = parts.filter((p) => !SKIP_NAME_PARTS.has(p) && p.length > 1);
  if (!distinctive.length) distinctive = parts;

  // First distinctive name + last distinctive name (max two parts).
  const picked = distinctive.length > 1
    ? [distinctive[0], distinctive[distinctive.length - 1]]
    : [distinctive[0]];

  return picked.join(".").slice(0, 48);
}

async function emailTaken(admin: any, email: string): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Generate a unique AQT login address for a student.
 * `reserved` holds addresses already handed out inside the current request.
 */
export async function generateAqtEmail(
  admin: any,
  fullName: string,
  reserved: Set<string> = new Set(),
): Promise<string> {
  const handle = aqtHandleFromName(fullName);
  if (!handle) throw new Error(`Cannot build a login address from the name "${fullName}"`);

  for (let n = 0; n < 60; n++) {
    const candidate = `${handle}${n ? n + 1 : ""}@${AQT_LOGIN_DOMAIN}`;
    if (reserved.has(candidate)) continue;
    if (await emailTaken(admin, candidate)) continue;
    reserved.add(candidate);
    return candidate;
  }
  throw new Error(`Could not allocate a unique login address for "${fullName}"`);
}

/** Strong, readable one-time password an admin can pass on over WhatsApp. */
export function generateInitialPassword(): string {
  const words = ["Noor", "Falah", "Sabr", "Huda", "Amal", "Rahma", "Barakah", "Ilm"];
  const word = words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  const symbols = "!@#$%&*";
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  return `${word}${digits}${symbol}`;
}

export function isAqtLogin(email: string | null | undefined): boolean {
  return (email || "").toLowerCase().endsWith(`@${AQT_LOGIN_DOMAIN}`);
}
