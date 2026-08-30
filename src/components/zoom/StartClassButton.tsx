import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { reserveTab, closeTab } from '@/lib/popupWindow';
import { useInAppZoomJoin } from '@/hooks/useInAppZoomJoin';

interface StartClassButtonProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string, meetingLink: string) => void;
  className?: string;
}

export function StartClassButton({ sessionId, onSessionCreated, className }: StartClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const startTabRef = useRef<Window | null>(null);
  const [rejoining, setRejoining] = useState(false);
  const { join: joinClass, dialog: zoomDialog } = useInAppZoomJoin(1);

  // Check if teacher has an active live session
  const { data: activeSession, isLoading: checkingSession } = useQuery({
    queryKey: ['active-session', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          status,
          actual_start,
          student_id,
          assignment_id,
          schedule_id,
          scheduled_start,
          license:zoom_licenses(meeting_link, zoom_email)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Start class mutation — ONLY creates session + reserves license
  const startClassMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      let sessionToUse = currentSessionId;
      
      if (!sessionToUse) {
        // Look up today's schedule slot for this teacher (±15 min window in PKT)
        const now = new Date();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const pktOffset = 5 * 60; // PKT = UTC+5
        const pktNow = new Date(now.getTime() + pktOffset * 60000);
        const todayDay = dayNames[pktNow.getUTCDay()];
        const pktHours = pktNow.getUTCHours();
        const pktMinutes = pktNow.getUTCMinutes();
        const currentMinutes = pktHours * 60 + pktMinutes;
        
        // Find matching schedule within ±15 min
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id, assignment_id, teacher_local_time, duration_minutes')
          .eq('is_active', true)
          .eq('day_of_week', todayDay);
        
        // Filter schedules belonging to this teacher via assignment
        let matchedSchedule: { id: string; assignment_id: string; student_id?: string } | null = null;
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select('id, student_id')
          .eq('teacher_id', user.id)
          .eq('status', 'active');
        const assignmentMap = new Map((assignments || []).map(a => [a.id, a.student_id]));
        
        if (schedules && schedules.length > 0) {
          for (const sch of schedules) {
            if (!assignmentMap.has(sch.assignment_id)) continue;
            const [h, m] = (sch.teacher_local_time || '00:00').split(':').map(Number);
            const schMinutes = h * 60 + m;
            if (Math.abs(schMinutes - currentMinutes) <= 15) {
              matchedSchedule = { id: sch.id, assignment_id: sch.assignment_id, student_id: assignmentMap.get(sch.assignment_id) || undefined };
              break;
            }
          }
        }

        // Check if a session already exists (e.g. student joined early via zoom-claim-session)
        const existingQuery = supabase
          .from('live_sessions')
          .select('id')
          .eq('teacher_id', user.id)
          .in('status', ['scheduled', 'live'])
          .order('created_at', { ascending: false })
          .limit(1);

        const { data: existingSession } = matchedSchedule
          ? await existingQuery.eq('assignment_id', matchedSchedule.assignment_id)
          : await existingQuery;

        if (existingSession && existingSession.length > 0) {
          sessionToUse = existingSession[0].id;
          setCurrentSessionId(sessionToUse);
        } else {
          const insertPayload: any = {
            teacher_id: user.id,
            status: 'scheduled',
            scheduled_start: new Date().toISOString(),
          };
          if (matchedSchedule) {
            insertPayload.schedule_id = matchedSchedule.id;
            insertPayload.assignment_id = matchedSchedule.assignment_id;
            insertPayload.student_id = matchedSchedule.student_id || null;
          }

          const { data: newSession, error: sessionError } = await supabase
            .from('live_sessions')
            .insert(insertPayload)
            .select('id')
            .single();

          if (sessionError) throw sessionError;
          sessionToUse = newSession.id;
          setCurrentSessionId(newSession.id);
        }
      }

      // The join itself (in-app Meeting SDK when the hosting Zoom account has
      // SDK credentials, external Zoom tab otherwise) is handled centrally.
      const opened = await joinClass(
        {
          teacherId: user.id,
          studentId: null,
          assignmentId: null,
          scheduleId: null,
          scheduledStart: new Date().toISOString(),
          liveSessionId: sessionToUse,
        },
        'Your class',
        startTabRef.current,
      );

      return { sessionId: sessionToUse as string, opened };
    },
    onSuccess: (result) => {
      if (result.opened) {
        toast({
          title: '✅ Class Started',
          description: 'Opening the class…',
        });
      }
      startTabRef.current = null;

      queryClient.invalidateQueries({ queryKey: ['active-session'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });

      onSessionCreated?.(result.sessionId, '');
    },
    onError: (error: Error) => {
      closeTab(startTabRef.current);
      startTabRef.current = null;
      toast({
        title: 'Failed to Start Class',
        description: error.message,
        variant: 'destructive',
      });
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
      toast({
        title: 'Class Ended',
        description: 'The Zoom room has been released.',
      });
      setCurrentSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to End Class',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (checkingSession) {
    return (
      <Button disabled className={cn("gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking...
      </Button>
    );
  }

  if (activeSession) {
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          className={cn("gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50", className)}
          disabled={rejoining}
          onClick={async () => {
            // Reserve the tab inside the click gesture so the popup blocker
            // does not kill it after the edge-function round trip.
            const tab = reserveTab();
            setRejoining(true);
            try {
              await joinClass(
                {
                  teacherId: user?.id as string,
                  studentId: (activeSession as any).student_id || null,
                  assignmentId: (activeSession as any).assignment_id || null,
                  scheduleId: (activeSession as any).schedule_id || null,
                  scheduledStart: (activeSession as any).scheduled_start || new Date().toISOString(),
                  liveSessionId: activeSession.id,
                },
                'Your class',
                tab,
              );
            } finally {
              setRejoining(false);
            }
          }}
        >
          {rejoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
          Rejoin Class
        </Button>
        <Button
          variant="destructive"
          className="gap-2"
          onClick={() => endClassMutation.mutate()}
          disabled={endClassMutation.isPending}
        >
          {endClassMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
          End Class
        </Button>
        {zoomDialog}
      </div>
    );
  }

  return (
    <>
    <Button
      variant="default"
      className={cn("gap-2 bg-emerald-600 hover:bg-emerald-700", className)}
      onClick={() => {
        startTabRef.current = reserveTab();
        startClassMutation.mutate();
      }}
      disabled={startClassMutation.isPending}
    >
      {startClassMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Video className="h-4 w-4" />
      )}
      Start Class
    </Button>
    {zoomDialog}
    </>
  );
}