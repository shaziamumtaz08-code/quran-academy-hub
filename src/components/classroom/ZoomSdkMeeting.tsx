import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ZoomSdkMeetingProps {
  meetingNumber: string;
  passcode: string;
  userName: string;
  userEmail?: string;
  role: 0 | 1;
  height?: number;
  /** The course class this meeting belongs to — resolves the hosting Zoom account. */
  courseClassId?: string;
  /** Alternative to courseClassId: resolve credentials from this Zoom account directly. */
  zoomAccountId?: string;
  /** Called when the SDK cannot start — parent should fall back to the iframe. */
  onFailure?: (message: string) => void;
}



/**
 * Zoom Meeting SDK for Web — component view (renders inside our own panel,
 * not the full-page Zoom client). Desktop browsers only for this pass.
 */
export function ZoomSdkMeeting({
  courseClassId,
  zoomAccountId,
  meetingNumber,
  passcode,
  userName,
  userEmail,
  role,
  height = 580,
  onFailure,
}: ZoomSdkMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'joined' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let sdkErrorObserver: MutationObserver | null = null;
    let failureReported = false;

    const reportFailure = (message: string) => {
      if (cancelled || failureReported) return;
      failureReported = true;
      setStatus('error');
      onFailure?.(message);
    };

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('zoom-meeting-signature', {
          body: { meetingNumber, role, courseClassId, zoomAccountId },
        });
        if (error || !data?.signature) throw new Error(error?.message || 'Could not get meeting signature');
        if (cancelled || !containerRef.current) return;

        const ZoomMtgEmbedded = (await import('@zoom/meetingsdk/embedded')).default;
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        await client.init({
          zoomAppRoot: containerRef.current,
          language: 'en-US',
          patchJsMedia: true,
          customize: {
            video: {
              isResizable: false,
              viewSizes: {
                default: { width: containerRef.current.clientWidth || 720, height: height - 60 },
              },
            },
          },
        });

        // Some Meeting SDK authentication failures are rendered in Zoom's own
        // modal instead of rejecting join(). Detect those terminal messages so
        // the parent can expose the normal browser/Zoom-app fallback.
        sdkErrorObserver = new MutationObserver(() => {
          const text = containerRef.current?.textContent?.toLowerCase() || '';
          if (text.includes('signature is invalid')) {
            reportFailure('Zoom rejected this account’s Meeting SDK credentials');
          } else if (text.includes('fail to join the meeting')) {
            reportFailure('Zoom could not start the in-app meeting');
          }
        });
        sdkErrorObserver.observe(containerRef.current, { childList: true, subtree: true, characterData: true });

        await client.join({
          signature: data.signature,
          meetingNumber,
          password: passcode || '',
          userName,
          userEmail: userEmail || undefined,
        });

        if (!cancelled) setStatus('joined');
      } catch (e: any) {
        reportFailure(e?.message || 'Zoom SDK failed to start');
      }
    })();

    return () => {
      cancelled = true;
      sdkErrorObserver?.disconnect();
      try {
        clientRef.current?.leaveMeeting?.();
      } catch { /* ignore */ }
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingNumber, passcode, userName, role, courseClassId, zoomAccountId]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full overflow-hidden rounded-md bg-muted" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the class…
        </div>
      )}
    </div>
  );
}
