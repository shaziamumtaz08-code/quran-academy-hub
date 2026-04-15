import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, X, Video, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface ZoomIframeProps {
  meetingLink: string;
  className?: string;
  classTime?: string;
  onEndSession?: () => void;
}

function ZoomIframeInner({ meetingLink, className, classTime, onEndSession }: ZoomIframeProps) {
  const [iframeError, setIframeError] = useState(false);
  const [showIframe, setShowIframe] = useState(false);

  if (!showIframe) {
    return (
      <Card className={cn('border-emerald-200 bg-emerald-50/30', className)}>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Video className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Live Classroom</p>
              {classTime && <p className="text-xs text-muted-foreground">{classTime}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowIframe(true)}>
              <Video className="h-4 w-4 mr-1" /> Launch Zoom
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(meetingLink, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-1" /> Open in Browser
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Info bar */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500 text-white animate-pulse text-[10px]">LIVE</Badge>
          {classTime && <span className="text-xs text-muted-foreground">{classTime}</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.open(meetingLink, '_blank')}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in Browser
          </Button>
          <Button size="sm" variant="destructive" onClick={() => {
            setShowIframe(false);
            onEndSession?.();
          }}>
            <X className="h-3.5 w-3.5 mr-1" /> End Session
          </Button>
        </div>
      </div>

      {/* Iframe or error */}
      {iframeError ? (
        <Card className="border-amber-200">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">Zoom couldn't load in the embedded view</p>
            <p className="text-xs text-muted-foreground mb-3">Some browser settings may block embedded meetings.</p>
            <Button onClick={() => window.open(meetingLink, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-1" /> Open Zoom in New Tab
            </Button>
          </CardContent>
        </Card>
      ) : (
        <iframe
          src={meetingLink}
          className="w-full rounded-lg border border-border"
          style={{ height: '600px' }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          allow="camera; microphone; fullscreen"
          onError={() => setIframeError(true)}
          title="Zoom Meeting"
        />
      )}
    </div>
  );
}

export function ZoomIframe(props: ZoomIframeProps) {
  return (
    <ErrorBoundary>
      <ZoomIframeInner {...props} />
    </ErrorBoundary>
  );
}
