import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Clock, CheckCircle2, XCircle, AlertTriangle, Lock, Loader2, ChevronDown, Paperclip, FileText, Image, ExternalLink } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { TATIndicator } from './TATIndicator';
import { toast } from 'sonner';
import { ParentFeedbackForm } from './ParentFeedbackForm';
import { supabase as sb } from '@/integrations/supabase/client';

interface TicketDetailProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-accent',
  in_progress: 'bg-warning',
  awaiting_input: 'bg-primary',
  resolved: 'bg-success',
  closed: 'bg-muted-foreground',
  escalated: 'bg-destructive',
};

export function TicketDetail({ ticketId, open, onOpenChange }: TicketDetailProps) {
  const { profile, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploading, setUploading] = useState(false);
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
      const authorIds = [...new Set((data || []).map((c: any) => c.author_id))];
      if (authorIds.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      const pMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      return (data || []).map((c: any) => ({ ...c, author: pMap[c.author_id] || null }));
    },
    enabled: open,
    refetchInterval: 15000,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const addComment = useMutation({
    mutationFn: async ({ message, attachment }: { message: string; attachment?: string }) => {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        author_id: profile!.id,
        message,
        attachment_url: attachment || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment('');
      setAttachmentUrl('');
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
      toast.success('Message sent');
    },
    onError: () => toast.error('Failed to send message'),
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

  const handleSend = () => {
    if (newComment.trim() || attachmentUrl) {
      addComment.mutate({ message: newComment.trim() || '📎 Attachment', attachment: attachmentUrl });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await sb.storage.from('ticket-attachments').upload(path, file);
      if (error) throw error;
      const { data: urlData } = sb.storage.from('ticket-attachments').getPublicUrl(path);
      setAttachmentUrl(urlData.publicUrl);
      toast.success('File attached');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const isFeedbackTicket = ticket?.category === 'feedback' &&
    ticket?.subcategory?.name === 'Monthly Parent Feedback' &&
    ticket?.assignee_id === profile?.id &&
    ticket?.status !== 'resolved' && ticket?.status !== 'closed';

  const initials = (name: string) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  if (isLoading || !ticket) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col" aria-describedby={undefined}>
          <div className="animate-pulse space-y-4 p-6">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Group messages by date
  const groupedComments: { date: string; messages: any[] }[] = [];
  comments.forEach((c: any) => {
    const d = new Date(c.created_at);
    const dateStr = format(d, 'MMM d, yyyy');
    const last = groupedComments[groupedComments.length - 1];
    if (last && last.date === dateStr) {
      last.messages.push(c);
    } else {
      groupedComments.push({ date: dateStr, messages: [c] });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col h-full" aria-describedby={undefined}>
        {/* ─── Fixed Header ─── */}
        <div className="border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">TKT-{ticket.ticket_number}</span>
            <Badge variant="outline" className="gap-1.5 text-xs capitalize">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[ticket.status] || 'bg-muted-foreground'}`} />
              {ticket.status?.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{ticket.priority}</Badge>
            <Badge variant="secondary" className="text-xs capitalize">{ticket.category?.replace('_', ' ')}</Badge>
          </div>
          <h2 className="font-semibold text-sm mt-1.5 truncate">{ticket.subject}</h2>
        </div>

        {/* ─── Collapsible Details ─── */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="shrink-0 border-b">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
              <span>Details</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-3 space-y-3">
            {/* People */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {ticket.is_anonymous && !isAdmin ? '?' : initials(ticket.creator?.full_name || '')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] text-muted-foreground">From</p>
                  <p className="text-xs font-medium">
                    {ticket.is_anonymous && !isAdmin
                      ? 'Anonymous'
                      : ticket.creator?.full_name}
                    {ticket.is_anonymous && isAdmin && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">Anon</Badge>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-accent/10 text-accent">{initials(ticket.assignee?.full_name || '')}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] text-muted-foreground">Assigned To</p>
                  <p className="text-xs font-medium">
                    {ticket.assignee?.full_name}
                    {ticket.target_role && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 capitalize bg-primary/5 text-primary border-primary/20">
                        As {ticket.target_role.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* TAT + Due */}
            <div className="flex items-center gap-4 text-xs">
              <TATIndicator deadline={ticket.tat_deadline} isOverdue={ticket.is_overdue} />
              <span className="text-muted-foreground">Due: {ticket.due_date ? format(new Date(ticket.due_date), 'MMM d, yyyy') : '—'}</span>
            </div>

            {/* Description */}
            {ticket.description && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs whitespace-pre-wrap">{ticket.description}</div>
            )}

            {/* Leave metadata */}
            {ticket.category === 'leave_request' && ticket.metadata && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Leave Details</p>
                {(ticket.metadata as any).start_date && <p>Start: {(ticket.metadata as any).start_date}</p>}
                {(ticket.metadata as any).end_date && <p>End: {(ticket.metadata as any).end_date}</p>}
                {(ticket.metadata as any).leave_type && <p>Type: {(ticket.metadata as any).leave_type}</p>}
              </div>
            )}

            {/* Status Actions */}
            {(ticket.assignee_id === profile?.id || isAdmin) && ticket.status !== 'closed' && (
              <div className="flex gap-2 flex-wrap">
                {ticket.status === 'open' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate('in_progress')}>
                    <Clock className="h-3 w-3 mr-1" /> Start Work
                  </Button>
                )}
                {['open', 'in_progress', 'awaiting_input'].includes(ticket.status) && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-600 hover:bg-emerald-50" onClick={() => updateStatus.mutate('resolved')}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                  </Button>
                )}
                {ticket.status === 'resolved' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate('closed')}>
                    <XCircle className="h-3 w-3 mr-1" /> Close
                  </Button>
                )}
                {isAdmin && !['escalated'].includes(ticket.status) && (
                  <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => updateStatus.mutate('escalated')}>
                    <AlertTriangle className="h-3 w-3 mr-1" /> Escalate
                  </Button>
                )}
              </div>
            )}

            {/* Parent Feedback Form */}
            {isFeedbackTicket && (
              <ParentFeedbackForm ticketId={ticketId} onSubmitted={() => {
                updateStatus.mutate('resolved');
                queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticketId] });
              }} />
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ─── Scrollable Messages ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Start the conversation below.</p>
          )}
          {groupedComments.map(group => (
            <div key={group.date} className="space-y-2">
              {/* Date pill */}
              <div className="flex justify-center">
                <span className="text-[10px] bg-muted px-3 py-0.5 rounded-full text-muted-foreground">{group.date}</span>
              </div>
              {group.messages.map((comment: any) => {
                const isMe = comment.author_id === profile?.id;
                return (
                  <div key={comment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`px-3 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-accent text-accent-foreground rounded-tr-sm'
                          : 'bg-card border border-border rounded-tl-sm'
                      }`}>
                        {comment.is_internal && (
                          <span className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                            <Lock className="h-2.5 w-2.5" /> Internal Note
                          </span>
                        )}
                        <p className="whitespace-pre-wrap">{comment.message}</p>
                        {/* Attachment */}
                        {comment.attachment_url && (() => {
                          const url = comment.attachment_url;
                          const isImg = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
                          return (
                            <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:underline">
                              {isImg ? <Image className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                              View Attachment <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          );
                        })()}
                        {/* Feedback ratings */}
                        {comment.metadata && (comment.metadata as any).type === 'parent_feedback' && (
                          <div className="mt-2 bg-background/50 rounded p-2 text-xs space-y-1">
                            {Object.entries((comment.metadata as any).ratings || {}).map(([key, val]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key.replace('_', ' ')}</span>
                                <span>{'★'.repeat(val as number)}{'☆'.repeat(5 - (val as number))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {isMe ? 'You' : (ticket.is_anonymous && comment.author_id === ticket.creator_id && !isAdmin)
                            ? 'Anonymous'
                            : comment.author?.full_name || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(comment.created_at), 'HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── Compose Bar ─── */}
        <div className="border-t px-4 py-3 shrink-0">
          {ticket.status === 'closed' ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Lock className="h-4 w-4" />
              <span>This ticket is closed.</span>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <Avatar className="h-7 w-7 shrink-0 mb-0.5">
                <AvatarFallback className="text-[10px] bg-accent/10 text-accent">
                  {initials(profile?.full_name || '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 relative">
                <Textarea
                  placeholder="Type a message..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[40px] max-h-[120px] text-sm pr-10 resize-y"
                  rows={1}
                />
                <Button
                  size="icon"
                  className={`absolute right-1.5 bottom-1.5 h-7 w-7 rounded-full transition-colors ${
                    newComment.trim() ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-muted text-muted-foreground'
                  }`}
                  disabled={!newComment.trim() || addComment.isPending}
                  onClick={handleSend}
                >
                  {addComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
