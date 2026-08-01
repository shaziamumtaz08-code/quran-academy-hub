import { PROFILE_SAFE_COLUMNS } from '@/lib/profileColumns';
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { TeacherOnboardingWizard } from '@/components/teachers/TeacherOnboardingWizard';
import {
  BadgeCheck, Banknote, BookOpen, Briefcase, CalendarDays, ChevronLeft, Clock, Download,
  Eye, EyeOff, FileText, GraduationCap, Mail, MapPin, Pencil, Phone,
  ShieldCheck, User, Video,
} from 'lucide-react';

const mask = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : '—');

function StatusPill({ status, kind }: { status?: string | null; kind: 'banking' | 'cv' }) {
  const s = status ?? 'not_provided';
  const label =
    s === 'verified' ? 'Verified'
    : s === 'approved' ? 'Approved'
    : s === 'pending' ? (kind === 'banking' ? 'Pending verification' : 'Pending review')
    : 'Not provided';
  const cls =
    s === 'verified' || s === 'approved' ? 'bg-primary/10 text-primary border-primary/30'
    : s === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
    : 'bg-muted text-muted-foreground border-border';
  return <span className={`text-[10px] rounded-full border px-2 py-0.5 ${cls}`}>{label}</span>;
}

function Card({ icon: Icon, title, action, children }: any) {
  return (
    <section className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || <span className="text-muted-foreground font-normal">—</span>}</p>
    </div>
  );
}


export default function TeacherProfile() {
  const { teacherId: paramId } = useParams<{ teacherId: string }>();
  const { profile: me, isSuperAdmin, hasRole, isLoading: authLoading } = useAuth();
  const teacherId = paramId ?? me?.id;
  const canAdmin = !!(isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const isSelf = teacherId === me?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reveal, setReveal] = useState(false);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['teacher-profile-page', teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      let profile: any = null;
      const full = await supabase.from('profiles').select(PROFILE_SAFE_COLUMNS).eq('id', teacherId!).maybeSingle();
      if (full.error) {
        console.error('[TeacherProfile] profiles select * failed', full.error);
        const basic = await supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, avatar_url, created_at, account_status, registration_id')
          .eq('id', teacherId!)
          .maybeSingle();
        if (basic.error) throw basic.error;
        profile = basic.data;
      } else {
        profile = full.data;
      }

      const { data: sensitive } = await (supabase as any)
        .from('profile_sensitive_data')
        .select('bank_name, bank_account_title, bank_account_number, bank_iban')
        .eq('user_id', teacherId!)
        .maybeSingle();

      const { data: salary } = await (supabase as any)
        .from('staff_salaries')
        .select('monthly_amount, effective_from')
        .eq('user_id', teacherId!)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name), subject:subjects(name)')
        .eq('teacher_id', teacherId!)
        .eq('status', 'active');

      return { profile, sensitive, salary, assignments: assignments ?? [] };
    },
  });

  const p = data?.profile;

  const timeWithUs = useMemo(() => {
    const start = p?.joining_date ?? p?.created_at;
    if (!start) return '—';
    const months = Math.max(
      0,
      Math.round((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
    );
    return months >= 12 ? `${Math.floor(months / 12)}y ${months % 12}m` : `${months}m`;
  }, [p]);

  const setVerification = async (patch: { banking?: string; cv?: string }) => {
    const { error } = await (supabase as any).rpc('admin_set_teacher_verification', {
      _teacher_id: teacherId,
      _banking: patch.banking ?? null,
      _cv: patch.cv ?? null,
    });
    if (error) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Updated' });
    qc.invalidateQueries({ queryKey: ['teacher-profile-page', teacherId] });
  };

  // Onboarding links are generated from User Management (admin), not the profile.


  const openCv = async () => {
    if (!p?.cv_url) return;
    const { data: signed } = await supabase.storage
      .from('teacher-documents')
      .createSignedUrl(p.cv_url, 60 * 5);
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
    else toast({ title: 'Could not open the CV', variant: 'destructive' });
  };

  if (authLoading || isLoading || (isFetching && !data)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <h1 className="font-serif text-xl font-bold text-foreground">Could not load this profile</h1>
        <p className="text-sm text-muted-foreground">{(error as any)?.message ?? 'Unknown error'}</p>
        <Button asChild variant="outline" size="sm"><Link to="/teachers">Back to teachers</Link></Button>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <h1 className="font-serif text-xl font-bold text-foreground">Teacher profile not found</h1>
        <p className="text-sm text-muted-foreground">
          {teacherId
            ? 'No profile record exists for this teacher, or you do not have permission to view it.'
            : 'No teacher selected. Open a teacher from the Teachers list.'}
        </p>
        <Button asChild variant="outline" size="sm"><Link to="/teachers">Back to teachers</Link></Button>
      </div>
    );
  }

  const stats = [
    { label: 'Years experience', value: p.years_experience ? `${p.years_experience}` : '—', icon: Briefcase, tone: 'border-l-primary', bg: 'bg-primary/10', fg: 'text-primary' },
    { label: 'Students assigned', value: `${data?.assignments.length ?? 0}`, icon: BookOpen, tone: 'border-l-teal-500', bg: 'bg-teal-500/10', fg: 'text-teal-600' },
    { label: 'Time with us', value: timeWithUs, icon: Clock, tone: 'border-l-amber-500', bg: 'bg-amber-500/10', fg: 'text-amber-600' },
    { label: 'Qualification', value: p.qualification || '—', icon: GraduationCap, tone: 'border-l-violet-500', bg: 'bg-violet-500/10', fg: 'text-violet-600' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs gap-1">
        <Link to="/teachers"><ChevronLeft className="h-3.5 w-3.5" /> Back to all teachers</Link>
      </Button>

      {/* Hero header */}
      <header className="rounded-2xl border overflow-hidden bg-card shadow-sm">
        <div className="h-20 bg-gradient-to-r from-primary via-primary/85 to-accent" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end min-w-0">
              <div className="h-24 w-24 rounded-2xl ring-4 ring-card bg-secondary flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={`${p.full_name} profile photo`} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 sm:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">{p.full_name}</h1>
                  {p.gov_id_verified && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">{p.account_status ?? 'active'}</Badge>
                </div>
                {(p.designation || p.department) && (
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    {[p.designation, p.department].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {p.registration_id && <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />{p.registration_id}</span>}
                  {p.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
                  {p.whatsapp_number && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.whatsapp_number}</span>}
                  {(p.city || p.country) && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[p.city, p.country].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(isSelf || canAdmin) && (
                <Button size="sm" className="gap-1.5" onClick={() => setWizardOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit profile
                </Button>
              )}
              {p.email && (
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={`mailto:${p.email}`}><Mail className="h-3.5 w-3.5" /> Send email</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border border-l-4 ${s.tone} bg-card p-4 shadow-sm`}>
            <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`h-4 w-4 ${s.fg}`} />
            </div>
            <p className="text-xl font-black text-foreground truncate">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card icon={User} title="Personal information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Full name" value={p.full_name} />
            <Row label="Email" value={p.email} />
            <Row label="Phone" value={p.whatsapp_number} />
            <Row label="Gender" value={p.gender} />
            <Row label="Date of birth" value={p.date_of_birth ? fmtDate(p.date_of_birth) : '—'} />
            <Row label="Address" value={[p.address, p.city, p.country].filter(Boolean).join(', ')} />
          </div>
        </Card>

        <Card icon={GraduationCap} title="Professional & education">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Highest qualification" value={p.qualification} />
            <Row label="Specialization" value={p.specialization} />
            <Row label="Years of experience" value={p.years_experience ? `${p.years_experience} years` : '—'} />
            <Row label="Arabic / Quran level" value={p.arabic_level} />
            <Row label="Languages" value={[p.preferred_language, p.first_language].filter(Boolean).join(', ')} />
            <Row label="Teaching language" value={p.teaching_os_language} />
          </div>
          <p className="text-[10px] text-muted-foreground">Education & experience — entered by the teacher during onboarding.</p>
        </Card>

        <Card icon={CalendarDays} title="Employment details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Employee / teacher ID" value={p.registration_id} />
            <Row label="Designation" value={p.designation} />
            <Row label="Department" value={p.department} />
            <Row label="Employment type" value={p.employment_type} />
            <Row label="Joining date" value={p.joining_date ? fmtDate(p.joining_date) : fmtDate(p.created_at)} />
            <Row label="Employment status" value={p.archived_at ? 'Archived' : 'Active'} />
            {canAdmin && (
              <>
                <Row
                  label="Monthly salary"
                  value={data?.salary?.monthly_amount != null ? `PKR ${Number(data.salary.monthly_amount).toLocaleString()}` : '—'}
                />
                <Row
                  label="Default payout rate"
                  value={p.default_payout_rate != null ? `PKR ${Number(p.default_payout_rate).toLocaleString()}` : '—'}
                />
              </>
            )}
            <Row label="Account status" value={p.account_status} />
          </div>
          <p className="text-[10px] text-muted-foreground">Assigned by the admin — read-only for teachers.</p>
        </Card>

        <Card
          icon={Banknote}
          title="Banking information"
          action={
            <div className="flex items-center gap-2">
              <StatusPill status={p.banking_status} kind="banking" />
              {canAdmin && p.banking_status !== 'verified' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVerification({ banking: 'verified' })}>
                  Verify
                </Button>
              )}
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Bank name" value={data?.sensitive?.bank_name} />
            <Row label="Account title" value={data?.sensitive?.bank_account_title} />
            <Row
              label="Account number"
              value={
                data?.sensitive?.bank_account_number ? (
                  canAdmin ? (
                    <span className="font-mono tabular-nums">{data.sensitive.bank_account_number}</span>
                  ) : (
                    <span className="inline-flex items-center gap-2 font-mono">
                      {reveal ? data.sensitive.bank_account_number : mask(data.sensitive.bank_account_number)}
                      <button type="button" onClick={() => setReveal((v) => !v)} className="text-muted-foreground">
                        {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  )
                ) : null
              }
            />
            <Row
              label="IBAN"
              value={
                data?.sensitive?.bank_iban
                  ? <span className="font-mono">{canAdmin || reveal ? data.sensitive.bank_iban : mask(data.sensitive.bank_iban)}</span>
                  : null
              }
            />
          </div>
          {canAdmin && (
            <p className="text-[10px] text-muted-foreground">Visible in full to admins for salary disbursement.</p>
          )}
        </Card>


        <Card
          icon={FileText}
          title="CV / Resume"
          action={
            <div className="flex items-center gap-2">
              <StatusPill status={p.cv_status} kind="cv" />
              {canAdmin && p.cv_url && p.cv_status !== 'approved' && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setVerification({ cv: 'approved' })}>
                  Approve
                </Button>
              )}
            </div>
          }
        >
          {p.cv_url ? (
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm truncate">{p.cv_file_name || 'CV document'}</p>
                <p className="text-[11px] text-muted-foreground">Uploaded {fmtDate(p.cv_uploaded_at)}</p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1" onClick={openCv}>
                <Download className="h-3 w-3" /> View
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>
          )}
          {(isSelf || canAdmin) && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setWizardOpen(true)}>
              {p.cv_url ? 'Re-upload CV' : 'Upload CV'}
            </Button>
          )}
        </Card>

        <Card icon={Video} title="Communication">
          <div className="grid gap-4 sm:grid-cols-2">
            <Row label="Zoom personal meeting ID" value={p.zoom_personal_id} />
            <Row label="Zoom email" value={p.zoom_email || p.email} />
            <Row label="WhatsApp number" value={p.whatsapp_number} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Reference only — live classes are hosted through the academy Zoom licence pool.
          </p>
        </Card>
      </div>

      <Card icon={BookOpen} title={`Assigned students & subjects (${data?.assignments.length ?? 0})`}>
        {data?.assignments.length ? (
          <Accordion type="single" collapsible>
            {data.assignments.map((a: any) => (
              <AccordionItem key={a.id} value={a.id}>
                <AccordionTrigger className="text-sm">
                  {a.student?.full_name ?? 'Unknown student'}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{a.subject?.name ?? 'No subject'}</Badge>
                    <Link to={`/students?search=${encodeURIComponent(a.student?.full_name ?? '')}`} className="text-primary hover:underline text-xs">
                      Open student
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground">No active assignments.</p>
        )}
      </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Update teacher profile</DialogTitle>
          </DialogHeader>
          <Separator />
          <TeacherOnboardingWizard
            teacherId={teacherId}
            onCompleted={() => {
              setWizardOpen(false);
              qc.invalidateQueries({ queryKey: ['teacher-profile-page', teacherId] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
