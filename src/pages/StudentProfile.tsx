import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BackLink, ProfileHero, StatTiles, InfoCard, InfoRow, StatusBadge, EmptyState,
} from '@/components/profile/ProfileKit';
import {
  BadgeCheck, BookOpen, CalendarDays, Clock, GraduationCap, Globe, HeartPulse,
  Mail, MapPin, Phone, ShieldCheck, Target, User, Users, IdCard, Languages,
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
  const { profile: me, isLoading: authLoading } = useAuth();
  const studentId = paramId ?? me?.id;

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

      const { data: links } = await supabase
        .from('student_parent_links')
        .select('parent_id, relationship, parent:profiles!student_parent_links_parent_id_fkey(id, full_name, email, avatar_url)')
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
        gradient="from-primary via-primary/80 to-teal-500"
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
          { label: 'Daily target', value: p.daily_target_amount ?? p.daily_target_lines ?? '—', icon: Target, tone: 'amber' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={User} title="Personal information" tone="primary">
          <InfoRow icon={User} label="Full name" value={p.full_name} />
          <InfoRow icon={IdCard} label="Student ID" value={p.registration_id} />
          <InfoRow icon={Mail} label="Email address" value={p.email} />
          <InfoRow icon={Phone} label="Phone number" value={p.whatsapp_number} />
          <InfoRow icon={User} label="Gender" value={p.gender ? <span className="capitalize">{p.gender}</span> : null} />
          <InfoRow icon={CalendarDays} label="Date of birth" value={fmtDate(p.date_of_birth) ?? (p.age ? `${p.age} years` : null)} />
          <InfoRow icon={MapPin} label="Address" value={[p.address, p.city, p.country].filter(Boolean).join(', ')} />
          <InfoRow icon={Globe} label="Timezone" value={p.timezone} />
        </InfoCard>

        <InfoCard icon={GraduationCap} title="Academic information" tone="teal">
          <InfoRow icon={CalendarDays} label="Enrolled on" value={fmtDate(p.created_at)} />
          <InfoRow icon={BookOpen} label="Mushaf / unit" value={[p.mushaf_type, p.preferred_unit].filter(Boolean).join(' • ')} />
          <InfoRow icon={Target} label="Daily target" value={p.daily_target_amount ?? p.daily_target_lines} />
          <InfoRow icon={Languages} label="Arabic level" value={p.arabic_level} />
          <InfoRow icon={Languages} label="Preferred language" value={p.preferred_language ?? p.first_language} />
          <InfoRow icon={ShieldCheck} label="Account status" value={<StatusBadge ok={(p.account_status ?? 'active') === 'active'} label={p.account_status ?? 'Active'} />} />
        </InfoCard>

        <InfoCard icon={Users} title="Guardians & parents" tone="violet">
          {data!.links.length === 0 ? (
            <EmptyState icon={Users} title="No guardian linked" hint="Link a parent from the Parents page." />
          ) : (
            data!.links.map((l: any) => (
              <div key={l.parent_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link to={`/parent-profile/${l.parent_id}`} className="text-sm font-medium text-foreground hover:underline">
                    {l.parent?.full_name ?? 'Unnamed'}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{l.parent?.email ?? '—'}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{l.relationship ?? 'guardian'}</Badge>
              </div>
            ))
          )}
          <InfoRow icon={Phone} label="Emergency contact" value={[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(' • ')} />
        </InfoCard>

        <InfoCard icon={GraduationCap} title="Teachers & subjects" tone="amber">
          {teachers.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No active assignment" hint="Assign a teacher from the Assignments page." />
          ) : (
            teachers.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.subject?.name ?? 'Subject'}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.teacher?.full_name ?? 'Unassigned'}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDate(a.start_date) ?? ''}</span>
              </div>
            ))
          )}
        </InfoCard>

        <InfoCard icon={HeartPulse} title="Learning & wellbeing" tone="rose">
          <InfoRow label="Learning goals" value={p.learning_goals} />
          <InfoRow label="Special needs / notes" value={p.special_needs} />
          <InfoRow label="How they heard about us" value={p.hear_about_us} />
        </InfoCard>
      </div>
    </div>
  );
}
