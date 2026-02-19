import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, User, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { TATIndicator } from './TATIndicator';
import { toast } from 'sonner';
import { ParentFeedbackForm } from './ParentFeedbackForm';

interface TicketDetailProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetail({ ticketId, open, onOpenChange }: TicketDetailProps) {
  const { profile, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`*, subcategory:ticket_subcategories(id, name, category)`)
        .eq('id', ticketId)
        .single();
      if (error) throw error;
      // Fetch creator and assignee profiles separately
      const ids = [data.creator_id, data.assignee_id].filter(Boolean);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      return { ...data, creator: pMap[data.creator_id] || null, assignee: pMap[data.assignee_id] || null };
    },
    enabled: open,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Enrich with author names
      const authorIds = [...new Set((data || []).map((c: any) => c.author_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      return (data || []).map((c: any) => ({ ...c, author: pMap[c.author_id] || null }));
    },
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: profile!.id,
        message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const updates: any = { status };
      if (status === 'resolved') updates.resolved_at = new Date().toISOString();
      if (status === 'closed') updates.closed_at = new Date().toISOString();

      const { error } = await supabase.from('tickets').update(updates).eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const isFeedbackTicket = ticket?.category === 'feedback' &&
    ticket?.subcategory?.name === 'Monthly Parent Feedback' &&
    ticket?.assignee_id === profile?.id &&
    ticket?.status !== 'resolved' && ticket?.status !== 'closed';

  if (isLoading || !ticket) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <div className="animate-pulse space-y-4 p-4">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const initials = (name: string) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-4 sm:p-6 space-y-4">
          <SheetHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">TKT-{ticket.ticket_number}</span>
              <span>•</span>
              <span>{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
            </div>
            <SheetTitle className="text-lg">{ticket.subject}</SheetTitle>
          </SheetHeader>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{ticket.category?.replace('_', ' ')}</Badge>
            <Badge variant="outline" className="capitalize">{ticket.priority}</Badge>
            <Badge variant="outline" className="capitalize">{ticket.status?.replace('_', ' ')}</Badge>
            {ticket.subcategory && <Badge variant="secondary">{ticket.subcategory.name}</Badge>}
          </div>

          {/* People + TAT */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">From</span>
              <p className="font-medium">{ticket.creator?.full_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Assigned To</span>
              <p className="font-medium">{ticket.assignee?.full_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">TAT</span>
              <TATIndicator deadline={ticket.tat_deadline} isOverdue={ticket.is_overdue} />
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Due</span>
              <p className="font-medium text-xs">{ticket.due_date ? format(new Date(ticket.due_date), 'MMM d, yyyy') : 'No due date'}</p>
            </div>
          </div>

          {/* Description */}
          {ticket.description && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">{ticket.description}</div>
          )}

          {/* Leave request metadata */}
          {ticket.category === 'leave_request' && ticket.metadata && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium text-success">Leave Details</p>
              {(ticket.metadata as any).start_date && <p>Start: {(ticket.metadata as any).start_date}</p>}
              {(ticket.metadata as any).end_date && <p>End: {(ticket.metadata as any).end_date}</p>}
              {(ticket.metadata as any).leave_type && <p>Type: {(ticket.metadata as any).leave_type}</p>}
            </div>
          )}

          {/* Status Actions */}
          {(ticket.assignee_id === profile?.id || isAdmin) && ticket.status !== 'closed' && (
            <div className="flex gap-2 flex-wrap">
              {ticket.status === 'open' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate('in_progress')}>
                  <Clock className="h-3.5 w-3.5 mr-1" /> Start Work
                </Button>
              )}
              {['open', 'in_progress', 'awaiting_input'].includes(ticket.status) && (
                <Button size="sm" variant="outline" className="text-success" onClick={() => updateStatus.mutate('resolved')}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                </Button>
              )}
              {ticket.status === 'resolved' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate('closed')}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Close
                </Button>
              )}
              {isAdmin && !['escalated'].includes(ticket.status) && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus.mutate('escalated')}>
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Escalate
                </Button>
              )}
            </div>
          )}

          <Separator />

          {/* Parent Feedback Form (special) */}
          {isFeedbackTicket && (
            <ParentFeedbackForm ticketId={ticketId} onSubmitted={() => {
              updateStatus.mutate('resolved');
              queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
            }} />
          )}

          {/* Comments Thread */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">Activity ({comments.length})</h3>
            {comments.map((comment: any) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials(comment.author?.full_name || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{comment.author?.full_name}</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                    {comment.is_internal && <Badge variant="outline" className="text-[10px]">Internal</Badge>}
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.message}</p>
                  {/* Show feedback ratings if present */}
                  {comment.metadata && (comment.metadata as any).type === 'parent_feedback' && (
                    <div className="mt-2 bg-accent/5 border border-accent/20 rounded p-2 text-xs space-y-1">
                      {Object.entries((comment.metadata as any).ratings || {}).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace('_', ' ')}</span>
                          <span>{'★'.repeat(val as number)}{'☆'.repeat(5 - (val as number))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          {ticket.status !== 'closed' && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <Button
                size="icon"
                className="shrink-0 self-end"
                disabled={!newComment.trim() || addComment.isPending}
                onClick={() => addComment.mutate(newComment.trim())}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
