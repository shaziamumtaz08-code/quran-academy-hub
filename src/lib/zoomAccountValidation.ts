// Shared Server-to-Server OAuth validate-and-save call for a Zoom seat.
// Used by BOTH the "Link account" wizard (new seat) and the Credentials tab
// (editing an existing seat) so the logic exists in exactly one place.
import { supabase } from '@/integrations/supabase/client';

export interface ZoomValidatePayload {
  teacher_id: string;
  tier: 'free' | 'licensed' | string;
  account_id: string;
  client_id: string;
  client_secret: string;
  zoom_email: string;
  personal_meeting_link?: string;
}

export interface ZoomValidateResult {
  ok?: boolean;
  saved?: any;
  verdict?: string;
  failure_reason?: string;
  error?: string;
  credential_status?: string;
  checks?: Array<{ step: string; ok: boolean; detail?: string }>;
  resolved?: { host_id?: string; plan_label?: string; [k: string]: any };
}

export async function validateAndSaveZoomAccount(
  payload: ZoomValidatePayload,
): Promise<ZoomValidateResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
  const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-validate-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ ...payload, save: true }),
  });
  return (await resp.json()) as ZoomValidateResult;
}
