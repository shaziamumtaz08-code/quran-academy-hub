import { supabase } from "@/integrations/supabase/client";

export type ActionType =
  | 'attendance_marked'
  | 'attendance_save_failed'
  | 'attendance_edited'
  | 'attendance_updated'
  | 'attendance_deleted'
  | 'plan_created'
  | 'plan_updated'
  | 'plan_approved'
  | 'plan_deleted'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'assignment_created'
  | 'assignment_updated'
  | 'assignment_status_changed'
  | 'exam_created'
  | 'login_success'
  | 'login_failed'
  | 'login'
  | 'logout'
  | 'billing_plan_created'
  | 'billing_plan_updated'
  | 'billing_plan_deleted'
  | 'billing_plan_closed'
  | 'invoice_edited'
  | 'invoice_deleted'
  | 'invoice_status_changed'
  | 'payment_recorded'
  | 'payment_edited'
  | 'fee_package_created'
  | 'fee_package_updated'
  | 'fee_package_deleted'
  | 'discount_created'
  | 'discount_updated'
  | 'discount_deleted'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_archived'
  | 'profile_restored'
  | 'role_changed'
  | 'role_assigned'
  | 'role_removed'
  | 'credentials_reset'
  | 'enrollment_status_changed'
  | 'course_status_changed'
  | 'lead_status_changed';

export type EntityType =
  | 'attendance'
  | 'monthly_plan'
  | 'user'
  | 'profile'
  | 'assignment'
  | 'enrollment'
  | 'course'
  | 'lead'
  | 'exam'
  | 'session'
  | 'billing_plan'
  | 'invoice'
  | 'fee_package'
  | 'discount'
  | 'payment_transaction'
  | 'auth';

interface LogActivityParams {
  action: ActionType;
  entityType: EntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  divisionId?: string | null;
  branchId?: string | null;
  details?: Record<string, any>;
}

/**
 * Log a system activity. Failures are swallowed (logging must never break flows).
 */
export async function trackActivity(params: LogActivityParams): Promise<void> {
  const {
    action, entityType, entityId, entityLabel,
    oldValues, newValues, divisionId, branchId, details = {},
  } = params;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const pktTimestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Karachi', dateStyle: 'full', timeStyle: 'long',
    });

    await (supabase.from('system_logs') as any).insert({
      user_id: user.id,
      user_full_name: profile?.full_name || user.email || 'Unknown',
      user_email: profile?.email || user.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_label: entityLabel || null,
      old_values: oldValues || null,
      new_values: newValues || null,
      division_id: divisionId || null,
      branch_id: branchId || null,
      details: { ...details, pkt_timestamp: pktTimestamp },
    });
  } catch (err) {
    console.warn('trackActivity failed (non-fatal):', err);
  }
}

/** Format a log entry actor string. */
export function formatLogEntry(log: {
  user_full_name: string;
  user_email: string | null;
  action: string;
  created_at: string;
}): string {
  const actor = log.user_email ? `${log.user_full_name} (${log.user_email})` : log.user_full_name;
  return `Action performed by ${actor}`;
}

/* ─────────────  Display helpers used by Activity Log UI  ───────────── */

export type ActionCategory = 'role' | 'status' | 'financial' | 'auth' | 'content' | 'other';

export function categorizeAction(action: string): ActionCategory {
  if (action.startsWith('role_') || action.includes('credentials')) return 'role';
  if (action.includes('status_changed') || action.includes('archived') || action.includes('restored')) return 'status';
  if (
    action.startsWith('invoice_') || action.startsWith('payment_') ||
    action.startsWith('billing_') || action.startsWith('fee_') ||
    action.startsWith('discount_')
  ) return 'financial';
  if (action.startsWith('login') || action === 'logout') return 'auth';
  if (
    action.startsWith('attendance_') || action.startsWith('plan_') ||
    action.startsWith('exam_') || action.startsWith('profile_') ||
    action.startsWith('assignment_') || action.startsWith('course_') ||
    action.startsWith('user_') || action.startsWith('enrollment_') ||
    action.startsWith('lead_')
  ) return 'content';
  return 'other';
}

export function categoryStyles(cat: ActionCategory): { pill: string; dot: string } {
  switch (cat) {
    case 'role':      return { pill: 'bg-purple-100 text-purple-800 border-purple-200',  dot: 'bg-purple-500' };
    case 'status':    return { pill: 'bg-amber-100 text-amber-800 border-amber-200',     dot: 'bg-amber-500' };
    case 'financial': return { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
    case 'auth':      return { pill: 'bg-sky-100 text-sky-800 border-sky-200',           dot: 'bg-sky-500' };
    case 'content':   return { pill: 'bg-slate-100 text-slate-700 border-slate-200',     dot: 'bg-slate-500' };
    default:          return { pill: 'bg-muted text-foreground border-border',            dot: 'bg-muted-foreground' };
  }
}

export function humanizeAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function describeChange(log: {
  action: string;
  user_full_name: string;
  entity_label?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
}): string {
  const who = log.user_full_name || 'Someone';
  const target = log.entity_label ? ` for ${log.entity_label}` : '';
  const ov = log.old_values || {};
  const nv = log.new_values || {};
  const keys = Array.from(new Set([...Object.keys(ov), ...Object.keys(nv)]));
  if (keys.length === 1) {
    const k = keys[0];
    return `${who} changed ${k.replace(/_/g, ' ')} from "${ov[k] ?? '—'}" to "${nv[k] ?? '—'}"${target}`;
  }
  return `${who} performed ${humanizeAction(log.action)}${target}`;
}
