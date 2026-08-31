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
  /** Set when the in-app player fails to start — dialog stays open with a fallback link. */
  failed?: string;
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
      {/* Keep the meeting surface alive: outside clicks / Escape must not
          tear down the in-app class — only the explicit close button may. */}
      <DialogContent
        className="max-w-4xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{sdk?.title || 'Class'}</DialogTitle>
        </DialogHeader>
        {sdk && !sdk.failed && (
          <ZoomSdkMeeting
            zoomAccountId={sdk.zoomAccountId}
            meetingNumber={sdk.meetingNumber}
            passcode={sdk.passcode}
            userName={userName}
            userEmail={profile?.email || user?.email || undefined}
            role={role}
            height={580}
            onFailure={(msg) => setSdk((s) => (s ? { ...s, failed: msg } : s))}
          />
        )}
        {sdk?.failed && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground max-w-md">
              The built-in Zoom player couldn't start on this device
              {sdk.failed ? ` (${sdk.failed})` : ''}. You can join the class in the Zoom app instead.
            </p>
            <a
              href={sdk.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open class in Zoom
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return { join, dialog, inAppOpen: !!sdk };
}
