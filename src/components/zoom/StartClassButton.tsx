import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface StartClassButtonProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string, meetingLink: string) => void;
}

export function StartClassButton({ sessionId, onSessionCreated }: StartClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);

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
          license:zoom_licenses(meeting_link, zoom_email)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'live')
        .maybeSingle();

      if (error) throw error;
      return data;
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
        const { data: newSession, error: sessionError } = await supabase
          .from('live_sessions')
          .insert({
            teacher_id: user.id,
            status: 'scheduled',
            scheduled_start: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (sessionError) throw sessionError;
        sessionToUse = newSession.id;
        setCurrentSessionId(newSession.id);
      }

      // Reserve Zoom license
      const { data, error } = await supabase.rpc('get_and_reserve_license', {
        _teacher_id: user.id,
        _session_id: sessionToUse,
      });

      if (error) {
        if (error.message.includes('All Zoom rooms are currently occupied')) {
          throw new Error('All Zoom rooms are currently occupied. Please try again in a few minutes.');
        }
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No license data returned');
      }

      return { 
        sessionId: sessionToUse, 
        meetingLink: data[0].meeting_link,
        licenseId: data[0].license_id 
      };
    },
    onSuccess: (result) => {
      toast({
        title: '✅ Class Started',
        description: 'Opening Zoom meeting...',
      });
      
      window.open(result.meetingLink, '_blank');
      
      queryClient.invalidateQueries({ queryKey: ['active-session'] });
      queryClient.invalidateQueries({ queryKey: ['live-sessions'] });
      
      onSessionCreated?.(result.sessionId, result.meetingLink);
    },
    onError: (error: Error) => {
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
      <Button disabled className="gap-2">
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
          className="gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
          onClick={() => {
            const link = (activeSession.license as any)?.meeting_link;
            if (link) window.open(link, '_blank');
          }}
        >
          <Video className="h-4 w-4" />
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
      </div>
    );
  }

  return (
    <Button
      variant="default"
      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
      onClick={() => startClassMutation.mutate()}
      disabled={startClassMutation.isPending}
    >
      {startClassMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Video className="h-4 w-4" />
      )}
      Start Class
    </Button>
  );
}