import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Video, ExternalLink, Loader2, PhoneOff, Settings, Link2, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LaunchClassCardProps {
  className?: string;
}

/**
 * Upsert attendance records for all students scheduled with this teacher today.
 */
async function markAttendanceForTodaysStudents(teacherId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = dayNames[new Date().getDay()];

  const { data: assignments } = await supabase
    .from('student_teacher_assignments')
    .select('id, student_id, duration_minutes, division_id, branch_id')
    .eq('teacher_id', teacherId)
    .eq('status', 'active');

  if (!assignments?.length) return;

  const assignmentIds = assignments.map(a => a.id);
  const { data: schedules } = await supabase
    .from('schedules')
    .select('assignment_id, teacher_local_time, duration_minutes, division_id, branch_id, course_id')
    .in('assignment_id', assignmentIds)
    .eq('day_of_week', todayDay)
    .eq('is_active', true);

  if (!schedules?.length) return;

  const assignmentMap = new Map(assignments.map(a => [a.id, a]));
  const now = new Date().toISOString();

  for (const schedule of schedules) {
    const assignment = assignmentMap.get(schedule.assignment_id!);
    if (!assignment) continue;

    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', assignment.student_id)
      .eq('teacher_id', teacherId)
      .eq('class_date', today)
      .eq('class_time', schedule.teacher_local_time || '00:00')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('attendance')
        .update({ teacher_join_time: now } as any)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('attendance')
        .insert({
          student_id: assignment.student_id,
          teacher_id: teacherId,
          class_date: today,
          class_time: schedule.teacher_local_time || '00:00',
          status: 'present',
          duration_minutes: schedule.duration_minutes || assignment.duration_minutes,
          division_id: schedule.division_id || assignment.division_id,
          branch_id: schedule.branch_id || assignment.branch_id,
          course_id: schedule.course_id,
          teacher_join_time: now,
        } as any);
    }
  }
}

export function LaunchClassCard({ className }: LaunchClassCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [personalLink, setPersonalLink] = useState('');

  // Check for active session
  const { data: activeSession, isLoading: checkingSession } = useQuery({
    queryKey: ['teacher-active-session', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          status,
          actual_start,
          license:zoom_licenses(id, meeting_link, zoom_email)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Check for available licenses or profile link
  const { data: fallbackLink } = useQuery({
    queryKey: ['teacher-fallback-link', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Check profile for personal meeting link
      const { data: profile } = await supabase
        .from('profiles')
        .select('meeting_link')
        .eq('id', user.id)
        .single();

      if (profile?.meeting_link) {
        return { source: 'profile' as const, link: profile.meeting_link };
      }

      // Check if any licenses exist in the pool
      const { count } = await supabase
        .from('zoom_licenses')
        .select('*', { count: 'exact', head: true });

      return { source: 'pool' as const, hasPool: (count || 0) > 0 };
    },
    enabled: !!user?.id && !activeSession,
  });

  // Start class mutation
  const startClassMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Create a new session
      const { data: session, error: sessionError } = await supabase
        .from('live_sessions')
        .insert([{
          teacher_id: user.id,
          status: 'scheduled' as const,
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Try to get a license from the pool
      const { data: licenseData, error: licenseError } = await supabase
        .rpc('get_and_reserve_license', {
          _teacher_id: user.id,
          _session_id: session.id,
        });

      if (licenseError) {
        // Clean up the pending session
        await supabase.from('live_sessions').delete().eq('id', session.id);
        throw licenseError;
      }

      // ✅ ATTENDANCE AUTOMATION: Mark all today's students as present
      await markAttendanceForTodaysStudents(user.id);

      return { session, license: licenseData[0] };
    },
    onSuccess: (data) => {
      if (data.license?.meeting_link) {
        window.open(data.license.meeting_link, '_blank');
        toast.success('✅ Class started & attendance marked! Zoom room opened.');
      }
      queryClient.invalidateQueries({ queryKey: ['teacher-active-session'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('All Zoom rooms are currently occupied')) {
        toast.error('All Zoom rooms are busy. Try again later or use your personal link.');
      } else {
        toast.error(error.message || 'Failed to start class');
      }
    },
  });

  // End class mutation
  const endClassMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !activeSession?.id) throw new Error('No active session');

      const { data, error } = await supabase.rpc('release_license', {
        _session_id: activeSession.id,
        _teacher_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Class ended. Zoom room released.');
      queryClient.invalidateQueries({ queryKey: ['teacher-active-session'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to end class');
    },
  });

  // Save personal link mutation
  const savePersonalLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ meeting_link: link })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meeting link saved!');
      setShowLinkInput(false);
      setPersonalLink('');
      queryClient.invalidateQueries({ queryKey: ['teacher-fallback-link'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save link');
    },
  });

  if (checkingSession) {
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

  // Active session - show rejoin/end buttons
  if (activeSession) {
    const sessionDuration = activeSession.actual_start
      ? Math.floor((Date.now() - new Date(activeSession.actual_start).getTime()) / 60000)
      : 0;

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Video className="h-5 w-5 text-emerald-500 animate-pulse" />
            Class In Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground text-center">
            {sessionDuration > 0 && <span>Running for {sessionDuration} min</span>}
            {activeSession.license?.zoom_email && (
              <div className="text-xs mt-1">Room: {activeSession.license.zoom_email}</div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => {
                if (activeSession.license?.meeting_link) {
                  window.open(activeSession.license.meeting_link, '_blank');
                }
              }}
              disabled={!activeSession.license?.meeting_link}
            >
              <Video className="h-4 w-4" />
              Rejoin
            </Button>

            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={() => endClassMutation.mutate()}
              disabled={endClassMutation.isPending}
            >
              {endClassMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              End Class
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active session - show start options
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          Launch Class
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Start Class with Pool */}
        {fallbackLink?.source === 'pool' && fallbackLink.hasPool && (
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => startClassMutation.mutate()}
            disabled={startClassMutation.isPending}
          >
            {startClassMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Video className="h-5 w-5" />
            )}
            Start Class
            <ExternalLink className="h-4 w-4 ml-auto" />
          </Button>
        )}

        {/* Personal Link Available */}
        {fallbackLink?.source === 'profile' && fallbackLink.link && (
          <div className="space-y-2">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={async () => {
                if (user?.id) await markAttendanceForTodaysStudents(user.id);
                window.open(fallbackLink.link, '_blank');
                toast.success('✅ Class started & attendance marked!');
                queryClient.invalidateQueries({ queryKey: ['attendance'] });
              }}
            >
              <Video className="h-5 w-5" />
              Start Class
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Using your personal meeting link
            </p>
          </div>
        )}

        {/* No Pool and No Personal Link */}
        {(!fallbackLink?.hasPool && fallbackLink?.source !== 'profile') && (
          <div className="text-center space-y-3">
            {!showLinkInput ? (
              <>
                <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                  <Settings className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">No Zoom Room Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact admin to set up Zoom rooms, or add your personal link
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowLinkInput(true)}
                >
                  <Link2 className="h-4 w-4" />
                  Add My Meeting Link
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="https://zoom.us/j/..."
                  value={personalLink}
                  onChange={(e) => setPersonalLink(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowLinkInput(false);
                      setPersonalLink('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => savePersonalLinkMutation.mutate(personalLink)}
                    disabled={!personalLink || savePersonalLinkMutation.isPending}
                  >
                    {savePersonalLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
