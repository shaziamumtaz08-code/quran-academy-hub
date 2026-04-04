import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Send, Clock, User, MessageSquare, ArrowRight } from 'lucide-react';

const priorityColors: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  medium: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400',
  low: 'bg-muted text-muted-foreground border-border',
};

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: any;
}

export function TaskDetailDialog({ open, onOpenChange, task }: TaskDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [assignSearch, setAssignSearch] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', task?.id],
    queryFn: async () => {
      if (!task?.id) return [];
      const { data } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      const ids = [...new Set((data || []).map(c => c.user_id))];
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(c => ({ ...c, userName: nameMap[c.user_id] || 'Unknown' }));
    },
    enabled: !!task?.id && open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users-for-assign'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name').limit(200);
      return data || [];
    },
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user?.id || !task?.id || !newComment.trim()) return;
      const { error } = await supabase.from('task_comments').insert({
        task_id: task.id,
        user_id: user.id,
        comment: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', task?.id] });
      setNewComment('');
    },
  });

  const updateTask = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workhub-tasks'] });
      toast({ title: 'Task updated' });
    },
  });

  if (!task) return null;

  const filteredUsers = users.filter((u: any) =>
    u.full_name?.toLowerCase().includes(assignSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {task.title}
            <Badge className={`text-[9px] px-1.5 py-0 h-4 border capitalize ${priorityColors[task.priority] || priorityColors.medium}`}>
              {task.priority}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Meta */}
          {task.description && (
            <p className="text-xs text-muted-foreground">{task.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px]">Status</Label>
              <Select value={task.status} onValueChange={v => updateTask.mutate({ status: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Priority</Label>
              <Select value={task.priority} onValueChange={v => updateTask.mutate({ priority: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reassign */}
          <div>
            <Label className="text-[10px]">Assigned To</Label>
            <Input
              placeholder="Search user..."
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              className="h-8 text-xs mb-1"
            />
            {assignSearch && (
              <div className="max-h-28 overflow-y-auto border rounded-md">
                {filteredUsers.slice(0, 8).map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      updateTask.mutate({ assigned_to: u.id });
                      setAssignSearch('');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary flex items-center gap-2"
                  >
                    <User className="h-3 w-3 text-muted-foreground" />
                    {u.full_name}
                    {u.id === task.assigned_to && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">Current</Badge>}
                  </button>
                ))}
              </div>
            )}
            {!assignSearch && task.assigneeName && (
              <p className="text-xs text-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> {task.assigneeName}
              </p>
            )}
          </div>

          {/* Source indicator */}
          {task.source_type === 'chat' && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
              <MessageSquare className="h-3 w-3" /> Created from chat message
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Comments ({comments.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {comments.map((c: any) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {c.userName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-foreground">{c.userName}</span>
                      <span className="text-[9px] text-muted-foreground">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-xs text-foreground/80">{c.comment}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-3">No comments yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Add comment */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="text-xs h-8"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addComment.mutate();
              }
            }}
          />
          <Button size="sm" className="h-8" onClick={() => addComment.mutate()} disabled={!newComment.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
