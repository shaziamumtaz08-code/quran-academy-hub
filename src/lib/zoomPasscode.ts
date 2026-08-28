import { toast } from 'sonner';

/**
 * Zoom only skips its passcode prompt when the join link carries Zoom's long
 * encrypted `pwd` token. Rooms saved with a plain passcode still prompt, so we
 * show the passcode (with a copy action) whenever the backend returns one.
 */
export function notifyMeetingPasscode(passcode?: string | null) {
  const code = (passcode || '').trim();
  if (!code) return;
  toast.info(`Meeting passcode: ${code}`, {
    description: 'If Zoom asks for a passcode, enter this.',
    duration: 15000,
    action: {
      label: 'Copy',
      onClick: () => {
        navigator.clipboard?.writeText(code);
        toast.success('Passcode copied');
      },
    },
  });
}
