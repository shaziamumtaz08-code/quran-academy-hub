import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Search, UserPlus, Loader2, ChevronLeft, ChevronDown, AlertTriangle, CheckCircle2,
  User, Mail, Phone, GraduationCap, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'choose' | 'search' | 'create' | 'confirm';

interface ExistingProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  registration_id: string | null;
  country: string | null;
  city: string | null;
}

interface NewUserDraft {
  full_name: string;
  email: string;
  whatsapp_number: string;
  country: string;
  gender: string;
  dob?: string;
  city?: string;
  timezone?: string;
  nationality?: string;
  first_language?: string;
  arabic_level?: string;
  hear_about_us?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  gov_id_type?: string;
  gov_id_number?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  courseName?: string;
  onEnrolled?: () => void;
}

const EMPTY_NEW: NewUserDraft = {
  full_name: '', email: '', whatsapp_number: '', country: '', gender: '',
};

export function EnrollStudentDialog({ open, onOpenChange, courseId, courseName, onEnrolled }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('choose');
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ExistingProfile | null>(null);
  const [newUser, setNewUser] = useState<NewUserDraft>(EMPTY_NEW);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingMatch, setExistingMatch] = useState<ExistingProfile | null>(null);
  const [result, setResult] = useState<{ tempPassword?: string; loginEmail?: string } | null>(null);

  const { data: course } = useQuery({
    queryKey: ['course-name-for-enroll', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('name').eq('id', courseId).single();
      return data;
    },
    enabled: open && !courseName,
  });
  const displayCourseName = courseName || course?.name || 'this course';

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['enroll-search-profiles', search],
    queryFn: async () => {
      const term = search.trim();
      if (term.length < 2) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number, registration_id, country, city')
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,registration_id.ilike.%${term}%`)
        .is('archived_at', null)
        .limit(15);
      return (data || []) as ExistingProfile[];
    },
    enabled: open && mode === 'search' && search.trim().length >= 2,
  });

  const { data: alreadyEnrolled } = useQuery({
    queryKey: ['enroll-check', courseId, selectedProfile?.id],
    queryFn: async () => {
      if (!selectedProfile) return false;
      const { data } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', selectedProfile.id)
        .eq('status', 'active')
        .limit(1);
      return (data?.length || 0) > 0;
    },
    enabled: !!selectedProfile && mode === 'confirm',
  });

  function reset() {
    setMode('choose');
    setSearch('');
    setSelectedProfile(null);
    setNewUser(EMPTY_NEW);
    setOptionalOpen(false);
    setExistingMatch(null);
    setResult(null);
  }

  function handleClose() {
    if (submitting) return;
    onOpenChange(false);
    setTimeout(reset, 200);
  }

  const tempPasswordPreview = useMemo(() => {
    const name = (selectedProfile?.full_name || newUser.full_name || 'User').split(/\s+/)[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + '1234';
  }, [selectedProfile, newUser.full_name]);

  const newUserValid = useMemo(() => {
    return (
      newUser.full_name.trim().length > 1 &&
      /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(newUser.email.trim()) &&
      newUser.whatsapp_number.trim().length > 4 &&
      newUser.country.trim().length > 0 &&
      newUser.gender.trim().length > 0
    );
  }, [newUser]);

  async function handleCreateContinue() {
    if (!newUserValid) {
      toast.error('Please fill all mandatory fields');
      return;
    }
    const email = newUser.email.toLowerCase().trim();
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, whatsapp_number, registration_id, country, city')
      .eq('email', email)
      .limit(1);

    if (data && data.length > 0) {
      setExistingMatch(data[0] as ExistingProfile);
      return;
    }
    setExistingMatch(null);
    setMode('confirm');
  }

  function linkExistingInstead() {
    if (!existingMatch) return;
    setSelectedProfile(existingMatch);
    setExistingMatch(null);
    setMode('confirm');
  }

  async function handleConfirmEnroll() {
    setSubmitting(true);
    try {
      const isExisting = !!selectedProfile && mode === 'confirm';
      const data: Record<string, any> = isExisting
        ? {
            full_name: selectedProfile!.full_name || '',
            email: (selectedProfile!.email || '').toLowerCase().trim(),
            phone: selectedProfile!.whatsapp_number || '',
            country: selectedProfile!.country || '',
            city: selectedProfile!.city || '',
          }
        : {
            full_name: newUser.full_name.trim(),
            email: newUser.email.toLowerCase().trim(),
            phone: newUser.whatsapp_number.trim(),
            whatsapp_number: newUser.whatsapp_number.trim(),
            country: newUser.country.trim(),
            gender: newUser.gender,
            dob: newUser.dob || null,
            city: newUser.city || null,
            timezone: newUser.timezone || null,
            nationality: newUser.nationality || null,
            first_language: newUser.first_language || null,
            arabic_level: newUser.arabic_level || null,
            hear_about_us: newUser.hear_about_us || null,
            guardian_name: newUser.guardian_name || null,
            guardian_phone: newUser.guardian_phone || null,
            guardian_email: newUser.guardian_email || null,
            identity: (newUser.gov_id_type || newUser.gov_id_number) ? {
              gov_id_type: newUser.gov_id_type || null,
              gov_id_number: newUser.gov_id_number || null,
            } : undefined,
          };

      // Resolve a registration form for this course (form_id is NOT NULL + FK)
      let { data: form } = await supabase
        .from('registration_forms')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!form) {
        // Fallback: any form for this course (active or not)
        const { data: anyForm } = await supabase
          .from('registration_forms')
          .select('id')
          .eq('course_id', courseId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        form = anyForm;
      }

      if (!form) {
        // Auto-create a default internal form so manual enrollment never breaks
        const slug = `manual-${courseId.slice(0, 8)}-${Date.now()}`;
        const { data: created, error: formErr } = await supabase
          .from('registration_forms')
          .insert({
            course_id: courseId,
            slug,
            title: 'Manual Enrollment (Internal)',
            is_active: true,
          })
          .select('id')
          .single();
        if (formErr || !created) throw formErr || new Error('Failed to prepare enrollment form');
        form = created;
      }

      const { data: sub, error } = await supabase.from('registration_submissions').insert({
        form_id: form.id,
        course_id: courseId,
        data: data as any,
        source_tag: 'manual_admin',
        status: 'new',
      }).select('id').single();

      if (error || !sub) throw error || new Error('Failed to create submission');

      const { data: enrollResult, error: enrollErr } = await supabase.functions.invoke('process-enrollment', {
        body: { submission_id: sub.id, course_id: courseId },
      });

      if (enrollErr || enrollResult?.error) {
        throw new Error(enrollErr?.message || enrollResult?.error || 'Enrollment failed');
      }

      setResult({
        tempPassword: enrollResult?.temp_password,
        loginEmail: enrollResult?.login_email,
      });

      toast.success(`✅ ${enrollResult?.student_name || 'Student'} enrolled successfully`);
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course-rostered-count', courseId] });
      onEnrolled?.();
    } catch (e: any) {
      toast.error(e.message || 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {mode === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>Add Student to {displayCourseName}</DialogTitle>
              <DialogDescription>Choose how to add a student to this course.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <button
                onClick={() => setMode('search')}
                className="flex items-start gap-3 rounded-lg border-2 border-border hover:border-primary/40 hover:bg-accent/30 p-4 text-left transition-all">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Search Existing User</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Find a user already in the system by name, email, or UID and enroll them.
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground self-center" />
              </button>

              <button
                onClick={() => setMode('create')}
                className="flex items-start gap-3 rounded-lg border-2 border-border hover:border-primary/40 hover:bg-accent/30 p-4 text-left transition-all">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Create New User</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Full enrollment form. Creates a profile, login account, and enrolls in one flow.
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground self-center" />
              </button>
            </div>
          </>
        )}

        {mode === 'search' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2" onClick={() => setMode('choose')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Search Existing User</DialogTitle>
              </div>
              <DialogDescription>Type at least 2 characters to search by name, email, or UID.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Ahmed, ahmed@email.com, AQT-ONL-STU-0001"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              <div className="border rounded-lg max-h-[320px] overflow-y-auto">
                {searching && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching…
                  </div>
                )}
                {!searching && search.trim().length < 2 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Start typing to search profiles
                  </div>
                )}
                {!searching && search.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No matching users found. Try different keywords or create a new user.
                  </div>
                )}
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProfile(p); setMode('confirm'); }}
                    className="w-full flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-accent/40 text-left">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.full_name || '(no name)'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.email || 'no email'} {p.registration_id && ` • ${p.registration_id}`}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {mode === 'create' && !existingMatch && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2" onClick={() => setMode('choose')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Create New User</DialogTitle>
              </div>
              <DialogDescription>Mandatory fields are marked with *. Optional fields can be added later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name *" value={newUser.full_name} onChange={v => setNewUser(p => ({ ...p, full_name: v }))} placeholder="Ahmed Ali" />
                <Field label="Email *" type="email" value={newUser.email} onChange={v => setNewUser(p => ({ ...p, email: v }))} placeholder="ahmed@example.com" />
                <Field label="WhatsApp Number *" value={newUser.whatsapp_number} onChange={v => setNewUser(p => ({ ...p, whatsapp_number: v }))} placeholder="+923001234567" />
                <Field label="Country *" value={newUser.country} onChange={v => setNewUser(p => ({ ...p, country: v }))} placeholder="Pakistan" />
                <div className="space-y-1.5">
                  <Label className="text-xs">Gender *</Label>
                  <Select value={newUser.gender} onValueChange={v => setNewUser(p => ({ ...p, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                    Optional fields
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", optionalOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-2 gap-3 pt-2">
                  <Field label="Date of Birth" type="date" value={newUser.dob || ''} onChange={v => setNewUser(p => ({ ...p, dob: v }))} />
                  <Field label="City" value={newUser.city || ''} onChange={v => setNewUser(p => ({ ...p, city: v }))} />
                  <Field label="Timezone" value={newUser.timezone || ''} onChange={v => setNewUser(p => ({ ...p, timezone: v }))} placeholder="Asia/Karachi" />
                  <Field label="Nationality" value={newUser.nationality || ''} onChange={v => setNewUser(p => ({ ...p, nationality: v }))} />
                  <Field label="First Language" value={newUser.first_language || ''} onChange={v => setNewUser(p => ({ ...p, first_language: v }))} />
                  <Field label="Arabic Level" value={newUser.arabic_level || ''} onChange={v => setNewUser(p => ({ ...p, arabic_level: v }))} placeholder="Beginner / Intermediate" />
                  <Field label="How did you hear about us" value={newUser.hear_about_us || ''} onChange={v => setNewUser(p => ({ ...p, hear_about_us: v }))} className="col-span-2" />
                  <Field label="Guardian Name" value={newUser.guardian_name || ''} onChange={v => setNewUser(p => ({ ...p, guardian_name: v }))} />
                  <Field label="Guardian Phone" value={newUser.guardian_phone || ''} onChange={v => setNewUser(p => ({ ...p, guardian_phone: v }))} />
                  <Field label="Guardian Email" type="email" value={newUser.guardian_email || ''} onChange={v => setNewUser(p => ({ ...p, guardian_email: v }))} />
                  <Field label="Gov ID Type" value={newUser.gov_id_type || ''} onChange={v => setNewUser(p => ({ ...p, gov_id_type: v }))} placeholder="CNIC / Passport" />
                  <Field label="Gov ID Number" value={newUser.gov_id_number || ''} onChange={v => setNewUser(p => ({ ...p, gov_id_number: v }))} className="col-span-2" />
                </CollapsibleContent>
              </Collapsible>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('choose')}>Back</Button>
              <Button onClick={handleCreateContinue} disabled={!newUserValid}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {mode === 'create' && existingMatch && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" /> User Already Exists
              </DialogTitle>
              <DialogDescription>
                A user with email <strong>{existingMatch.email}</strong> is already in the system.
                You can link the existing user instead of creating a duplicate.
              </DialogDescription>
            </DialogHeader>
            <Card className="bg-muted/30">
              <CardContent className="p-3 space-y-1 text-sm">
                <div className="font-medium">{existingMatch.full_name || '(no name)'}</div>
                <div className="text-xs text-muted-foreground">{existingMatch.email}</div>
                {existingMatch.registration_id && (
                  <Badge variant="outline" className="text-[10px]">{existingMatch.registration_id}</Badge>
                )}
              </CardContent>
            </Card>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExistingMatch(null)}>Edit Form</Button>
              <Button onClick={linkExistingInstead}>Link Existing User Instead</Button>
            </DialogFooter>
          </>
        )}

        {mode === 'confirm' && !result && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 -ml-2"
                  onClick={() => setMode(selectedProfile && !newUser.full_name ? 'search' : 'create')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>Confirm Enrollment</DialogTitle>
              </div>
              <DialogDescription>Review the details below before enrolling.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Student</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{selectedProfile?.full_name || newUser.full_name}</span>
                      {selectedProfile && <Badge variant="secondary" className="text-[10px]">Existing</Badge>}
                      {!selectedProfile && <Badge variant="outline" className="text-[10px]">New</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {selectedProfile?.email || newUser.email}
                    </div>
                    {(selectedProfile?.whatsapp_number || newUser.whatsapp_number) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {selectedProfile?.whatsapp_number || newUser.whatsapp_number}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Course</div>
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span className="font-medium">{displayCourseName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Will be auto-assigned to first available class.</p>
                </CardContent>
              </Card>

              {alreadyEnrolled && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Already enrolled</div>
                    <div className="text-xs">This student is already actively enrolled in this course.</div>
                  </div>
                </div>
              )}

              {!selectedProfile && !alreadyEnrolled && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-medium text-blue-700 dark:text-blue-300">Login credentials will be created</div>
                  <div><span className="text-muted-foreground">Email:</span> <code>{newUser.email}</code></div>
                  <div><span className="text-muted-foreground">Temp password:</span> <code>{tempPasswordPreview}</code></div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleConfirmEnroll} disabled={submitting || alreadyEnrolled}
                className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enrolling…</> : 'Confirm & Enroll'}
              </Button>
            </DialogFooter>
          </>
        )}

        {mode === 'confirm' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" /> Student Enrolled
              </DialogTitle>
            </DialogHeader>
            {result.tempPassword && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-2 text-sm">
                <div className="font-medium text-emerald-700 dark:text-emerald-400">Login credentials</div>
                <div><span className="text-muted-foreground">Email:</span> <code>{result.loginEmail}</code></div>
                <div><span className="text-muted-foreground">Temp password:</span> <code>{result.tempPassword}</code></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); }}>Add Another</Button>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
