import React, { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/lib/ensureSession';
import { notifyMeetingPasscode } from '@/lib/zoomPasscode';
import { reserveTab, navigateTab, closeTab } from '@/lib/popupWindow';

export interface JoinClassBody {
  teacherId: string;
  studentId?: string | null;
  assignmentId?: string | null;
  scheduleId?: string | null;
  scheduledStart?: string | null;
  liveSessionId?: string | null;
}

/**
 * Single join path for scheduled classes (1:1 and group).
 *
 * The schedule banner calls `join()` and the class always opens in Zoom's own
 * browser tab — there is no in-app meeting player.
 */
export function useInAppZoomJoin(_role: 0 | 1) {

  const join = useCallback(
    async (
      body: JoinClassBody,
      title = 'Class',
      preReservedTab?: Window | null,
    ): Promise<boolean> => {
      // Reserve the tab inside the click gesture — popup blockers reject
      // window.open() issued after an await. Closed again if we go in-app.
      const tab = preReservedTab !== undefined ? preReservedTab : reserveTab();
      try {
        await ensureFreshSession();
        const { data, error } = await supabase.functions.invoke('zoom-join-class', { body });
        if (error) throw error;
        const payload = data as any;
        if (!payload?.joinUrl) {
          closeTab(tab);
          toast.info(payload?.message || "This class isn't open yet.");
          return false;
        }

        notifyMeetingPasscode(payload?.passcode);
        navigateTab(tab, payload.joinUrl);
        return true;
      } catch (e: any) {
        closeTab(tab);
        toast.error(e?.message || 'Could not open the class link.');
        return false;
      }
    },
    [],
  );

  return { join, dialog: null as React.ReactNode, inAppOpen: false };
}
