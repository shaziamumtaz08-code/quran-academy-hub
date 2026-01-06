import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface JoinClassButtonProps {
  teacherId?: string;
}

export function JoinClassButton({ teacherId }: JoinClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch live session for the student's assigned teacher
  const { data: liveSession, isLoading } = useQuery({
    queryKey: ['student-live-session', user?.id, teacherId],
    queryFn: async () => {
      if (!user?.id) return null;

      // If teacherId is provided, use it directly
      let targetTeacherId = teacherId;

      // Otherwise, find the student's assigned teacher
      if (!targetTeacherId) {
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('teacher_id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        targetTeacherId = assignment?.teacher_id;
      }

      if (!targetTeacherId) return null;

      // Check if teacher has a live session
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          status,
          teacher_id,
          license:zoom_licenses(meeting_link)
        `)
        .eq('teacher_id', targetTeacherId)
        .eq('status', 'live')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Check every 10 seconds for live status
  });

  // Log join intent mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !liveSession?.id) throw new Error('No live session');

      // Log join intent
      const { error } = await supabase
        .from('zoom_attendance_logs')
        .insert({
          session_id: liveSession.id,
          user_id: user.id,
          action: 'join_intent',
        });

      if (error) throw error;

      return (liveSession.license as any)?.meeting_link;
    },
    onSuccess: (meetingLink) => {
      if (meetingLink) {
        toast({
          title: 'Joining Class',
          description: 'Opening Zoom meeting...',
        });
        window.open(meetingLink, '_blank');
      } else {
        toast({
          title: 'Error',
          description: 'Meeting link not available',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Join',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Button disabled className="gap-2" variant="outline">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking...
      </Button>
    );
  }

  // No live session - show disabled button
  if (!liveSession || liveSession.status !== 'live') {
    return (
      <Button disabled variant="outline" className="gap-2 opacity-60">
        <Video className="h-4 w-4" />
        Class Not Live
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      className="gap-2 bg-emerald-600 hover:bg-emerald-700 animate-pulse"
      onClick={() => joinMutation.mutate()}
      disabled={joinMutation.isPending}
    >
      {joinMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Video className="h-4 w-4" />
      )}
      Join Live Class
    </Button>
  );
}
