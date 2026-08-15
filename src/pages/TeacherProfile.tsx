import { PROFILE_SAFE_COLUMNS } from '@/lib/profileColumns';
import { useMemo, useState } from 'react';
import { useProfileAvatar } from '@/hooks/useProfileAvatar';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPayoutRate } from '@/lib/payoutRates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { TeacherOnboardingWizard } from '@/components/teachers/TeacherOnboardingWizard';
import { ProfileEditorPanel } from '@/components/profile/ProfileEditorPanel';
import {
  BackLink, ProfileHero, StatTiles, InfoCard, InfoRow, StatusBadge, EmptyState,
} from '@/components/profile/ProfileKit';
import {
  BadgeCheck, Banknote, BookOpen, Briefcase, CalendarDays, Clock, Download,
  Eye, EyeOff, FileText, GraduationCap, IdCard, Languages, Mail, MapPin, Pencil, Phone,
  Settings2, ShieldCheck, User, Users, Video,
} from 'lucide-react';

const mask = (v?: string | null) => (v ? `••••${v.slice(-4)}` : null);
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null);

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

export default function TeacherProfile({ staffMode = false }: { staffMode?: boolean } = {}) {
  const params = useParams<{ teacherId?: string; staffId?: string }>();
  const paramId = params.teacherId ?? params.staffId;
  const { profile: me, isSuperAdmin, hasRole, isLoading: authLoading } = useAuth();
  const teacherId = paramId ?? me?.id;
  const canAdmin = !!(isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const isSelf = teacherId === me?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { onAvatarSelect, uploading: avatarUploading } = useProfileAvatar(teacherId, () =>
    qc.invalidateQueries({ queryKey: ['teacher-profile-page', teacherId] }));

  const backTo = staffMode ? '/user-management?mode=staff' : '/teachers';
  const backLabel = staffMode ? 'Back to staff' : 'Back to all teachers';

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['teacher-profile-page', teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      let profile: any = null;
      const full = await supabase.from('profiles').select(PROFILE_SAFE_COLUMNS).eq('id', teacherId!).maybeSingle();
      if (full.error) {
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

      // Date of birth is restricted on profiles; only self / admin (and the
      // student's own teacher) can read it through this RPC.
      const { data: wellbeing } = await (supabase as any).rpc('get_profile_wellbeing', { _user_id: teacherId! });
      if (profile && Array.isArray(wellbeing) && wellbeing[0]) profile = { ...profile, ...wellbeing[0] };

      // Payout rate is admin/self only — never readable straight off profiles.
      const payoutRate = await fetchPayoutRate(teacherId!);
      if (profile) profile = { ...profile, default_payout_rate: payoutRate };



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
        .select('id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, gender, age), subject:subjects(name)')
        .eq('teacher_id', teacherId!)
        .eq('status', 'active');

      const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', teacherId!);

      return { profile, sensitive, salary, assignments: assignments ?? [], roles: (roleRows ?? []).map((r: any) => r.role) };
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
    const { error: rpcError } = await (supabase as any).rpc('admin_set_teacher_verification', {
      _teacher_id: teacherId,
      _banking: patch.banking ?? null,
      _cv: patch.cv ?? null,
    });
    if (rpcError) {
      toast({ title: 'Action failed', description: rpcError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Updated' });
    qc.invalidateQueries({ queryKey: ['teacher-profile-page', teacherId] });
  };

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

  if (error || !p) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-3">
        <h1 className="font-serif text-xl font-bold text-foreground">
          {error ? 'Could not load this profile' : staffMode ? 'Staff profile not found' : 'Teacher profile not found'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message ?? 'No profile record exists, or you do not have permission to view it.'}
        </p>
        <Button asChild variant="outline" size="sm"><Link to={backTo}>{backLabel}</Link></Button>
      </div>
    );
  }

  const assignments = data?.assignments ?? [];
  const roles: string[] = data?.roles ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink to={backTo} label={backLabel} />

      <ProfileHero
        name={p.full_name ?? 'Unnamed user'}
        avatarUrl={p.avatar_url}
        onAvatarSelect={isSelf || canAdmin ? onAvatarSelect : undefined}
        avatarUploading={avatarUploading}
        gradient={staffMode ? 'from-violet-600 via-primary to-sky-500' : 'from-primary via-sky-500 to-teal-500'}
        badges={
          <>
            {p.gov_id_verified && (
              <Badge variant="secondary" className="gap-1 text-[10px]"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{p.account_status ?? 'active'}</Badge>
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px] capitalize">{r.replace(/_/g, ' ')}</Badge>
            ))}
          </>
        }
        meta={
          <>
            {p.registration_id && <span className="flex items-center gap-1"><IdCard className="h-3.5 w-3.5" />{p.registration_id}</span>}
            {p.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
            {p.whatsapp_number && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.whatsapp_number}</span>}
            {(p.city || p.country) && (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[p.city, p.country].filter(Boolean).join(', ')}</span>
            )}
          </>
        }
        actions={
          <>
            {(isSelf || canAdmin) && (
              <Button size="sm" className="gap-1.5" onClick={() => setWizardOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Button>
            )}
            {canAdmin && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdvancedOpen((v) => !v)}>
                <Settings2 className="h-3.5 w-3.5" /> {advancedOpen ? 'Hide all fields' : 'All fields'}
              </Button>
            )}
            {p.email && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`mailto:${p.email}`}><Mail className="h-3.5 w-3.5" /> Send email</a>
              </Button>
            )}
          </>
        }
      />

      <StatTiles
        stats={[
          { label: 'Years experience', value: p.years_experience ? `${p.years_experience}` : '—', icon: Briefcase, tone: 'primary' },
          staffMode
            ? { label: 'Role', value: roles[0]?.replace(/_/g, ' ') ?? '—', icon: ShieldCheck, tone: 'teal' as const }
            : { label: 'Students assigned', value: `${assignments.length}`, icon: BookOpen, tone: 'teal' as const },
          { label: 'Time with us', value: timeWithUs, icon: Clock, tone: 'amber' },
          { label: 'Qualification', value: p.qualification || '—', icon: GraduationCap, tone: 'violet' },
        ]}
      />

      {advancedOpen && canAdmin && teacherId && <ProfileEditorPanel userId={teacherId} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={User} title="Personal information" tone="primary">
          <InfoRow icon={User} label="Full name" value={p.full_name} />
          <InfoRow icon={Mail} label="Email" value={p.email ? <a href={`mailto:${p.email}`} className="font-medium text-sky-600 hover:underline">{p.email}</a> : null} />
          <InfoRow icon={Phone} label="Phone" value={p.whatsapp_number ? <span className="font-medium text-teal-600">{p.whatsapp_number}</span> : null} />
          <InfoRow icon={User} label="Gender" value={p.gender ? <span className="capitalize">{p.gender}</span> : null} />
          <InfoRow icon={CalendarDays} label="Date of birth" value={fmtDate(p.date_of_birth)} />
          <InfoRow icon={MapPin} label="Address" value={[p.address, p.city, p.country].filter(Boolean).join(', ')} />
        </InfoCard>

        <InfoCard icon={GraduationCap} title="Professional & education" tone="teal">
          <InfoRow icon={GraduationCap} label="Highest qualification" value={p.qualification} />
          <InfoRow icon={BookOpen} label="Specialization" value={p.specialization} />
          <InfoRow icon={Briefcase} label="Years of experience" value={p.years_experience ? `${p.years_experience} years` : null} />
          <InfoRow icon={Languages} label="Arabic / Quran level" value={p.arabic_level} />
          <InfoRow icon={Languages} label="Languages" value={[p.preferred_language, p.first_language].filter(Boolean).join(', ')} />
          <InfoRow icon={Languages} label="Teaching language" value={p.teaching_os_language} />
        </InfoCard>

        <InfoCard icon={CalendarDays} title="Employment details" tone="amber">
          <InfoRow icon={IdCard} label="Employee ID" value={p.registration_id ? <span className="font-semibold text-amber-600">{p.registration_id}</span> : null} />
          <InfoRow icon={Briefcase} label="Designation" value={p.designation} />
          <InfoRow icon={Briefcase} label="Department" value={p.department} />
          <InfoRow icon={Briefcase} label="Employment type" value={p.employment_type} />
          <InfoRow icon={CalendarDays} label="Joining date" value={fmtDate(p.joining_date) ?? fmtDate(p.created_at)} />
          <InfoRow icon={ShieldCheck} label="Employment status" value={<StatusBadge ok={!p.archived_at} label={p.archived_at ? 'Archived' : 'Active'} />} />
          {canAdmin && (
            <InfoRow
              icon={Banknote}
              label="Monthly salary"
              value={data?.salary?.monthly_amount != null ? `PKR ${Number(data.salary.monthly_amount).toLocaleString()}` : null}
            />
          )}
          {canAdmin && (
            <InfoRow
              icon={Banknote}
              label="Default payout rate"
              value={p.default_payout_rate != null ? `PKR ${Number(p.default_payout_rate).toLocaleString()}` : null}
            />
          )}
        </InfoCard>

        <InfoCard
          icon={Banknote}
          title="Banking information"
          tone="violet"
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
          <InfoRow icon={Banknote} label="Bank name" value={data?.sensitive?.bank_name} />
          <InfoRow icon={User} label="Account title" value={data?.sensitive?.bank_account_title} />
          <InfoRow
            icon={IdCard}
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
          <InfoRow
            icon={IdCard}
            label="IBAN"
            value={
              data?.sensitive?.bank_iban
                ? <span className="font-mono">{canAdmin || reveal ? data.sensitive.bank_iban : mask(data.sensitive.bank_iban)}</span>
                : null
            }
          />
          {!data?.sensitive?.bank_account_number && !data?.sensitive?.bank_iban && (
            <div className="p-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-700">
                  {isSelf
                    ? 'No salary account on file. Add your bank or wallet details so payroll can credit your salary — nobody else can fill this in for you.'
                    : 'No salary account details submitted yet. Ask them to complete the banking step in their profile.'}
                </p>
                {isSelf && (
                  <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => setWizardOpen(true)}>
                    Add salary account
                  </Button>
                )}
              </div>
            </div>
          )}
        </InfoCard>

        <InfoCard
          icon={FileText}
          title="CV / Resume"
          tone="sky"
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
            <div className="flex items-center gap-3 px-5 py-4">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm truncate">{p.cv_file_name || 'CV document'}</p>
                <p className="text-[11px] text-muted-foreground">Uploaded {fmtDate(p.cv_uploaded_at) ?? '—'}</p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1" onClick={openCv}>
                <Download className="h-3 w-3" /> View
              </Button>
            </div>
          ) : (
            <EmptyState icon={FileText} title="No CV uploaded yet" hint={isSelf ? 'Upload your CV from Edit profile.' : undefined} />
          )}
        </InfoCard>

        <InfoCard icon={Video} title="Communication" tone="rose">
          <InfoRow icon={Video} label="Zoom personal meeting ID" value={p.zoom_personal_id} />
          <InfoRow icon={Mail} label="Zoom email" value={p.zoom_email || p.email} />
          <InfoRow icon={Phone} label="WhatsApp number" value={p.whatsapp_number} />
        </InfoCard>
      </div>

      {!staffMode && (
        <InfoCard icon={Users} title={`Assigned students & subjects (${assignments.length})`} tone="teal">
          {assignments.length === 0 ? (
            <EmptyState icon={Users} title="No active assignments" hint="Assign students from the Assignments page." />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a: any) => (
                <Link
                  key={a.id}
                  to={a.student?.id ? `/student-profile/${a.student.id}` : '#'}
                  className="group flex items-start gap-3 rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card p-4 shadow-[0_10px_28px_-20px_rgba(20,184,166,0.7)] transition-transform hover:-translate-y-0.5"
                >
                  <div className="h-9 w-9 shrink-0 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-teal-600">
                      {a.student?.full_name ?? 'Unknown student'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[a.student?.age ? `Age ${a.student.age}` : null, a.student?.gender].filter(Boolean).join(' • ') || '—'}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3 text-teal-600" />
                      {a.subject?.name ?? 'No subject'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </InfoCard>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Update profile</DialogTitle>
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
