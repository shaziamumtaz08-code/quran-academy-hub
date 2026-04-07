import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Send, Plus, Loader2, Bell, MessageSquare, Smartphone, Upload,
  Users, Clock, Paperclip, ExternalLink, Copy
} from 'lucide-react';

interface CourseNotificationsTabProps {
  courseId: string;
  courseName?: string;
  whatsappChannelLink?: string | null;
}

export function CourseNotificationsTab({ courseId, courseName, whatsappChannelLink }: CourseNotificationsTabProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [channels, setChannels] = useState<Set<string>>(new Set(['lms']));
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['course-notifications', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_notifications')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrolledCount = 0 } = useQuery({
    queryKey: ['course-enrolled-count-notif', courseId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('status', 'active');
      if (error) throw error;
      return count || 0;
    },
  });

  const toggleChannel = (ch: string) => {
    setChannels(prev => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch); else next.add(ch);
      return next;
    });
  };

  const sendNotification = useMutation({
    mutationFn: async () => {
      let finalAttachment = attachmentUrl;
      const file = fileRef.current?.files?.[0];
      if (file) {
        const path = `${courseId}/notifications/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('course-materials').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(path);
        finalAttachment = urlData.publicUrl;
      }

      const channelArr = Array.from(channels);

      // Log the notification
      const { error } = await supabase.from('course_notifications').insert({
        course_id: courseId,
        title: title.trim(),
        body: body.trim(),
        attachment_url: finalAttachment || null,
        channels: channelArr,
        sent_by: user?.id || null,
        recipient_count: enrolledCount,
      });
      if (error) throw error;

      // Send LMS in-app notifications to enrolled students
      if (channelArr.includes('lms')) {
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .eq('course_id', courseId)
          .eq('status', 'active');

        if (enrollments && enrollments.length > 0) {
          const notifRows = enrollments.map((e: any) => ({
            recipient_id: e.student_id,
            type: 'course_notification',
            title: title.trim(),
            body: body.trim(),
            metadata: { course_id: courseId, course_name: courseName },
            status: 'pending',
          }));
          await supabase.from('notification_queue').insert(notifRows);
        }
      }

      // Post to group chat if selected
      if (channelArr.includes('chat')) {
        const { data: chatGroup } = await supabase
          .from('chat_groups')
          .select('id')
          .eq('course_id', courseId)
          .maybeSingle();

        if (chatGroup) {
          await supabase.from('chat_messages').insert({
            group_id: chatGroup.id,
            sender_id: user?.id || '',
            content: `📢 **${title.trim()}**\n\n${body.trim()}${finalAttachment ? `\n\n📎 [Attachment](${finalAttachment})` : ''}`,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-notifications', courseId] });
      setComposeOpen(false);
      setTitle(''); setBody(''); setAttachmentUrl('');
      setChannels(new Set(['lms']));
      toast({ title: `Notification sent to ${enrolledCount} student(s)` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const channelOptions = [
    { key: 'lms', label: 'LMS In-App', icon: Bell, desc: 'Sends to enrolled students' },
    { key: 'whatsapp', label: 'WhatsApp Broadcast', icon: Smartphone, desc: 'Sends via WhatsApp' },
    { key: 'chat', label: 'Group Chat Post', icon: MessageSquare, desc: 'Posts in course group' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> Notifications
          </h3>
          <p className="text-[11px] text-muted-foreground">{enrolledCount} enrolled student(s)</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setComposeOpen(true)}>
          <Send className="h-4 w-4" /> Send Notification
        </Button>
      </div>

      {/* WA Channel Link */}
      {whatsappChannelLink && (
        <Card className="border-emerald-200 bg-emerald-500/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium">WhatsApp Channel</span>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => { navigator.clipboard.writeText(whatsappChannelLink); toast({ title: 'Link copied!' }); }}>
                <Copy className="h-3 w-3" /> Copy Link
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <a href={whatsappChannelLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sent History */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No notifications sent yet.
        </CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Body</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-sm font-medium">{n.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{n.body}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(n.channels || []).map((ch: string) => (
                          <Badge key={ch} variant="outline" className="text-[10px]">{ch}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{n.recipient_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'MMM d, h:mm a')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>Compose and send to enrolled students via selected channels</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body *</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Notification message…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attachment (optional)</Label>
              <Input ref={fileRef} type="file" className="cursor-pointer" />
              <Input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="Or paste URL…" className="mt-1" />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs font-medium">Channels</Label>
              {channelOptions.map(ch => (
                <label key={ch.key} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={channels.has(ch.key)} onCheckedChange={() => toggleChannel(ch.key)} />
                  <ch.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{ch.label}</p>
                    <p className="text-[10px] text-muted-foreground">{ch.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={() => sendNotification.mutate()}
              disabled={!title.trim() || !body.trim() || channels.size === 0 || sendNotification.isPending}>
              {sendNotification.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending…</> : <><Send className="h-4 w-4 mr-1" /> Send</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
