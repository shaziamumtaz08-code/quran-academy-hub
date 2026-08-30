/** Parse a standard Zoom join URL: https://<host>/j/{meetingNumber}?pwd={passcode} */
export function parseZoomLink(link: string): { meetingNumber: string; passcode: string } | null {
  try {
    const url = new URL(link);
    const m = url.pathname.match(/\/j\/(\d{9,12})/);
    if (!m) return null;
    return { meetingNumber: m[1], passcode: url.searchParams.get('pwd') || '' };
  } catch {
    return null;
  }
}
