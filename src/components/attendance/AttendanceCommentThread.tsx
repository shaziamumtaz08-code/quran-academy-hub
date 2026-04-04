import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface Props {
  attendanceId: string;
  compact?: boolean;
}

export function AttendanceCommentThread({ attendanceId, compact = false }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [expanded, setExpanded] = useState(!compact);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['attendance-comments', attendanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_comments')
        .select('id, comment, created_at, user_id')
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch profile names
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(c => ({ ...c, userName: nameMap[c.user_id] || 'Unknown' }));
    },
    enabled: !!attendanceId,
  });

  const addComment = useMutation({
    mutationFn: async (comment: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('attendance_comments').insert({
        attendance_id: attendanceId,
        user_id: user.id,
        comment,
      });
      if (error) throw error;

      // Send notification to teacher/student
      const { data: att } = await supabase
        .from('attendance')
        .select('teacher_id, student_id')
        .eq('id', attendanceId)
        .single();
      if (att) {
        const recipientId = att.teacher_id === user.id ? att.student_id : att.teacher_id;
        await supabase.from('notification_queue').insert({
          recipient_id: recipientId,
          title: 'New Attendance Comment',
          message: comment.slice(0, 100),
          notification_type: 'attendance_comment',
          status: 'pending',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-comments', attendanceId] });
      setNewComment('');
      toast({ title: 'Comment added' });
    },
    onError: () => toast({ title: 'Failed to add comment', variant: 'destructive' }),
  });

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline"
      >
        <MessageCircle className="h-3 w-3" />
        {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Add comment'}
      </button>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {compact && (
        <button onClick={() => setExpanded(false)} className="text-[10px] text-muted-foreground hover:underline">
          Hide comments
        </button>
      )}

      {/* Thread */}
      {comments.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {comments.map((c: any) => (
            <div key={c.id} className={`flex gap-2 ${c.user_id === user?.id ? 'flex-row-reverse' : ''}`}>
              <div className={`rounded-xl px-3 py-1.5 max-w-[80%] ${
                c.user_id === user?.id
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-muted border border-border'
              }`}>
                <p className="text-[10px] font-bold text-muted-foreground">{c.userName}</p>
                <p className="text-xs text-foreground">{c.comment}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {format(new Date(c.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5">
        <Textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[36px] h-9 text-xs resize-none py-2"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && newComment.trim()) {
              e.preventDefault();
              addComment.mutate(newComment.trim());
            }
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!newComment.trim() || addComment.isPending}
          onClick={() => addComment.mutate(newComment.trim())}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
