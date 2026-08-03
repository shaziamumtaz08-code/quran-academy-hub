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
  BadgeCheck, CalendarDays, Clock, Globe, GraduationCap, IdCard, Mail, MapPin,
  MessageSquare, Phone, Settings2, ShieldCheck, User, Users,
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

export default function ParentProfile() {
  const { parentId: paramId } = useParams<{ parentId: string }>();
  const { profile: me, isSuperAdmin, hasRole, isLoading: authLoading } = useAuth();
  const parentId = paramId ?? me?.id;
  const queryClient = useQueryClient();
  const canAdmin = !!(isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const canEditPhoto = !!(parentId === me?.id || isSuperAdmin || hasRole('admin') || hasRole('super_admin'));
  const { onAvatarSelect, uploading: avatarUploading } = useProfileAvatar(parentId, () =>
    queryClient.invalidateQueries({ queryKey: ['parent-profile-page', parentId] }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-profile-page', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      let profile: any = null;
      const full = await supabase.from('profiles').select(PROFILE_SAFE_COLUMNS).eq('id', parentId!).maybeSingle();
      if (full.error) {
        const basic = await supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, avatar_url, created_at, account_status, registration_id, guardian_type, timezone')
          .eq('id', parentId!)
          .maybeSingle();
        if (basic.error) throw basic.error;
        profile = basic.data;
      } else {
        profile = full.data;
      }

      const { data: links } = await supabase
        .from('student_parent_links')
        .select('student_id, relationship, student:profiles!student_parent_links_student_id_fkey(id, full_name, email, avatar_url, registration_id)')
        .eq('parent_id', parentId!);

      return { profile, children: links ?? [] };
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
          {error ? 'Could not load this parent' : 'Parent profile not found'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {(error as any)?.message ?? 'No profile exists for this parent, or you do not have permission to view it.'}
        </p>
        <Button asChild variant="outline" size="sm"><Link to="/parents">Back to parents</Link></Button>
      </div>
    );
  }

  const children = data!.children;

  return (
    <div className="space-y-5 animate-fade-in">
      <BackLink to="/parents" label="Back to all parents" />

      <ProfileHero
        name={p.full_name ?? 'Unnamed parent'}
        avatarUrl={p.avatar_url}
        onAvatarSelect={canEditPhoto ? onAvatarSelect : undefined}
        avatarUploading={avatarUploading}
        gradient="from-violet-600 via-violet-500 to-primary"
        badges={
          <>
            <Badge variant="outline" className="text-[10px] capitalize">{p.guardian_type ?? 'parent'}</Badge>
            {p.gov_id_verified && (
              <Badge variant="secondary" className="gap-1 text-[10px]"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
            )}
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
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdvancedOpen((v) => !v)}>
                <Settings2 className="h-3.5 w-3.5" /> {advancedOpen ? 'Hide all fields' : 'All fields'}
              </Button>
            )}
            {p.email && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={`mailto:${p.email}`}><Mail className="h-3.5 w-3.5" /> Send email</a>
              </Button>
            )}
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/communication"><MessageSquare className="h-3.5 w-3.5" /> Message</Link>
            </Button>
          </>
        }
      />

      <StatTiles
        stats={[
          { label: 'Children linked', value: children.length, icon: Users, tone: 'violet' },
          { label: 'With us for', value: monthsSince(p.created_at), icon: Clock, tone: 'teal' },
          { label: 'Relationship', value: <span className="capitalize">{p.guardian_type ?? 'parent'}</span>, icon: User, tone: 'primary' },
          { label: 'Account', value: <span className="capitalize">{p.account_status ?? 'active'}</span>, icon: ShieldCheck, tone: 'amber' },
        ]}
      />

      {advancedOpen && canAdmin && parentId && <ProfileEditorPanel userId={parentId} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={User} title="Personal information" tone="violet">
          <InfoRow icon={User} label="Full name" value={p.full_name} />
          <InfoRow icon={Mail} label="Email address" value={p.email} />
          <InfoRow icon={Phone} label="Phone number" value={p.whatsapp_number} />
          <InfoRow icon={CalendarDays} label="Date of birth" value={fmtDate(p.date_of_birth)} />
          <InfoRow icon={User} label="Gender" value={p.gender ? <span className="capitalize">{p.gender}</span> : null} />
          <InfoRow icon={MapPin} label="Address" value={[p.address, p.city, p.country].filter(Boolean).join(', ')} />
          <InfoRow icon={Globe} label="Timezone" value={p.timezone} />
        </InfoCard>

        <InfoCard icon={ShieldCheck} title="Account information" tone="primary">
          <InfoRow icon={IdCard} label="Parent ID" value={p.registration_id} />
          <InfoRow icon={CalendarDays} label="Added on" value={fmtDate(p.created_at)} />
          <InfoRow icon={ShieldCheck} label="Account status" value={<StatusBadge ok={(p.account_status ?? 'active') === 'active'} label={p.account_status ?? 'Active'} />} />
          <InfoRow icon={Mail} label="Preferred contact" value={p.preferred_contact_method} />
          <InfoRow icon={Globe} label="Preferred language" value={p.preferred_language} />
        </InfoCard>

        <div className="lg:col-span-2">
          <InfoCard
            icon={GraduationCap}
            title="Linked children"
            tone="teal"
            action={<Badge variant="secondary" className="text-[10px]">{children.length} student{children.length === 1 ? '' : 's'}</Badge>}
          >
            {children.length === 0 ? (
              <EmptyState icon={Users} title="No students linked" hint="Link students to this parent from the Parents page." />
            ) : (
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {children.map((c: any) => (
                  <Link
                    key={c.student_id}
                    to={`/student-profile/${c.student_id}`}
                    className="rounded-xl border bg-background p-4 hover:border-primary/50 hover:shadow-sm transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                        {c.student?.avatar_url ? (
                          <img src={c.student.avatar_url} alt={`${c.student?.full_name} photo`} className="h-full w-full object-cover" />
                        ) : (
                          <GraduationCap className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.student?.full_name ?? 'Unnamed'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.student?.registration_id ?? c.student?.email ?? '—'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="mt-3 text-[10px] capitalize">{c.relationship ?? 'guardian'}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </InfoCard>
        </div>
      </div>
    </div>
  );
}
