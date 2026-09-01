export interface ParsedZoomLink {
  meetingNumber: string;
  /** Plain numeric/alphanumeric passcode, safe to pass as the SDK `password`. */
  passcode: string;
  /** Zoom's long ENCRYPTED pwd token — must be passed as `tk`, never as `password`. */
  encryptedToken: string;
}

/**
 * A `pwd` value is Zoom's encrypted join token (not a passcode) when it is long
 * and/or carries the trailing `.1` segment Zoom appends to those tokens.
 */
export function isEncryptedPwd(pwd: string): boolean {
  const v = (pwd || '').trim();
  if (!v) return false;
  return v.length > 12 || /\.\d+$/.test(v);
}

/** Parse a Zoom join URL: /j/{meetingNumber}?pwd= or /wc/{meetingNumber}/join */
export function parseZoomLink(link: string): ParsedZoomLink | null {
  try {
    const url = new URL(link);
    const m =
      url.pathname.match(/\/j\/(\d{9,12})/) || url.pathname.match(/\/wc\/(\d{9,12})/);
    if (!m) return null;
    const pwd = url.searchParams.get('pwd') || '';
    const encrypted = isEncryptedPwd(pwd);
    return {
      meetingNumber: m[1],
      passcode: encrypted ? '' : pwd,
      encryptedToken: encrypted ? pwd : '',
    };
  } catch {
    return null;
  }
}
