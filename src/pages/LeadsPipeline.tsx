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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Phone, Mail, MapPin, Clock, User, Calendar,
  MessageSquare, ArrowRight, X as XIcon, ChevronRight, Eye,
  UserPlus, Send, Star, ThumbsUp, ThumbsDown, Minus, GripVertical,
  Filter, RefreshCw, MoreVertical, Shield, FileText, Upload, Mic
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'bg-blue-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { key: 'pre_screen', label: 'Pre-Screen', color: 'bg-[#7F77DD]' },
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

// ── Reschedule Section ──
function RescheduleSection({ session, leadId }: { session: any; leadId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      // Mark old session as rescheduled
      const { error: updateErr } = await supabase.from('demo_sessions').update({ status: 'rescheduled' }).eq('id', session.id);
      if (updateErr) throw updateErr;
      // Create new session
      const { error: insertErr } = await supabase.from('demo_sessions').insert({
        lead_id: leadId,
        scheduled_date: newDate,
        scheduled_time: newTime,
        duration_min: session.duration_min || 30,
        platform: session.platform || 'zoom',
        meeting_link: session.meeting_link || null,
        teacher_id: session.teacher_id || null,
        status: 'scheduled',
        feedback_token: crypto.randomUUID(),
      });
      if (insertErr) throw insertErr;
      // Update lead status back to demo_scheduled
      await supabase.from('leads').update({ status: 'demo_scheduled' }).eq('id', leadId);
    },
    onSuccess: () => {
      toast({ title: 'Demo rescheduled!' });
      queryClient.invalidateQueries({ queryKey: ['demo-sessions', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="text-[10px] h-6 text-primary" onClick={() => setOpen(true)}>
        <RefreshCw className="h-3 w-3 mr-1" /> Reschedule
      </Button>
    );
  }

  return (
    <div className="p-2 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg space-y-2 bg-blue-50/50 dark:bg-blue-900/10">
      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Reschedule Demo</p>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="text-xs h-8" />
        <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="text-xs h-8" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" onClick={() => rescheduleMutation.mutate()} disabled={!newDate || !newTime || rescheduleMutation.isPending} className="text-[10px] h-7 flex-1">
          {rescheduleMutation.isPending ? 'Saving...' : 'Confirm Reschedule'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="text-[10px] h-7">Cancel</Button>
      </div>
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
            <div className="flex flex-wrap gap-1 pt-1">
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

          {/* Reschedule for scheduled, no_show, or cancelled */}
          {['scheduled', 'no_show', 'cancelled'].includes(s.status) && (
            <RescheduleSection session={s} leadId={leadId} />
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

// ── Pre-Screen Form ──
const QUICK_TAGS = ['Good motivation', 'Needs encouragement', 'Parent involved', 'Irregular availability', 'Strong memory', 'Pronunciation issues', 'Young child — short sessions'];
const LEVELS = [
  { value: 'complete_beginner', label: 'Complete Beginner', desc: 'No prior learning' },
  { value: 'basic', label: 'Basic', desc: 'Knows alphabet, limited reading' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Reads with errors, needs Tajweed' },
  { value: 'advanced', label: 'Advanced', desc: 'Reads fluently, refinement needed' },
];

function PreScreenForm({ lead, onComplete }: { lead: Lead; onComplete: () => void }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [isSkipped, setIsSkipped] = useState(false);
  const [form, setForm] = useState({
    channel: 'whatsapp', duration_minutes: '', material_tested: '',
    estimated_level: '', observations: '', confidence_rating: 0,
    proceed_decision: '', suggested_teacher_id: '',
  });
  const [quickTags, setQuickTags] = useState<string[]>([]);

  const { data: existingScreening } = useQuery({
    queryKey: ['lead-screening', lead.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_screenings').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-screening'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, profiles!inner(id, full_name)').eq('role', 'teacher');
      return (data || []).map((r: any) => ({ id: r.profiles.id, name: r.profiles.full_name }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_id: lead.id,
        screened_by: profile?.id || null,
        channel: form.channel,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        material_tested: form.material_tested || null,
        estimated_level: form.estimated_level || null,
        quick_tags: quickTags,
        observations: form.observations || null,
        confidence_rating: form.confidence_rating || null,
        proceed_decision: form.proceed_decision || null,
        suggested_teacher_id: form.suggested_teacher_id || null,
        is_skipped: isSkipped,
      };
      
      if (existingScreening) {
        const { error } = await (supabase.from('lead_screenings') as any).update(payload).eq('id', existingScreening.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('lead_screenings') as any).insert(payload);
        if (error) throw error;
      }
      
      // Advance lead to pre_screen if currently new/contacted
      if (['new', 'contacted'].includes(lead.status)) {
        await supabase.from('leads').update({ status: 'pre_screen' as any }).eq('id', lead.id);
      }
      // If proceed_decision is yes, advance to demo_scheduled
      if (form.proceed_decision === 'yes' || form.proceed_decision === 'yes_with_notes') {
        await supabase.from('leads').update({ status: 'demo_scheduled' as any }).eq('id', lead.id);
      }
    },
    onSuccess: () => {
      toast({ title: isSkipped ? 'Screening skipped' : 'Screening saved' });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-screening', lead.id] });
      onComplete();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleTag = (tag: string) => setQuickTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  return (
    <div className="space-y-4">
      {/* Bypass checkbox */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
        <Checkbox checked={isSkipped} onCheckedChange={(v) => setIsSkipped(!!v)} id="skip-screening" />
        <div>
          <label htmlFor="skip-screening" className="text-sm font-medium cursor-pointer">Not required — skip this step</label>
          <p className="text-xs text-muted-foreground">Tick to bypass screening and proceed directly to demo scheduling</p>
        </div>
      </div>

      {isSkipped ? (
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? 'Saving...' : 'Skip & Continue to Demo'}
        </Button>
      ) : (
        <>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
            Pre-demo screening helps the teacher prepare and reduces no-shows. Record the channel used, material tested, and your observations below.
          </div>

          {/* Screening Logistics */}
          <Card className="border shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Screening Logistics</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Screened by</Label>
                  <Input value={profile?.full_name || 'Current user'} disabled className="text-xs h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Date & time</Label>
                  <Input value={format(new Date(), 'dd MMM yyyy — HH:mm')} disabled className="text-xs h-9 mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Screening channel *</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['whatsapp', 'zoom', 'in_person', 'phone', 'other'].map(ch => (
                    <button key={ch} type="button" onClick={() => setForm(p => ({ ...p, channel: ch }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.channel === ch ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:border-primary/30'
                      }`}>
                      {ch === 'whatsapp' ? 'WhatsApp' : ch === 'in_person' ? 'In-person' : ch === 'phone' ? 'Phone call' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} placeholder="e.g. 15" className="text-xs h-9 mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Material & Level Assessment */}
          <Card className="border shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Material & Level Assessment</p>
              <div>
                <Label className="text-xs">Material tested</Label>
                <Input value={form.material_tested} onChange={e => setForm(p => ({ ...p, material_tested: e.target.value }))}
                  placeholder="e.g. Noorani Qaida lesson 3, Surah Al-Fatiha, Juz Amma" className="text-xs h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">Estimated level</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {LEVELS.map(level => (
                    <button key={level.value} type="button" onClick={() => setForm(p => ({ ...p, estimated_level: level.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        form.estimated_level === level.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                      }`}>
                      <p className="text-sm font-medium">{level.label}</p>
                      <p className="text-xs text-muted-foreground">{level.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Quick observations <span className="text-muted-foreground font-normal">(tap to tag)</span></Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {QUICK_TAGS.map(tag => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                        quickTags.includes(tag) ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'bg-muted/50 border-border hover:border-primary/30'
                      }`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Screening notes</Label>
                <Textarea value={form.observations} onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                  placeholder="Detailed observations, recommended course, anything the teacher should know before the demo..." rows={3} className="text-xs mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Admin Recommendation */}
          <Card className="border shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Recommendation</p>
              <div>
                <Label className="text-xs">Proceed to demo? *</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {[
                    { v: 'yes', l: 'Yes — schedule demo' },
                    { v: 'yes_with_notes', l: 'Yes — with notes for teacher' },
                    { v: 'hold', l: 'Hold — needs follow-up' },
                    { v: 'not_suitable', l: 'Not suitable' },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setForm(p => ({ ...p, proceed_decision: opt.v }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        form.proceed_decision === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:border-primary/30'
                      }`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Confidence rating</Label>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(p => ({ ...p, confidence_rating: n }))}
                      className={`w-9 h-9 rounded-lg border-2 text-sm font-bold transition-all ${
                        form.confidence_rating >= n ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' : 'border-border text-muted-foreground'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Suggested teacher (optional)</Label>
                <Select value={form.suggested_teacher_id} onValueChange={v => setForm(p => ({ ...p, suggested_teacher_id: v }))}>
                  <SelectTrigger className="text-xs h-9 mt-1"><SelectValue placeholder="Assign preferred teacher for demo" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save Draft
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.proceed_decision || saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Complete & Schedule Demo ↗'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Lead Attachments Section ──
function LeadAttachmentsSection({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: attachments = [] } = useQuery({
    queryKey: ['lead-attachments', leadId],
    queryFn: async () => {
      const { data } = await (supabase.from('lead_attachments') as any).select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const uploadFile = async (file: File, type: string) => {
    const ext = file.name.split('.').pop();
    const path = `${leadId}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('lead-attachments').upload(path, file);
    if (uploadErr) { toast({ title: 'Upload failed', description: uploadErr.message, variant: 'destructive' }); return; }
    const { data: urlData } = supabase.storage.from('lead-attachments').getPublicUrl(path);
    const { error } = await (supabase.from('lead_attachments') as any).insert({
      lead_id: leadId, file_url: urlData.publicUrl, file_type: type,
      file_name: file.name, file_size: file.size, uploaded_by: profile?.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    queryClient.invalidateQueries({ queryKey: ['lead-attachments', leadId] });
    toast({ title: 'File uploaded' });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { type: 'image', label: 'Image', desc: 'JPG, PNG, WebP · 5 MB', accept: '.jpg,.jpeg,.png,.webp', icon: Upload },
          { type: 'pdf', label: 'PDF', desc: 'PDF · 10 MB', accept: '.pdf', icon: FileText },
          { type: 'voice', label: 'Voice Note', desc: 'OGG, MP4, WebM · 3 min', accept: '.ogg,.opus,.mp4,.webm,.m4a', icon: Mic },
        ].map(t => (
          <label key={t.type} className="flex flex-col items-center gap-1 p-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-all">
            <t.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">{t.label}</span>
            <span className="text-[10px] text-muted-foreground text-center">{t.desc}</span>
            <input type="file" accept={t.accept} className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file, t.type);
              e.target.value = '';
            }} />
          </label>
        ))}
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
              {a.file_type === 'voice' ? <Mic className="h-3 w-3" /> : a.file_type === 'pdf' ? <FileText className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
              <a href={a.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex-1 truncate">{a.file_name}</a>
              <span className="text-muted-foreground">{a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="screen">Screen</TabsTrigger>
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
