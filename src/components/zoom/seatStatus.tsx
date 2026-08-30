// Shared seat health vocabulary + chip styling, used by the Zoom seats
// workspace and the Credentials tab so both read identically.
import { cn } from '@/lib/utils';

export type SeatStatus =
  | 'healthy'
  | 'no_events'
  | 'missing_host_id'
  | 'no_credentials'
  | 'credentials_invalid';

export const STATUS_META: Record<SeatStatus, { label: string; hint: string; dot: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    hint: 'Zoom is delivering real attendance telemetry for this seat.',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  no_events: {
    label: 'No events yet',
    hint: 'Credentials and host ID are set, but Zoom has never posted an event. Check the Event Subscription URL in this account’s Marketplace app.',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
  },
  missing_host_id: {
    label: 'Missing host ID',
    hint: 'Events cannot be matched to this teacher. Use Repair host IDs to fetch it from Zoom.',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  no_credentials: {
    label: 'Credentials missing',
    hint: 'This seat has no Server-to-Server OAuth app credentials. Add them in Accounts → Credentials (Server-to-Server OAuth app), then subscribe that app to the webhook URL.',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
  credentials_invalid: {
    label: 'Credentials failed',
    hint: 'Zoom refused these credentials or the user lookup failed. Fix them in Accounts → Credentials.',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
};

export const STATUS_TONE: Record<SeatStatus, string> = {
  healthy: 'ok',
  no_events: 'quiet',
  missing_host_id: 'warn',
  no_credentials: 'live',
  credentials_invalid: 'live',
};

export function StatusLabel({ status, className }: { status?: SeatStatus; className?: string }) {
  if (!status) return <span className="zw-meta">—</span>;
  const meta = STATUS_META[status];
  return (
    <span className={cn('zw-chip', className)} data-tone={STATUS_TONE[status]}>
      <span className="zw-dot" />
      {meta.label}
    </span>
  );
}
