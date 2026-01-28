import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, UserMinus } from 'lucide-react';
import React from 'react';

interface ZoomAttendanceLog {
  id: string;
  user_id: string;
  session_id: string;
  action: 'join_intent' | 'leave';
  timestamp: string;
  join_time: string | null;
  leave_time: string | null;
  total_duration_minutes: number | null;
}

interface RealtimeEvent {
  id: string;
  userId: string;
  userName: string;
  action: 'join' | 'leave';
  timestamp: Date;
  sessionId: string;
}

interface UseZoomRealtimeEventsOptions {
  onEvent?: (event: RealtimeEvent) => void;
  showToasts?: boolean;
}

export function useZoomRealtimeEvents(options: UseZoomRealtimeEventsOptions = {}) {
  const { onEvent, showToasts = true } = options;
  const queryClient = useQueryClient();
  const userCacheRef = useRef<Map<string, string>>(new Map());
  const recentEventsRef = useRef<RealtimeEvent[]>([]);

  // Fetch user name with caching
  const getUserName = useCallback(async (userId: string): Promise<string> => {
    if (userCacheRef.current.has(userId)) {
      return userCacheRef.current.get(userId)!;
    }

    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const name = data?.full_name || 'Unknown User';
    userCacheRef.current.set(userId, name);
    return name;
  }, []);

  // Handle new realtime event
  const handleRealtimeEvent = useCallback(async (payload: {
    new: ZoomAttendanceLog;
    eventType: 'INSERT' | 'UPDATE';
  }) => {
    const log = payload.new;
    const action = log.action === 'join_intent' ? 'join' : 'leave';
    
    // Fetch user name
    const userName = await getUserName(log.user_id);

    const event: RealtimeEvent = {
      id: log.id,
      userId: log.user_id,
      userName,
      action,
      timestamp: new Date(log.timestamp),
      sessionId: log.session_id,
    };

    // Store in recent events (keep last 20)
    recentEventsRef.current = [event, ...recentEventsRef.current].slice(0, 20);

    // Call custom handler
    onEvent?.(event);

    // Show toast notification
    if (showToasts) {
      const isJoin = action === 'join';
      toast(
        React.createElement('div', { className: 'flex items-center gap-3' },
          React.createElement('div', { 
            className: `w-8 h-8 rounded-full flex items-center justify-center ${isJoin ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}` 
          },
            isJoin 
              ? React.createElement(UserPlus, { className: 'h-4 w-4 text-emerald-600 dark:text-emerald-400' })
              : React.createElement(UserMinus, { className: 'h-4 w-4 text-amber-600 dark:text-amber-400' })
          ),
          React.createElement('div', {},
            React.createElement('p', { className: 'font-medium text-sm' }, userName),
            React.createElement('p', { className: 'text-xs text-muted-foreground' },
              isJoin ? 'Joined a live session' : 'Left the session'
            )
          )
        ),
        {
          duration: 4000,
          position: 'bottom-right',
        }
      );
    }

    // Invalidate related queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['active-live-sessions-monitor'] });
    queryClient.invalidateQueries({ queryKey: ['recent-join-logs-monitor'] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance-logs'] });
  }, [getUserName, onEvent, showToasts, queryClient]);

  useEffect(() => {
    // Subscribe to realtime changes on zoom_attendance_logs
    const channel = supabase
      .channel('zoom-attendance-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zoom_attendance_logs',
        },
        (payload) => {
          handleRealtimeEvent({
            new: payload.new as ZoomAttendanceLog,
            eventType: 'INSERT',
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'zoom_attendance_logs',
        },
        (payload) => {
          // Only handle leave events (when leave_time is set)
          const newLog = payload.new as ZoomAttendanceLog;
          if (newLog.leave_time && !((payload.old as any)?.leave_time)) {
            handleRealtimeEvent({
              new: newLog,
              eventType: 'UPDATE',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeEvent]);

  return {
    recentEvents: recentEventsRef.current,
  };
}
