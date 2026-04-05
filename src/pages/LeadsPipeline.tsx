import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Phone, Mail, MapPin, Clock, User, Calendar,
  MessageSquare, ArrowRight, X as XIcon, ChevronRight, Eye,
  UserPlus, Send, Star, ThumbsUp, ThumbsDown, Minus, GripVertical,
  Filter, RefreshCw, MoreVertical
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'bg-blue-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { key: 'demo_scheduled', label: 'Demo', color: 'bg-purple-500' },
  { key: 'demo_done', label: 'Demo Done', color: 'bg-indigo-500' },
  { key: 'feedback_pending', label: 'Feedback', color: 'bg-orange-500' },
  { key: 'ready_to_enroll', label: 'Ready', color: 'bg-emerald-500' },
  { key: 'enrollment_form_sent', label: 'Form Sent', color: 'bg-teal-500' },
  { key: 'form_submitted', label: 'Submitted', color: 'bg-cyan-500' },
  { key: 'enrolled', label: 'Enrolled', color: 'bg-green-600' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' },
] as const;

type LeadStatus = typeof PIPELINE_STAGES[number]['key'];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone_whatsapp: string | null;
  country: string | null;
  city: string | null;
  for_whom: string;
  child_name: string | null;
  child_age: number | null;
  subject_interest: string | null;
  preferred_time: string | null;
  message: string | null;
  status: LeadStatus;
  match_status: string | null;
  assigned_to: string | null;
  notes: any[];
  lost_reason: string | null;
  source_url: string | null;
  enrollment_form_token: string | null;
  enrollment_form_sent_at: string | null;
  enrollment_form_opened_at: string | null;
  enrollment_form_data: any | null;
  created_at: string;
  updated_at: string;
}

// ── Create Lead Dialog ──
function CreateLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '', email: '', phone_whatsapp: '', country: '', city: '',
    for_whom: 'self', child_name: '', child_age: '',
    subject_interest: '', preferred_time: '', message: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').insert({
        name: form.name,
        email: form.email || null,
        phone_whatsapp: form.phone_whatsapp || null,
        country: form.country || null,
        city: form.city || null,
        for_whom: form.for_whom,
        child_name: form.for_whom === 'child' ? form.child_name || null : null,
        child_age: form.for_whom === 'child' && form.child_age ? parseInt(form.child_age) : null,
        subject_interest: form.subject_interest || null,
        preferred_time: form.preferred_time || null,
        message: form.message || null,
        status: 'new',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Lead created successfully' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onOpenChange(false);
      setForm({ name: '', email: '', phone_whatsapp: '', country: '', city: '', for_whom: 'self', child_name: '', child_age: '', subject_interest: '', preferred_time: '', message: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">WhatsApp</Label><Input value={form.phone_whatsapp} onChange={e => setForm(p => ({ ...p, phone_whatsapp: e.target.value }))} placeholder="+92..." /></div>
            <div><Label className="text-xs">For Whom</Label>
              <Select value={form.for_whom} onValueChange={v => setForm(p => ({ ...p, for_whom: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.for_whom === 'child' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Child Name</Label><Input value={form.child_name} onChange={e => setForm(p => ({ ...p, child_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Child Age</Label><Input value={form.child_age} onChange={e => setForm(p => ({ ...p, child_age: e.target.value }))} type="number" /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} /></div>
            <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Subject Interest</Label><Input value={form.subject_interest} onChange={e => setForm(p => ({ ...p, subject_interest: e.target.value }))} /></div>
            <div><Label className="text-xs">Preferred Time</Label><Input value={form.preferred_time} onChange={e => setForm(p => ({ ...p, preferred_time: e.target.value }))} /></div>
          </div>
          <div><Label className="text-xs">Message</Label><Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={2} /></div>
          <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="w-full">
            {createMutation.isPending ? 'Creating...' : 'Create Lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Schedule Demo Sub-Dialog ──
function ScheduleDemoSection({ lead, onScheduled }: { lead: Lead; onScheduled: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    scheduled_date: '', scheduled_time: '', duration_min: '30',
    platform: 'zoom', meeting_link: '', teacher_id: '',
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-demo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles').select('user_id, profiles!inner(id, full_name)')
        .eq('role', 'teacher');
      return (data || []).map((r: any) => ({ id: r.profiles.id, name: r.profiles.full_name }));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('demo_sessions').insert({
        lead_id: lead.id,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        duration_min: parseInt(form.duration_min),
        platform: form.platform,
        meeting_link: form.meeting_link || null,
        teacher_id: form.teacher_id || null,
        status: 'scheduled',
        feedback_token: crypto.randomUUID(),
      });
      if (error) throw error;
      // Auto-advance lead to demo_scheduled
      if (lead.status === 'new' || lead.status === 'contacted') {
        await supabase.from('leads').update({ status: 'demo_scheduled' }).eq('id', lead.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Demo scheduled!' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['demo-sessions'] });
      onScheduled();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Date *</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} /></div>
        <div><Label className="text-xs">Time *</Label><Input type="time" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Duration (min)</Label><Input type="number" value={form.duration_min} onChange={e => setForm(p => ({ ...p, duration_min: e.target.value }))} /></div>
        <div><Label className="text-xs">Platform</Label>
          <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="google_meet">Google Meet</SelectItem>
              <SelectItem value="whatsapp">WhatsApp Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Teacher</Label>
        <Select value={form.teacher_id} onValueChange={v => setForm(p => ({ ...p, teacher_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Assign teacher..." /></SelectTrigger>
          <SelectContent>
            {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label className="text-xs">Meeting Link</Label><Input value={form.meeting_link} onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))} placeholder="https://..." /></div>
      <Button onClick={() => scheduleMutation.mutate()} disabled={!form.scheduled_date || !form.scheduled_time || scheduleMutation.isPending} className="w-full">
        <Calendar className="h-4 w-4 mr-1" /> {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Demo'}
      </Button>
    </div>
  );
}

// ── Demo Sessions List ──
function DemoSessionsList({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const { data: sessions = [] } = useQuery({
    queryKey: ['demo-sessions', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('demo_sessions')
        .select('*, profiles:teacher_id(full_name)')
        .eq('lead_id', leadId)
        .order('scheduled_date', { ascending: false });
      return data || [];
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('demo_sessions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-sessions', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Session updated' });
    },
  });

  if (sessions.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">No demos scheduled yet</p>;

  return (
    <div className="space-y-3">
      {sessions.map((s: any) => (
        <div key={s.id} className="p-3 border rounded-lg space-y-2 bg-muted/20">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium">
              {s.scheduled_date} at {s.scheduled_time}
            </div>
            <Badge variant={s.status === 'completed' ? 'default' : s.status === 'no_show' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
              {s.status}
            </Badge>
          </div>
          {s.profiles?.full_name && <p className="text-xs text-muted-foreground">Teacher: {s.profiles.full_name}</p>}
          {s.platform && <p className="text-xs text-muted-foreground capitalize">Platform: {s.platform}</p>}
          {s.meeting_link && <a href={s.meeting_link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Join Link</a>}

          {/* Feedback display */}
          {s.feedback_rating && (
            <div className="p-2 bg-muted/50 rounded text-xs space-y-1">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="font-medium">Rating: {s.feedback_rating}/5</span>
                {s.feedback_response && <Badge variant="outline" className="ml-2 text-[10px] capitalize">{s.feedback_response}</Badge>}
              </div>
              {s.feedback_comment && <p className="text-muted-foreground">{s.feedback_comment}</p>}
            </div>
          )}

          {/* Teacher notes */}
          {s.teacher_notes && <p className="text-xs italic text-muted-foreground">Notes: {s.teacher_notes}</p>}

          {/* Actions for scheduled demos */}
          {s.status === 'scheduled' && (
            <div className="flex gap-1 pt-1">
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => updateSession.mutate({ id: s.id, updates: { status: 'completed' } })}>
                <ThumbsUp className="h-3 w-3 mr-1" /> Done
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => updateSession.mutate({ id: s.id, updates: { status: 'no_show' } })}>
                <ThumbsDown className="h-3 w-3 mr-1" /> No Show
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => updateSession.mutate({ id: s.id, updates: { status: 'cancelled' } })}>
                <XIcon className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          )}

          {/* Feedback collection for completed demos without feedback */}
          {s.status === 'completed' && !s.feedback_rating && (
            <FeedbackCollector sessionId={s.id} leadId={leadId} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Feedback Collector (inline) ──
function FeedbackCollector({ sessionId, leadId }: { sessionId: string; leadId: string }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [response, setResponse] = useState('');
  const [comment, setComment] = useState('');

  const saveFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('demo_sessions').update({
        feedback_rating: rating,
        feedback_response: response || null,
        feedback_comment: comment || null,
      }).eq('id', sessionId);
      if (error) throw error;
      // Auto-advance lead
      if (response === 'yes') {
        await supabase.from('leads').update({ status: 'ready_to_enroll' }).eq('id', leadId);
      } else if (response === 'no') {
        await supabase.from('leads').update({ status: 'lost', lost_reason: 'Declined after demo' }).eq('id', leadId);
      } else {
        await supabase.from('leads').update({ status: 'feedback_pending' }).eq('id', leadId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-sessions', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Feedback saved' });
    },
  });

  return (
    <div className="p-2 border border-dashed border-primary/30 rounded-lg space-y-2 bg-primary/5">
      <p className="text-xs font-medium text-primary">Collect Feedback</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} className={`p-1 rounded ${rating >= n ? 'text-yellow-500' : 'text-muted-foreground/30'}`}>
            <Star className="h-4 w-4" fill={rating >= n ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {[{ v: 'yes', l: 'Yes, enroll', icon: ThumbsUp }, { v: 'thinking', l: 'Thinking', icon: Clock }, { v: 'no', l: 'No', icon: ThumbsDown }].map(o => (
          <Button key={o.v} size="sm" variant={response === o.v ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setResponse(o.v)}>
            <o.icon className="h-3 w-3 mr-1" /> {o.l}
          </Button>
        ))}
      </div>
      <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Additional comments..." rows={2} className="text-xs" />
      <Button size="sm" onClick={() => saveFeedback.mutate()} disabled={!rating || saveFeedback.isPending} className="w-full h-8 text-xs">
        Save Feedback
      </Button>
    </div>
  );
}

// ── Enrollment Form Section ──
function EnrollmentFormSection({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();

  const sendForm = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID();
      const { error } = await supabase.from('leads').update({
        enrollment_form_token: token,
        enrollment_form_sent_at: new Date().toISOString(),
        status: 'enrollment_form_sent',
      }).eq('id', lead.id);
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Enrollment form ready', description: `Token: ${token}` });
    },
  });

  if (lead.enrollment_form_token) {
    const formUrl = `${window.location.origin}/enroll/${lead.enrollment_form_token}`;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-teal-600">✅ Enrollment form generated</p>
        <div className="p-2 bg-muted/50 rounded text-xs break-all font-mono">{formUrl}</div>
        <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(formUrl); toast({ title: 'Link copied!' }); }}>
          📋 Copy Link
        </Button>
        {lead.enrollment_form_opened_at && <p className="text-[10px] text-muted-foreground">Opened: {format(new Date(lead.enrollment_form_opened_at), 'dd MMM yyyy HH:mm')}</p>}
        {lead.enrollment_form_data && (
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
            <p className="font-medium text-green-700 dark:text-green-400">✅ Form submitted</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => sendForm.mutate()} disabled={sendForm.isPending} className="w-full">
      <Send className="h-4 w-4 mr-1" /> Generate Enrollment Form Link
    </Button>
  );
}

// ── Lead Detail Dialog ──
function LeadDetailDialog({ lead, open, onOpenChange }: { lead: Lead | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const { profile } = useAuth();

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: any = { status: newStatus };
      if (newStatus === 'lost') updates.lost_reason = lostReason || 'No reason provided';
      const { error } = await supabase.from('leads').update(updates).eq('id', lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Status updated' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const currentNotes = Array.isArray(lead!.notes) ? lead!.notes : [];
      const newNote = { timestamp: new Date().toISOString(), author: profile?.full_name || 'Admin', text: noteText };
      const { error } = await supabase.from('leads').update({ notes: [...currentNotes, newNote] }).eq('id', lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText('');
      toast({ title: 'Note added' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!lead) return null;
  const notes = Array.isArray(lead.notes) ? lead.notes : [];
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.status);
  const nextStage = currentIdx < PIPELINE_STAGES.length - 2 ? PIPELINE_STAGES[currentIdx + 1] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {lead.name}
            <Badge variant="outline" className="ml-2 capitalize">{lead.status.replace(/_/g, ' ')}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="demo">Demo</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="enroll">Enroll</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email}</div>}
              {lead.phone_whatsapp && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{lead.phone_whatsapp}</div>}
              {(lead.country || lead.city) && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{[lead.city, lead.country].filter(Boolean).join(', ')}</div>}
              {lead.preferred_time && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{lead.preferred_time}</div>}
            </div>
            {lead.for_whom === 'child' && lead.child_name && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="font-medium">For child: {lead.child_name} {lead.child_age ? `(Age: ${lead.child_age})` : ''}</p>
              </div>
            )}
            {lead.subject_interest && <div className="text-sm"><span className="text-muted-foreground">Subject:</span> {lead.subject_interest}</div>}
            {lead.message && <div className="text-sm p-3 bg-muted/30 rounded-lg italic">"{lead.message}"</div>}
            <div className="text-xs text-muted-foreground">Created {formatDistanceToNow(new Date(lead.created_at))} ago</div>
          </TabsContent>

          <TabsContent value="demo" className="space-y-3 mt-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Demo Sessions</p>
              <Button size="sm" variant="outline" onClick={() => setShowScheduler(!showScheduler)}>
                <Calendar className="h-3 w-3 mr-1" /> {showScheduler ? 'Hide' : 'Schedule New'}
              </Button>
            </div>
            {showScheduler && (
              <div className="border border-dashed border-primary/30 rounded-lg p-3 bg-primary/5">
                <ScheduleDemoSection lead={lead} onScheduled={() => setShowScheduler(false)} />
              </div>
            )}
            <DemoSessionsList leadId={lead.id} />
          </TabsContent>

          <TabsContent value="notes" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={2} className="flex-1" />
              <Button onClick={() => addNote.mutate()} disabled={!noteText.trim() || addNote.isPending} size="sm" className="self-end">Add</Button>
            </div>
            <ScrollArea className="h-60">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No notes yet</p>
              ) : (
                <div className="space-y-2">
                  {[...notes].reverse().map((note: any, i: number) => (
                    <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-xs">{note.author}</span>
                        <span className="text-xs text-muted-foreground">{note.timestamp ? format(new Date(note.timestamp), 'dd MMM, HH:mm') : ''}</span>
                      </div>
                      <p>{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="enroll" className="space-y-3 mt-3">
            <p className="text-sm font-medium">Enrollment Form</p>
            <p className="text-xs text-muted-foreground">Generate a unique enrollment form link for this lead. The form will be pre-filled with their details and include age-triggered parental consent.</p>
            <EnrollmentFormSection lead={lead} />
          </TabsContent>

          <TabsContent value="actions" className="space-y-3 mt-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Move to next stage</p>
              <div className="flex flex-wrap gap-2">
                {nextStage && lead.status !== 'enrolled' && lead.status !== 'lost' && (
                  <Button size="sm" onClick={() => updateStatus.mutate(nextStage.key)} disabled={updateStatus.isPending}>
                    <ArrowRight className="h-4 w-4 mr-1" /> {nextStage.label}
                  </Button>
                )}
                {lead.status !== 'lost' && lead.status !== 'enrolled' && (
                  <>
                    <div className="w-full">
                      <Input value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Lost reason (optional)" className="text-sm" />
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate('lost')} disabled={updateStatus.isPending}>
                      Mark Lost
                    </Button>
                  </>
                )}
              </div>
              <p className="text-sm font-medium mt-4">Jump to stage</p>
              <div className="flex flex-wrap gap-1">
                {PIPELINE_STAGES.filter(s => s.key !== lead.status).map(s => (
                  <Button key={s.key} variant="outline" size="sm" className="text-xs capitalize" onClick={() => updateStatus.mutate(s.key)} disabled={updateStatus.isPending}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead Card ──
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="p-3 bg-card border border-border rounded-lg cursor-pointer hover:shadow-md hover:border-primary/30 transition-all text-sm space-y-2"
    >
      <div className="flex justify-between items-start">
        <p className="font-semibold text-foreground truncate flex-1">{lead.name}</p>
        {lead.match_status === 'matched_existing' && (
          <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">Matched</Badge>
        )}
      </div>
      {lead.for_whom === 'child' && lead.child_name && (
        <p className="text-xs text-muted-foreground">For: {lead.child_name} {lead.child_age ? `(${lead.child_age}y)` : ''}</p>
      )}
      {lead.subject_interest && (
        <Badge variant="outline" className="text-[10px]">{lead.subject_interest}</Badge>
      )}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {lead.email && <span className="truncate max-w-[120px]">{lead.email}</span>}
        <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function LeadsPipeline() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone_whatsapp?.includes(q) ||
      l.subject_interest?.toLowerCase().includes(q) ||
      l.child_name?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const groupedByStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.key] = []; });
    filteredLeads.forEach(l => {
      if (map[l.status]) map[l.status].push(l);
    });
    return map;
  }, [filteredLeads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [leads]);

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads Pipeline</h1>
            <p className="text-sm text-muted-foreground">{leads.length} leads total</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="pl-9 w-60" />
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Lead
            </Button>
          </div>
        </div>

        {/* Pipeline Stats Strip */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map(s => (
            <div key={s.key} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full text-xs shrink-0">
              <div className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">({stageCounts[s.key] || 0})</span>
            </div>
          ))}
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-3 min-w-max pb-4">
              {PIPELINE_STAGES.map(stage => (
                <div key={stage.key} className="w-64 shrink-0">
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <span className="font-semibold text-sm">{stage.label}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {groupedByStage[stage.key]?.length || 0}
                    </Badge>
                  </div>
                  {/* Cards */}
                  <div className="space-y-2 min-h-[200px] p-2 bg-muted/20 rounded-lg border border-border/50">
                    {groupedByStage[stage.key]?.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No leads</p>
                    ) : (
                      groupedByStage[stage.key]?.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => {
                            setSelectedLead(lead);
                            setDetailOpen(true);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <CreateLeadDialog open={createOpen} onOpenChange={setCreateOpen} />
        <LeadDetailDialog lead={selectedLead} open={detailOpen} onOpenChange={setDetailOpen} />
      </div>
    </DashboardLayout>
  );
}
