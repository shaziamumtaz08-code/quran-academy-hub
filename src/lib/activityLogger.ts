import { supabase } from "@/integrations/supabase/client";

export type ActionType = 
  | 'attendance_marked'
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
  | 'exam_created'
  | 'login'
  | 'logout'
  | 'billing_plan_created'
  | 'billing_plan_updated'
  | 'billing_plan_deleted'
  | 'invoice_edited'
  | 'invoice_deleted'
  | 'payment_recorded'
  | 'fee_package_created'
  | 'fee_package_updated'
  | 'fee_package_deleted'
  | 'discount_created'
  | 'discount_updated'
  | 'discount_deleted';

export type EntityType = 
  | 'attendance'
  | 'monthly_plan'
  | 'user'
  | 'assignment'
  | 'exam'
  | 'session'
  | 'billing_plan'
  | 'invoice'
  | 'fee_package'
  | 'discount';

interface LogActivityParams {
  action: ActionType;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, any>;
}

/**
 * Logs an activity with human-readable identity information.
 * Captures user's full_name and email at the time of action for historical accuracy.
 * All timestamps are stored in PKT timezone context.
 */
export async function trackActivity({
  action,
  entityType,
  entityId,
  details = {}
}: LogActivityParams): Promise<void> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Failed to get user for activity logging:', userError);
      return;
    }

    // Get user's profile for full_name
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Failed to get profile for activity logging:', profileError);
      return;
    }

    // Add PKT timestamp to details
    const pktTimestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'full',
      timeStyle: 'long'
    });

    const enrichedDetails = {
      ...details,
      pkt_timestamp: pktTimestamp,
    };

    // Insert log entry
    const { error: insertError } = await supabase
      .from('system_logs')
      .insert({
        user_id: user.id,
        user_full_name: profile.full_name,
        user_email: profile.email || user.email || null,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: enrichedDetails,
      });

    if (insertError) {
      console.error('Failed to insert activity log:', insertError);
    }
  } catch (error) {
    console.error('Error in trackActivity:', error);
  }
}

/**
 * Format a log entry for display
 */
export function formatLogEntry(log: {
  user_full_name: string;
  user_email: string | null;
  action: string;
  created_at: string;
}): string {
  const actor = log.user_email 
    ? `${log.user_full_name} (${log.user_email})`
    : log.user_full_name;
  
  return `Action performed by ${actor}`;
}
