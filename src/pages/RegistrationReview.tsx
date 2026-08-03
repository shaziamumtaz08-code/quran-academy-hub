import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Baby, Banknote, BookOpen, Briefcase, Check, Copy, GraduationCap, KeyRound,
  Loader2, Mail, MapPin, Phone, Save, Sparkles, User as UserIcon, Users, X,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { BackLink, InfoCard, ProfileHero, StatTiles } from '@/components/profile/ProfileKit';

type CreatedAccount = { name: string; email: string; password: string; role: string; created: boolean };

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function RegistrationReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Record<string, any>>({});
  const [children, setChildren] = useState<any[]>([]);
  const [applicant, setApplicant] = useState<Record<string, any>>({});
  const [reviewNotes, setReviewNotes] = useState('');
  const [accounts, setAccounts] = useState<CreatedAccount[]>([]);

  const { data: reg, isLoading } = useQuery({
    queryKey: ['family-registration', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('family_registrations').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!reg) return;
    setForm({
      parent_name: reg.parent_name ?? '', email: reg.email ?? '', phone: reg.phone ?? '',
      relationship: reg.relationship ?? '', city: reg.city ?? '', country: reg.country ?? '',
      timezone: reg.timezone ?? '', address: reg.address ?? '', occupation: reg.occupation ?? '',
      notes: reg.notes ?? '',
    });
    setChildren(Array.isArray(reg.children) ? (reg.children as any[]) : []);
    setApplicant((reg.applicant_data as any) ?? {});
    setReviewNotes(reg.review_notes ?? '');
  }, [reg]);

  const isTeacher = reg?.registration_type === 'teacher';
  const banking = (applicant.banking ?? {}) as Record<string, any>;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('family_registrations').update({
        ...form,
        children: children as any,
        applicant_data: applicant as any,
        review_notes: reviewNotes || null,
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Changes saved' });
      queryClient.invalidateQueries({ queryKey: ['family-registration', id] });
      queryClient.invalidateQueries({ queryKey: ['family-registrations'] });
    },
    onError: (e: any) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const { error } = await supabase.from('family_registrations').update({
        status: 'rejected', review_notes: reviewNotes || null,
        reviewed_at: new Date().toISOString(), reviewed_by: session.user?.id ?? null,
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Registration rejected' });
      queryClient.invalidateQueries({ queryKey: ['family-registrations'] });
      navigate('/people?view=registrations');
    },
    onError: (e: any) => toast({ title: 'Could not reject', description: e.message, variant: 'destructive' }),
  });

  const approve = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      const { data, error } = await supabase.functions.invoke('approve-registration', {
        body: { registration_id: id, review_notes: reviewNotes || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return ((data as any)?.accounts ?? []) as CreatedAccount[];
    },
    onSuccess: (created) => {
      setAccounts(created);
      toast({ title: 'Approved', description: `${created.length} account(s) created. They now appear under ${isTeacher ? 'Teachers' : 'Students'}.` });
      queryClient.invalidateQueries({ queryKey: ['family-registration', id] });
      queryClient.invalidateQueries({ queryKey: ['family-registrations'] });
    },
    onError: (e: any) => toast({ title: 'Could not approve', description: e.message, variant: 'destructive' }),
  });

  const stats = useMemo(() => ([
    { label: 'Type', value: isTeacher ? 'Teacher' : 'Family', icon: isTeacher ? GraduationCap : Users, tone: (isTeacher ? 'violet' : 'sky') as any },
    { label: isTeacher ? 'Experience' : 'Students', value: isTeacher ? `${applicant.years_experience ?? 0} yrs` : children.length, icon: isTeacher ? Briefcase : Baby, tone: 'teal' as any },
    { label: 'Status', value: (reg?.status ?? '—') as string, icon: Sparkles, tone: (reg?.status === 'approved' ? 'teal' : reg?.status === 'rejected' ? 'rose' : 'amber') as any },
    { label: 'Submitted', value: reg ? format(new Date(reg.created_at), 'dd MMM yyyy') : '—', icon: BookOpen, tone: 'primary' as any },
  ]), [reg, isTeacher, applicant, children]);

  if (isLoading || !reg) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>;

  const pending = reg.status === 'pending';

  return (
    <div className="space-y-5 pb-10">
      <BackLink to="/people?view=registrations" label="Back to registrations" />

      <ProfileHero
        name={isTeacher ? (applicant.full_name || reg.parent_name) : reg.parent_name}
        gradient={isTeacher ? 'from-violet-600 via-indigo-600 to-sky-500' : 'from-sky-600 via-cyan-600 to-teal-500'}
        badges={
          <>
            <Badge variant="outline" className="capitalize">{isTeacher ? 'Teacher application' : 'Student / family'}</Badge>
            <Badge variant={reg.status === 'approved' ? 'default' : reg.status === 'rejected' ? 'destructive' : 'outline'} className="capitalize">{reg.status}</Badge>
          </>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{form.email}</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{form.phone}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[form.city, form.country].filter(Boolean).join(', ') || '—'}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save
            </Button>
            {pending && (
              <>
                <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
                  {approve.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}Approve &amp; create
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" disabled={reject.isPending} onClick={() => reject.mutate()}>
                  <X className="h-4 w-4 mr-1" />Reject
                </Button>
              </>
            )}
          </>
        }
      />

      <StatTiles stats={stats} />

      {accounts.length > 0 && (
        <InfoCard icon={KeyRound} title="Login credentials" tone="teal">
          <div className="space-y-2 p-5">
            {accounts.map((a) => (
              <div key={a.email} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="capitalize">{a.role}</Badge>
                <span className="font-medium">{a.name}</span>
                <code className="rounded bg-muted px-2 py-0.5">{a.email}</code>
                <code className="rounded bg-muted px-2 py-0.5">{a.created ? a.password : 'existing account'}</code>
                <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(`${a.email} / ${a.password}`); toast({ title: 'Copied' }); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </InfoCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <InfoCard icon={UserIcon} title={isTeacher ? 'Applicant details' : 'Parent / guardian details'} tone="primary">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Full name" value={form.parent_name ?? ''} onChange={(v) => setForm({ ...form, parent_name: v })} />
            <Field label="Email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone / WhatsApp" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label={isTeacher ? 'Occupation' : 'Relationship'} value={(isTeacher ? form.occupation : form.relationship) ?? ''} onChange={(v) => setForm({ ...form, [isTeacher ? 'occupation' : 'relationship']: v })} />
            <Field label="City" value={form.city ?? ''} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Country" value={form.country ?? ''} onChange={(v) => setForm({ ...form, country: v })} />
            <Field label="Timezone" value={form.timezone ?? ''} onChange={(v) => setForm({ ...form, timezone: v })} />
            <Field label="Address" value={form.address ?? ''} onChange={(v) => setForm({ ...form, address: v })} />
          </div>
        </InfoCard>

        {isTeacher ? (
          <InfoCard icon={Briefcase} title="Professional background" tone="violet">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Qualification" value={applicant.qualification ?? ''} onChange={(v) => setApplicant({ ...applicant, qualification: v })} />
              <Field label="Specialization" value={applicant.specialization ?? ''} onChange={(v) => setApplicant({ ...applicant, specialization: v })} />
              <Field label="Years of experience" type="number" value={String(applicant.years_experience ?? '')} onChange={(v) => setApplicant({ ...applicant, years_experience: v === '' ? null : Number(v) })} />
              <Field label="Date of birth" type="date" value={applicant.date_of_birth ?? ''} onChange={(v) => setApplicant({ ...applicant, date_of_birth: v })} />
              <Field label="Gender" value={applicant.gender ?? ''} onChange={(v) => setApplicant({ ...applicant, gender: v })} />
              <Field label="Zoom email" value={applicant.zoom_email ?? ''} onChange={(v) => setApplicant({ ...applicant, zoom_email: v })} />
            </div>
          </InfoCard>
        ) : (
          <InfoCard icon={Users} title="Family notes" tone="sky">
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Note from the family</Label>
                <Textarea rows={4} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Field label="Preferred contact" value={reg.preferred_contact ?? ''} onChange={() => {}} />
            </div>
          </InfoCard>
        )}
      </div>

      {isTeacher && (
        <InfoCard icon={Banknote} title="Salary account (self-declared)" tone="amber">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Payout method" value={banking.payout_method ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, payout_method: v } })} />
            <Field label="Bank / wallet" value={banking.bank_name ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, bank_name: v } })} />
            <Field label="Account title" value={banking.bank_account_title ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, bank_account_title: v } })} />
            <Field label="Account number" value={banking.bank_account_number ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, bank_account_number: v } })} />
            <Field label="IBAN" value={banking.bank_iban ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, bank_iban: v } })} />
            <Field label="Branch" value={banking.branch ?? ''} onChange={(v) => setApplicant({ ...applicant, banking: { ...banking, branch: v } })} />
          </div>
        </InfoCard>
      )}

      {!isTeacher && (
        <InfoCard icon={Baby} title={`Students (${children.length})`} tone="teal">
          <div className="space-y-4 p-5">
            {children.length === 0 && <p className="text-sm text-muted-foreground">No students listed on this registration.</p>}
            {children.map((child, index) => (
              <div key={index} className="rounded-xl border bg-muted/20 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-600">Student {index + 1}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {([
                    ['Name', 'name'], ['Email', 'email'], ['Age', 'age'],
                    ['Gender', 'gender'], ['Level', 'level'], ['Goals', 'goals'],
                  ] as const).map(([label, key]) => (
                    <Field
                      key={key}
                      label={label}
                      value={String(child[key] ?? '')}
                      onChange={(v) => setChildren(children.map((c, i) => (i === index ? { ...c, [key]: v } : c)))}
                    />
                  ))}
                </div>
                {Array.isArray(child.subjects) && child.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {child.subjects.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </InfoCard>
      )}

      <InfoCard icon={Sparkles} title="Admin review" tone="rose">
        <div className="space-y-3 p-5">
          <Textarea rows={3} placeholder="Review note (shared internally)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
          {reg.reviewed_at && (
            <p className="text-xs text-muted-foreground">Last reviewed {format(new Date(reg.reviewed_at), 'dd MMM yyyy, HH:mm')}</p>
          )}
        </div>
      </InfoCard>
    </div>
  );
}
