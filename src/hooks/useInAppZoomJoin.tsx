import React, { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/lib/ensureSession';
import { notifyMeetingPasscode } from '@/lib/zoomPasscode';
import { parseZoomLink } from '@/lib/zoomLink';
import { reserveTab, navigateTab, closeTab } from '@/lib/popupWindow';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ZoomSdkMeeting } from '@/components/classroom/ZoomSdkMeeting';

export interface JoinClassBody {
  teacherId: string;
  studentId?: string | null;
  assignmentId?: string | null;
  scheduleId?: string | null;
  scheduledStart?: string | null;
  liveSessionId?: string | null;
}

interface SdkState {
  zoomAccountId: string;
  meetingNumber: string;
  passcode: string;
  joinUrl: string;
  title: string;
}

/**
 * Single join path for scheduled classes (1:1 and group).
 *
 * The schedule banner calls `join()`; when the hosting Zoom account has Meeting
 * SDK credentials the class opens INSIDE the LMS. Anything else (no SDK creds,
 * unparsable link, SDK failure) silently falls back to the external Zoom tab.
 */
export function useInAppZoomJoin(role: 0 | 1) {
  const { profile, user } = useAuth() as any;
  const [sdk, setSdk] = useState<SdkState | null>(null);

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

        const parsed =
          payload.meetingNumber
            ? { meetingNumber: String(payload.meetingNumber), passcode: payload.passcode || '' }
            : parseZoomLink(payload.joinUrl);

        if (payload.sdkReady && payload.zoomAccountId && parsed?.meetingNumber) {
          closeTab(tab);
          setSdk({
            zoomAccountId: payload.zoomAccountId,
            meetingNumber: parsed.meetingNumber,
            passcode: parsed.passcode || payload.passcode || '',
            joinUrl: payload.joinUrl,
            title,
          });
          return true;
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

  const userName =
    (profile?.full_name && String(profile.full_name).trim()) ||
    (user?.email && String(user.email).split('@')[0]) ||
    'AQTA User';

  const dialog = (
    <Dialog open={!!sdk} onOpenChange={(o) => !o && setSdk(null)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{sdk?.title || 'Class'}</DialogTitle>
        </DialogHeader>
        {sdk && (
          <ZoomSdkMeeting
            zoomAccountId={sdk.zoomAccountId}
            meetingNumber={sdk.meetingNumber}
            passcode={sdk.passcode}
            userName={userName}
            userEmail={profile?.email || user?.email || undefined}
            role={role}
            height={580}
            onFailure={() => {
              const url = sdk.joinUrl;
              setSdk(null);
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { join, dialog, inAppOpen: !!sdk };
}
