import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, FileText,
  Loader2, Lock, ShieldCheck, Upload, User, Video,
} from 'lucide-react';

export interface WizardProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  registration_id: string | null;
  department: string | null;
  designation: string | null;
  qualification: string | null;
  specialization: string | null;
  years_experience: number | null;
  joining_date: string | null;
  employment_type: string | null;
  cv_url: string | null;
  cv_file_name: string | null;
  cv_uploaded_at: string | null;
  cv_status: string | null;
  banking_status: string | null;
  zoom_personal_id: string | null;
  zoom_email: string | null;
  onboarding_completed_at: string | null;
}

export interface WizardBanking {
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number_masked: string | null;
  bank_iban_masked: string | null;
  has_account_number: boolean;
  has_iban: boolean;
}

const STEPS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'professional', label: 'Professional', icon: ShieldCheck },
  { key: 'banking', label: 'Banking', icon: Building2 },
  { key: 'cv', label: 'CV / Resume', icon: FileText },
  { key: 'communication', label: 'Communication', icon: Video },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
] as const;

interface Props {
  /** Public onboarding link mode */
  token?: string;
  /** Signed-in mode — the teacher's own profile id */
  teacherId?: string;
  onCompleted?: () => void;
}

const draftKey = (id: string) => `teacher-onboarding-draft:${id}`;

export function TeacherOnboardingWizard({ token, teacherId, onCompleted }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<WizardProfile | null>(null);
  const [banking, setBanking] = useState<WizardBanking | null>(null);
  const [reveal, setReveal] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [personal, setPersonal] = useState({
    full_name: '', whatsapp_number: '', gender: '', date_of_birth: '', address: '',
  });
  const [bankForm, setBankForm] = useState({
    bank_name: '', bank_account_title: '', bank_account_number: '', bank_iban: '',
  });
  const [comm, setComm] = useState({ zoom_personal_id: '', zoom_email: '', whatsapp_number: '' });

  const callFn = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('teacher-onboarding', {
        body: { token, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    [token],
  );

  const hydrate = useCallback((p: WizardProfile, b: WizardBanking) => {
    setProfile(p);
    setBanking(b);
    setPersonal({
      full_name: p.full_name ?? '',
      whatsapp_number: p.whatsapp_number ?? '',
      gender: p.gender ?? '',
      date_of_birth: p.date_of_birth ?? '',
      address: p.address ?? '',
    });
    setBankForm({
      bank_name: b.bank_name ?? '',
      bank_account_title: b.bank_account_title ?? '',
      bank_account_number: '',
      bank_iban: '',
    });
    setComm({
      zoom_personal_id: p.zoom_personal_id ?? '',
      zoom_email: p.zoom_email ?? '',
      whatsapp_number: p.whatsapp_number ?? '',
    });
    const raw = sessionStorage.getItem(draftKey(p.id));
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.personal) setPersonal((s) => ({ ...s, ...d.personal }));
        if (d.bankForm) setBankForm((s) => ({ ...s, ...d.bankForm }));
        if (d.comm) setComm((s) => ({ ...s, ...d.comm }));
        if (typeof d.step === 'number') setStep(d.step);
      } catch { /* ignore */ }
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (token) {
          const res = await callFn({ action: 'load' });
          if (!cancelled) hydrate(res.profile, res.banking);
        } else if (teacherId) {
          const { data: p, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', teacherId)
            .maybeSingle();
          if (error) throw error;
          if (!p) throw new Error('Profile not found');
          const { data: s } = await (supabase as any)
            .from('profile_sensitive_data')
            .select('bank_name, bank_account_title, bank_account_number, bank_iban')
            .eq('user_id', teacherId)
            .maybeSingle();
          const mask = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);
          if (!cancelled) {
            hydrate(p as unknown as WizardProfile, {
              bank_name: s?.bank_name ?? null,
              bank_account_title: s?.bank_account_title ?? null,
              bank_account_number_masked: mask(s?.bank_account_number),
              bank_iban_masked: mask(s?.bank_iban),
              has_account_number: !!s?.bank_account_number,
              has_iban: !!s?.bank_iban,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message || 'Could not load this profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, teacherId, callFn, hydrate]);

  // Autosave draft per step
  useEffect(() => {
    if (!profile) return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey(profile.id), JSON.stringify({ personal, bankForm, comm, step }));
      } catch { /* ignore quota */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [profile, personal, bankForm, comm, step]);

  const persistStep = async (key: string) => {
    if (!profile) return;
    if (token) {
      const values =
        key === 'personal' ? personal : key === 'banking' ? bankForm : key === 'communication' ? comm : null;
      if (!values) return;
      await callFn({ action: 'save', step: key, values });
      return;
    }
    if (key === 'personal') {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: personal.full_name.trim() || profile.full_name,
          whatsapp_number: personal.whatsapp_number.trim() || null,
          gender: personal.gender || null,
          date_of_birth: personal.date_of_birth || null,
          address: personal.address.trim() || null,
        } as any)
        .eq('id', profile.id);
      if (error) throw error;
    } else if (key === 'banking') {
      const payload: Record<string, unknown> = {
        user_id: profile.id,
        bank_name: bankForm.bank_name.trim() || null,
        bank_account_title: bankForm.bank_account_title.trim() || null,
      };
      if (bankForm.bank_account_number.trim()) payload.bank_account_number = bankForm.bank_account_number.trim();
      if (bankForm.bank_iban.trim()) payload.bank_iban = bankForm.bank_iban.trim();
      const { error } = await (supabase as any)
        .from('profile_sensitive_data')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
    } else if (key === 'communication') {
      const { error } = await supabase
        .from('profiles')
        .update({
          zoom_personal_id: comm.zoom_personal_id.trim() || null,
          zoom_email: comm.zoom_email.trim() || null,
          whatsapp_number: comm.whatsapp_number.trim() || null,
        } as any)
        .eq('id', profile.id);
      if (error) throw error;
    }
  };

  const goNext = async () => {
    const key = STEPS[step].key;
    setSaving(true);
    try {
      await persistStep(key);
      if (key === 'review') {
        if (token) await callFn({ action: 'complete' });
        else await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() } as any).eq('id', profile!.id);
        sessionStorage.removeItem(draftKey(profile!.id));
        setDone(true);
        onCompleted?.();
        return;
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCv = async (file: File) => {
    if (!profile) return;
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      toast({ title: 'Unsupported file', description: 'Upload a PDF or DOC file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (token) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        buf.forEach((b) => { binary += String.fromCharCode(b); });
        await callFn({
          action: 'upload_cv',
          file_name: file.name,
          content_type: file.type,
          file_base64: btoa(binary),
        });
      } else {
        const path = `${profile.id}/cv-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('teacher-documents').upload(path, file, { upsert: true });
        if (error) throw error;
        const { error: upErr } = await supabase
          .from('profiles')
          .update({ cv_url: path, cv_file_name: file.name } as any)
          .eq('id', profile.id);
        if (upErr) throw upErr;
      }
      setProfile((p) => p ? { ...p, cv_file_name: file.name, cv_uploaded_at: new Date().toISOString(), cv_status: 'pending' } : p);
      toast({ title: 'CV uploaded', description: 'It is now pending review.' });
    } catch (e) {
      toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pct = useMemo(() => Math.round(((step + 1) / STEPS.length) * 100), [step]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your profile…
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-medium text-destructive">{loadError ?? 'Profile unavailable'}</p>
        <p className="text-sm text-muted-foreground mt-1">Please ask the academy office for a fresh link.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-serif font-bold">Submitted for verification</h2>
        <p className="text-sm text-muted-foreground">
          Your banking details and CV are now pending admin review. You can revisit this link any time to update them.
        </p>
      </div>
    );
  }

  const ro = 'bg-muted/60 text-muted-foreground cursor-not-allowed';
  const current = STEPS[step];

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">
            Step {step + 1} of {STEPS.length} · {current.label}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'text-[11px] rounded-full px-2.5 py-1 border transition-colors',
                i === step
                  ? 'bg-primary text-primary-foreground border-primary'
                  : i < step
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted/40 text-muted-foreground border-border',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-5">
        {/* STEP 1 — Personal */}
        {current.key === 'personal' && (
          <>
            <SectionHead icon={User} title="Personal information" subtitle="Your contact details — keep these current so we can reach you." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} />
              </Field>
              <Field label="Email" hint="Managed by the academy">
                <Input value={profile.email ?? ''} readOnly className={ro} />
              </Field>
              <Field label="Phone / WhatsApp">
                <Input value={personal.whatsapp_number} onChange={(e) => setPersonal({ ...personal, whatsapp_number: e.target.value })} placeholder="+92…" />
              </Field>
              <Field label="Gender">
                <Select value={personal.gender} onValueChange={(v) => setPersonal({ ...personal, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={personal.date_of_birth} onChange={(e) => setPersonal({ ...personal, date_of_birth: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address">
                  <Textarea rows={2} value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* STEP 2 — Professional (read-only) */}
        {current.key === 'professional' && (
          <>
            <SectionHead icon={ShieldCheck} title="Professional information" subtitle="Set by the academy. Contact admin if anything looks wrong." />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Teacher ID', profile.registration_id],
                ['Department', profile.department],
                ['Designation', profile.designation],
                ['Qualification', profile.qualification],
                ['Specialization', profile.specialization],
                ['Experience (years)', profile.years_experience?.toString()],
              ].map(([label, value]) => (
                <Field key={label as string} label={label as string} hint="Set by admin">
                  <Input value={(value as string) || '—'} readOnly className={ro} />
                </Field>
              ))}
            </div>
          </>
        )}

        {/* STEP 3 — Banking */}
        {current.key === 'banking' && (
          <>
            <SectionHead icon={Building2} title="Banking details" subtitle="Used for salary transfers. Saving sends these for admin verification." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank name">
                <Input value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
              </Field>
              <Field label="Account title" hint="Exactly as printed on your bank account">
                <Input value={bankForm.bank_account_title} onChange={(e) => setBankForm({ ...bankForm, bank_account_title: e.target.value })} />
              </Field>
              <Field label="Account number" hint={banking?.has_account_number ? `On file: ${reveal ? '' : banking.bank_account_number_masked}` : undefined}>
                <div className="relative">
                  <Input
                    type={reveal ? 'text' : 'password'}
                    value={bankForm.bank_account_number}
                    onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
                    placeholder={banking?.has_account_number ? 'Leave blank to keep current' : ''}
                    className="pr-9"
                  />
                  <button type="button" onClick={() => setReveal((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="IBAN" hint={banking?.has_iban ? `On file: ${banking.bank_iban_masked}` : undefined}>
                <Input
                  type={reveal ? 'text' : 'password'}
                  value={bankForm.bank_iban}
                  onChange={(e) => setBankForm({ ...bankForm, bank_iban: e.target.value })}
                  placeholder={banking?.has_iban ? 'Leave blank to keep current' : 'PK00XXXX…'}
                />
              </Field>
            </div>
          </>
        )}

        {/* STEP 4 — CV */}
        {current.key === 'cv' && (
          <>
            <SectionHead icon={FileText} title="CV / Resume" subtitle="PDF or DOC, up to 5MB. Re-uploading resets the review status." />
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleCv(f); }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Drag & drop your CV here, or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF, DOC or DOCX · max 5MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCv(f); }}
              />
            </label>
            {profile.cv_file_name && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="truncate">{profile.cv_file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {profile.cv_uploaded_at ? new Date(profile.cv_uploaded_at).toLocaleDateString() : ''}
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px] capitalize">
                  {(profile.cv_status ?? 'not_provided').replace('_', ' ')}
                </Badge>
              </div>
            )}
          </>
        )}

        {/* STEP 5 — Communication */}
        {current.key === 'communication' && (
          <>
            <SectionHead icon={Video} title="Communication IDs" subtitle="Reference only — live classes still run on the academy Zoom licences." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zoom personal meeting ID">
                <Input value={comm.zoom_personal_id} onChange={(e) => setComm({ ...comm, zoom_personal_id: e.target.value })} placeholder="123 4567 8900" />
              </Field>
              <Field label="Zoom email" hint="Only if different from your academy email">
                <Input value={comm.zoom_email} onChange={(e) => setComm({ ...comm, zoom_email: e.target.value })} />
              </Field>
              <Field label="WhatsApp number">
                <Input value={comm.whatsapp_number} onChange={(e) => setComm({ ...comm, whatsapp_number: e.target.value })} placeholder="+92…" />
              </Field>
            </div>
          </>
        )}

        {/* STEP 6 — Review */}
        {current.key === 'review' && (
          <>
            <SectionHead icon={CheckCircle2} title="Review & submit" subtitle="Check everything below, then submit for verification." />
            <div className="grid gap-4 sm:grid-cols-2">
              <ReviewBlock title="Personal" rows={[
                ['Full name', personal.full_name],
                ['Email', profile.email],
                ['Phone', personal.whatsapp_number],
                ['Gender', personal.gender],
                ['Date of birth', personal.date_of_birth],
                ['Address', personal.address],
              ]} />
              <ReviewBlock title="Professional" rows={[
                ['Teacher ID', profile.registration_id],
                ['Department', profile.department],
                ['Designation', profile.designation],
                ['Qualification', profile.qualification],
                ['Specialization', profile.specialization],
              ]} />
              <ReviewBlock title="Banking" rows={[
                ['Bank', bankForm.bank_name],
                ['Account title', bankForm.bank_account_title],
                ['Account number', bankForm.bank_account_number ? `••••${bankForm.bank_account_number.slice(-4)}` : banking?.bank_account_number_masked],
                ['IBAN', bankForm.bank_iban ? `••••${bankForm.bank_iban.slice(-4)}` : banking?.bank_iban_masked],
              ]} />
              <ReviewBlock title="CV & communication" rows={[
                ['CV file', profile.cv_file_name],
                ['Zoom meeting ID', comm.zoom_personal_id],
                ['Zoom email', comm.zoom_email],
                ['WhatsApp', comm.whatsapp_number],
              ]} />
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={goNext} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {current.key === 'review' ? 'Submit for verification' : 'Save & continue'}
            {current.key !== 'review' && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5 h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {label}
        {hint === 'Set by admin' && <Lock className="h-3 w-3 text-muted-foreground" />}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: (string | null | undefined)[][] }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k as string} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-foreground text-right truncate max-w-[60%]">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
