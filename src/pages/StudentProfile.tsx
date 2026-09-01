import { PROFILE_SAFE_COLUMNS } from '@/lib/profileColumns';
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ProfileEditorPanel } from '@/components/profile/ProfileEditorPanel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfileAvatar } from '@/hooks/useProfileAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BackLink, ProfileHero, StatTiles, InfoCard, InfoRow, StatusBadge, EmptyState,
} from '@/components/profile/ProfileKit';
import {
  BadgeCheck, BookOpen, CalendarDays, Clock, Droplet, GraduationCap, Globe, HeartPulse,
  Mail, MapPin, Phone, School, ShieldCheck, Siren, Settings2, Target, User, Users, IdCard, Languages,
} from 'lucide-react';

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null;

function monthsSince(iso?: string | null) {
  if (!iso) return '—';
  const months = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  if (months < 1) return 'New';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y}y${m ? ` ${m}m` : ''}`;
}

export default function StudentProfile() {
  const { studentId: paramId } = useParams<{ studentId: string }>();
  const { profile: me, isSuperAdmin, hasRole, isLoading: authLoading } = useAuth();
  const studentId = paramId ?? me?.id;
  const queryClient = useQueryClient();
  const canAdmin = !!(isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const canTeach = !!(canAdmin || hasRole('teacher'));
  const canEditPhoto = !!(studentId === me?.id || isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const { onAvatarSelect, uploading: avatarUploading } = useProfileAvatar(studentId, () =>
    queryClient.invalidateQueries({ queryKey: ['student-profile-page', studentId] }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-profile-page', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      let profile: any = null;
      const full = await supabase.from('profiles').select(PROFILE_SAFE_COLUMNS).eq('id', studentId!).maybeSingle();
      if (full.error) {
        const basic = await supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, avatar_url, created_at, account_status, registration_id, age, gender, timezone')
          .eq('id', studentId!)
          .maybeSingle();
        if (basic.error) throw basic.error;
        profile = basic.data;
      } else {
        profile = full.data;
      }

      // Medical / emergency contact fields are restricted; fetch via secure RPC
      // (self, linked parents and admins only).
      const { data: wellbeing } = await (supabase as any).rpc('get_profile_wellbeing', { _user_id: studentId! });
      if (profile && Array.isArray(wellbeing) && wellbeing[0]) profile = { ...profile, ...wellbeing[0] };

      const { data: links } = await supabase
        .from('student_parent_links')
        .select('parent_id, relationship, parent:profiles!student_parent_links_parent_id_fkey(id, full_name, email, avatar_url, whatsapp_number)')
        .eq('student_id', studentId!);

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, status, start_date, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name), subject:subjects(name)')
        .eq('student_id', studentId!)
        .eq('status', 'active');

      return { profile, links: links ?? [], assignments: assignments ?? [] };
    },
  });

  const p = data?.profile;

  if (authLoading || isLoading) {
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
          {error ? 'Could not load this student' : 'Student profile not found'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message ?? 'No profile exists for this student, or you do not have permission to view it.'}
        </p>
        <Button asChild variant="outline" size="sm"><Link to="/students">Back to students</Link></Button>
      </div>
    );
  }

  const teachers = data!.assignments;

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink to="/students" label="Back to all students" />

      <ProfileHero
        name={p.full_name ?? 'Unnamed student'}
        avatarUrl={p.avatar_url}
        onAvatarSelect={canEditPhoto ? onAvatarSelect : undefined}
        avatarUploading={avatarUploading}
        gradient="from-primary via-sky-500 to-teal-500"
        badges={
          <>
            {p.gov_id_verified && (
              <Badge variant="secondary" className="gap-1 text-[10px]"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{p.account_status ?? 'active'}</Badge>
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
            {canAdmin && (
              <Button size="sm" variant={advancedOpen ? 'secondary' : 'default'} className="gap-1.5" onClick={() => setAdvancedOpen((v) => !v)}>
                <Settings2 className="h-3.5 w-3.5" /> {advancedOpen ? 'Close editor' : 'Edit profile'}
              </Button>
            )}
            {p.email && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`mailto:${p.email}`}><Mail className="h-3.5 w-3.5" /> Send email</a>
              </Button>
            )}
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/progress-timeline?studentId=${p.id}`}><Target className="h-3.5 w-3.5" /> Progress</Link>
            </Button>
          </>
        }
      />

      <StatTiles
        stats={[
          { label: 'Active subjects', value: teachers.length, icon: BookOpen, tone: 'primary' },
          { label: 'Guardians linked', value: data!.links.length, icon: Users, tone: 'teal' },
          { label: 'Time with us', value: monthsSince(p.created_at), icon: Clock, tone: 'violet' },
          { label: 'Blood group', value: p.blood_group ?? 'Not provided', icon: Droplet, tone: 'amber' },
        ]}
      />

      {advancedOpen && canAdmin && studentId && <ProfileEditorPanel userId={studentId} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={User} title="Personal information" tone="primary">
          <InfoRow icon={User} label="Full name" value={p.full_name} />
          <InfoRow icon={IdCard} label="Student ID" value={p.registration_id ? <span className="font-semibold text-primary">{p.registration_id}</span> : null} />
          <InfoRow icon={Mail} label="Email address" value={p.email ? <a href={`mailto:${p.email}`} className="font-medium text-sky-600 hover:underline">{p.email}</a> : null} />
          <InfoRow icon={Phone} label="Phone number" value={p.whatsapp_number ? <span className="font-medium text-teal-600">{p.whatsapp_number}</span> : null} />
          <InfoRow icon={User} label="Gender" value={p.gender ? <span className="capitalize">{p.gender}</span> : null} />
          <InfoRow icon={CalendarDays} label="Date of birth" value={fmtDate(p.date_of_birth) ?? (p.age ? `${p.age} years` : null)} />
          <InfoRow icon={MapPin} label="Address" value={[p.address, p.city, p.country].filter(Boolean).join(', ')} />
          <InfoRow icon={Globe} label="Timezone" value={p.timezone} />
        </InfoCard>

        <InfoCard icon={GraduationCap} title="Academic information" tone="teal">
          <InfoRow icon={IdCard} label="Student ID" value={p.registration_id ? <span className="font-semibold text-teal-600">{p.registration_id}</span> : null} />
          <InfoRow icon={CalendarDays} label="Enrolment date" value={fmtDate(p.created_at)} />
          <InfoRow icon={School} label="School / grade" value={[p.school_name, p.grade_level].filter(Boolean).join(' • ')} />
          <InfoRow icon={BookOpen} label="Mushaf / unit" value={[p.mushaf_type, p.preferred_unit].filter(Boolean).join(' • ')} />
          <InfoRow icon={Target} label="Daily target" value={p.daily_target_amount ?? p.daily_target_lines} />
          <InfoRow icon={Languages} label="Arabic level" value={p.arabic_level} />
          <InfoRow icon={ShieldCheck} label="Account status" value={<StatusBadge ok={(p.account_status ?? 'active') === 'active'} label={p.account_status ?? 'Active'} />} />
          <InfoRow icon={BadgeCheck} label="Email verified" value={<StatusBadge ok={!!p.email} label={p.email ? 'Verified' : 'Pending'} />} />
        </InfoCard>

        <InfoCard icon={Users} title="Guardian information" tone="amber">
          <InfoRow icon={User} label="Father" value={p.father_name} />
          <InfoRow icon={Phone} label="Father's phone" value={p.father_contact ? <span className="font-medium text-sky-600">{p.father_contact}</span> : null} />
          <InfoRow icon={User} label="Mother" value={p.mother_name} />
          <InfoRow icon={Phone} label="Mother's phone" value={p.mother_contact ? <span className="font-medium text-sky-600">{p.mother_contact}</span> : null} />
          <InfoRow icon={Users} label="Relation" value={p.guardian_type} />
          <InfoRow icon={Mail} label="Preferred contact" value={p.preferred_contact_method} />
        </InfoCard>

        <InfoCard icon={Siren} title="Emergency contact" tone="rose">
          <InfoRow icon={User} label="Contact name" value={p.emergency_contact_name} />
          <InfoRow icon={Phone} label="Contact phone" value={p.emergency_contact_phone ? <span className="font-medium text-rose-600">{p.emergency_contact_phone}</span> : null} />
          <InfoRow icon={Users} label="Relation" value={p.guardian_type} />
        </InfoCard>

        <InfoCard icon={HeartPulse} title="Medical information" tone="violet">
          <InfoRow icon={Droplet} label="Blood group" value={p.blood_group} />
          <InfoRow label="Medical conditions" value={p.medical_conditions ?? 'None'} />
          <InfoRow label="Notes" value={p.medical_notes ?? p.special_needs ?? 'No notes'} />
        </InfoCard>

        <InfoCard icon={Target} title="Learning & background" tone="sky">
          <InfoRow label="Learning goals" value={p.learning_goals} />
          <InfoRow label="Special needs / notes" value={p.special_needs} />
          <InfoRow label="Preferred language" value={p.preferred_language ?? p.first_language} />
          <InfoRow label="How they heard about us" value={p.hear_about_us} />
        </InfoCard>
      </div>

      <InfoCard icon={Users} title="Parents" tone="violet">
        {data!.links.length === 0 ? (
          <EmptyState icon={Users} title="No guardian linked" hint="Link a parent from the Parents page." />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {data!.links.map((l: any) => (
              <div
                key={l.parent_id}
                className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 via-card to-card p-4 shadow-[0_10px_28px_-20px_rgba(139,92,246,0.7)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/parent-profile/${l.parent_id}`} className="font-semibold text-foreground hover:text-violet-600 hover:underline">
                    {l.parent?.full_name ?? 'Unnamed'}
                  </Link>
                  <Badge variant="outline" className="border-teal-500/40 bg-teal-500/10 text-[10px] uppercase text-teal-600">
                    {l.relationship ?? 'guardian'}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-violet-500" />
                    <span className="truncate text-foreground">{l.parent?.email ?? '—'}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 text-teal-500" />
                    <span className="truncate text-foreground">{l.parent?.whatsapp_number ?? '—'}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </InfoCard>

      <InfoCard icon={GraduationCap} title="Enrolled subjects & teachers" tone="amber">
        {teachers.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No active assignment" hint="Assign a teacher from the Assignments page." />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((a: any) => (
              <div
                key={a.id}
                className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card p-4 shadow-[0_10px_28px_-20px_rgba(245,158,11,0.7)] transition-transform hover:-translate-y-0.5"
              >
                <p className="text-sm font-semibold text-foreground">{a.subject?.name ?? 'Subject'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.teacher?.full_name ?? 'Unassigned'}</p>
                <p className="mt-2 text-[11px] font-medium text-amber-600">{fmtDate(a.start_date) ?? ''}</p>
                {canTeach && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/teaching-os?assignment_id=${a.id}`}
                      className="rounded-full border border-amber-500/40 bg-card px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10"
                    >
                      Teaching OS
                    </Link>
                    <Link
                      to={`/quiz-engine?assignment_id=${a.id}`}
                      className="rounded-full border border-amber-500/40 bg-card px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-500/10"
                    >
                      Quiz
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </InfoCard>

    </div>
  );
}
