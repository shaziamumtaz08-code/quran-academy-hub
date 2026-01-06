import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, ExternalLink, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface LaunchClassCardProps {
  className?: string;
}

export function LaunchClassCard({ className }: LaunchClassCardProps) {
  const { user } = useAuth();

  // Fetch teacher's meeting link (from Zoom license or profile)
  const { data: meetingInfo, isLoading } = useQuery({
    queryKey: ['teacher-meeting-link', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // First, check if teacher has an active Zoom license assigned
      const { data: activeSessions } = await supabase
        .from('live_sessions')
        .select(`
          id,
          status,
          license:zoom_licenses(id, meeting_link, zoom_email)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'live')
        .limit(1)
        .single();

      if (activeSessions?.license?.meeting_link) {
        return {
          source: 'zoom_license' as const,
          link: activeSessions.license.meeting_link,
          email: activeSessions.license.zoom_email,
        };
      }

      // Check for any available license (for starting a new session)
      const { data: availableLicense } = await supabase
        .from('zoom_licenses')
        .select('id, meeting_link, zoom_email')
        .eq('status', 'available')
        .limit(1)
        .single();

      if (availableLicense?.meeting_link) {
        return {
          source: 'zoom_license' as const,
          link: availableLicense.meeting_link,
          email: availableLicense.zoom_email,
        };
      }

      // Fallback to profile meeting link
      const { data: profile } = await supabase
        .from('profiles')
        .select('meeting_link')
        .eq('id', user.id)
        .single();

      if (profile?.meeting_link) {
        return {
          source: 'profile' as const,
          link: profile.meeting_link,
        };
      }

      return null;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Launch Class
        </CardTitle>
      </CardHeader>
      <CardContent>
        {meetingInfo?.link ? (
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => window.open(meetingInfo.link, '_blank')}
            >
              <Video className="h-5 w-5" />
              Start Class
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
            
            <div className="text-xs text-muted-foreground text-center">
              {meetingInfo.source === 'zoom_license' ? (
                <span>Using assigned Zoom room{meetingInfo.email ? `: ${meetingInfo.email}` : ''}</span>
              ) : (
                <span>Using your personal meeting link</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Settings className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No Meeting Link Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact admin to assign a Zoom room or add your meeting link in your profile.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
