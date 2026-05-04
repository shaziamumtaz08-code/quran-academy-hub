import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  User, Mail, Shield, Users as UsersIcon, GraduationCap, FileText,
  Activity, KeyRound, Loader2, Upload, Download, CheckCircle2, XCircle,
  AlertTriangle, Calendar, Save, RefreshCw, Link2, Unlink, Eye,
} from 'lucide-react';
import { LinkGuardianDialog } from './LinkGuardianDialog';
import type { AppRole } from '@/contexts/AuthContext';

/* ── Per-tab access matrix. V=view, C=create, E=edit, D=delete (we treat C/E/D collectively as "write"). ── */
type TabAccess = 'none' | 'view' | 'write';
type TabKey = 'personal' | 'contact' | 'identity' | 'guardian' | 'academic' | 'documents' | 'activity' | 'password';

const TAB_ACCESS: Record<TabKey, Partial<Record<AppRole, TabAccess>>> = {
  personal:  { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'view', admin_academic: 'view' },
  contact:   { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'view' },
  identity:  { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'view' },
  guardian:  { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'write' },
  academic:  { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'view', admin_academic: 'write' },
  documents: { super_admin: 'write', admin: 'write', admin_division: 'write', admin_admissions: 'view' },
  activity:  { super_admin: 'write', admin: 'write', admin_division: 'write' },
  password:  { super_admin: 'write' },
};

function tabAccessFor(role: AppRole | null | undefined, key: TabKey): TabAccess {
  if (!role) return 'none';
  return TAB_ACCESS[key][role] ?? 'none';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function pct(profile: any): number {
  if (!profile) return 0;
  const fields = [
    'full_name', 'email', 'whatsapp_number', 'date_of_birth', 'gender',
    'country', 'city', 'nationality', 'first_language', 'arabic_level',
    'gov_id_number', 'gov_id_type', 'avatar_url', 'guardian_type',
  ];
  const filled = fields.filter(f => profile[f] != null && profile[f] !== '').length;
  return Math.round((filled / fields.length) * 100);
}

export function HolisticUserProfileDrawer({ open, onOpenChange, userId }: Props) {
  const { isSuperAdmin: isSA, user: currentUser, activeRole } = useAuth();
  const isSuperAdmin = isSA || activeRole === 'admin_division' || activeRole === 'admin';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('personal');
  const [form, setForm] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<'avatar' | 'gov_id' | null>(null);
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);

  // Profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['holistic-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!userId && open,
  });

  // Roles
  const { data: roles = [] } = useQuery({
    queryKey: ['holistic-roles', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
      return (data || []).map((r: any) => r.role);
    },
    enabled: !!userId && open,
  });

  // Linked parent (for guardian tab)
  const { data: parentLink } = useQuery({
    queryKey: ['holistic-parent', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('student_parent_links')
        .select('id, parent_id, relationship, profile:profiles!student_parent_links_parent_id_fkey(id, full_name, email, whatsapp_number)')
        .eq('student_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!userId && open,
  });

  // Sibling check (shared email)
  const { data: siblings = [] } = useQuery({
    queryKey: ['holistic-siblings', userId, profile?.email],
    queryFn: async () => {
      if (!userId || !profile?.email) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', profile.email)
        .neq('id', userId);
      return data || [];
    },
    enabled: !!userId && !!profile?.email && open,
  });

  // Enrollments
  const { data: enrollments = [] } = useQuery({
    queryKey: ['holistic-enrollments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('course_enrollments')
        .select('id, status, enrolled_at, course:course_id(name)')
        .eq('student_id', userId);
      return data || [];
    },
    enabled: !!userId && open,
  });

  // Assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['holistic-assignments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, status, teacher:teacher_id(full_name), subject:subject_id(name)')
        .eq('student_id', userId);
      return data || [];
    },
    enabled: !!userId && open,
  });

  // Attendance summary
  const { data: attendanceStats } = useQuery({
    queryKey: ['holistic-attendance', userId],
    queryFn: async () => {
      if (!userId) return { total: 0, present: 0, absent: 0 };
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', userId);
      const rows = data || [];
      return {
        total: rows.length,
        present: rows.filter((r: any) => r.status === 'present').length,
        absent: rows.filter((r: any) => r.status === 'absent').length,
      };
    },
    enabled: !!userId && open,
  });

  // Activity logs
  const { data: logs = [] } = useQuery({
    queryKey: ['holistic-logs', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('system_logs' as any)
        .select('*')
        .or(`user_id.eq.${userId},target_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!userId && open,
  });

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const computedAge = useMemo(() => {
    return form.date_of_birth ? calcAge(form.date_of_birth) : profile?.age || null;
  }, [form.date_of_birth, profile?.age]);

  const isMinor = (computedAge ?? 99) < 17;
  const hasSharedSiblings = siblings.length > 0;
  const requiresGuardian = isMinor || hasSharedSiblings;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const payload = {
        full_name: form.full_name,
        display_name: form.display_name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        avatar_url: form.avatar_url,
        nationality: form.nationality,
        first_language: form.first_language,
        arabic_level: form.arabic_level,
        hear_about_us: form.hear_about_us,
        special_needs: form.special_needs,
        learning_goals: form.learning_goals,
        email: form.email,
        whatsapp_number: form.whatsapp_number,
        phone: form.phone,
        country: form.country,
        city: form.city,
        timezone: form.timezone,
        preferred_contact_method: form.preferred_contact_method,
        preferred_language: form.preferred_language,
        gov_id_type: form.gov_id_type,
        gov_id_number: form.gov_id_number,
        gov_id_doc: form.gov_id_doc,
        gov_id_verified: form.gov_id_verified,
        account_status: form.account_status,
        guardian_type: form.guardian_type,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        force_password_reset: form.force_password_reset,
        age: computedAge,
        ...(form.gov_id_verified && !profile?.gov_id_verified ? {
          gov_id_verified_by: currentUser?.id,
          gov_id_verified_at: new Date().toISOString(),
        } : {}),
      };
      const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Profile saved' });
      qc.invalidateQueries({ queryKey: ['holistic-profile', userId] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const uploadFile = async (file: File, bucket: string, kind: 'avatar' | 'gov_id') => {
    if (!userId) return;
    setUploading(kind);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      setForm((f) => ({ ...f, [kind === 'avatar' ? 'avatar_url' : 'gov_id_doc']: urlData.publicUrl }));
      toast({ title: 'Uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const sendPasswordReset = async () => {
    if (!form.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(form.email);
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Reset email sent' });
  };

  const setNewPassword = async () => {
    if (!userId || !form.new_password) return;
    if (form.new_password.length < 6) {
      toast({ title: 'Failed', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('reset-single-password', {
        body: { userId, password: form.new_password },
      });
      if (error) throw error;
      toast({ title: 'Password updated' });
      setForm((f) => ({ ...f, new_password: '' }));
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const removeGuardianLink = async () => {
    if (!parentLink?.id) return;
    if (!confirm('Remove this guardian link? The guardian account itself will not be deleted.')) return;
    const { error } = await supabase.from('student_parent_links').delete().eq('id', parentLink.id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Guardian link removed' });
    qc.invalidateQueries({ queryKey: ['holistic-parent', userId] });
  };

  const initials = (form.full_name || 'U').split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  const completion = pct(form);

  // Per-tab access gating
  const ALL_TABS: { key: TabKey; label: string; Icon: any }[] = [
    { key: 'personal',  label: 'Personal',  Icon: User },
    { key: 'contact',   label: 'Contact',   Icon: Mail },
    { key: 'identity',  label: 'Identity',  Icon: Shield },
    { key: 'guardian',  label: 'Guardian',  Icon: UsersIcon },
    { key: 'academic',  label: 'Academic',  Icon: GraduationCap },
    { key: 'documents', label: 'Docs',      Icon: FileText },
    { key: 'activity',  label: 'Activity',  Icon: Activity },
    { key: 'password',  label: 'Password',  Icon: KeyRound },
  ];
  const effectiveRole: AppRole | null | undefined = activeRole || (isSuperAdmin ? 'super_admin' : activeRole);
  const visibleTabs = ALL_TABS.filter(t => tabAccessFor(effectiveRole, t.key) !== 'none');
  const currentTabAccess = tabAccessFor(effectiveRole, tab);
  const canSaveCurrentTab = currentTabAccess === 'write';

  // If current tab not visible, snap to first visible
  useEffect(() => {
    if (!visibleTabs.find(t => t.key === tab) && visibleTabs.length > 0) {
      setTab(visibleTabs[0].key);
    }
  }, [effectiveRole, visibleTabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Early return AFTER all hooks to preserve hook order (fixes React error #310)
  if (!userId) return null;


  // Shared-email detection for guardian banner (parent and student profiles share email)
  const guardianSharesEmail = !!(parentLink?.profile?.email && profile?.email &&
    parentLink.profile.email.trim().toLowerCase() === profile.email.trim().toLowerCase());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[80vw] sm:w-[80vw] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={form.avatar_url} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl truncate">{form.full_name || 'User Profile'}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  {roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  {profile?.registration_id && <span className="text-xs font-mono">{profile.registration_id}</span>}
                  <Badge variant="outline" className="text-xs">{completion}% complete</Badge>
                </SheetDescription>
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !canSaveCurrentTab}
                className="gap-2"
                title={!canSaveCurrentTab ? 'Read-only — your role cannot edit this tab' : undefined}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </SheetHeader>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visibleTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold mb-1">Access denied</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              You do not have permission to view this user's profile.
              {!effectiveRole && ' Your active role is still loading — please try again in a moment.'}
            </p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="px-6 py-4">
            <TabsList
              className="mb-4 h-auto grid"
              style={{ gridTemplateColumns: `repeat(${Math.min(visibleTabs.length, 8)}, minmax(0, 1fr))` }}
            >
              {visibleTabs.map(({ key, label, Icon }) => (
                <TabsTrigger key={key} value={key} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {currentTabAccess === 'view' && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <Eye className="h-3.5 w-3.5" />
                <span>Read-only — your role can view this tab but cannot make changes.</span>
              </div>
            )}

            {/* All TabsContent inside a fieldset so we can disable inputs/buttons on view-only without changing markup */}
            <fieldset disabled={!canSaveCurrentTab} className="contents">

            {/* PERSONAL */}
            <TabsContent value="personal" className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={form.avatar_url} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <Label className="text-xs">Profile Photo</Label>
                  <div className="mt-1">
                    <input type="file" accept="image/*" id="avatar-up" className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'registration-uploads', 'avatar')} />
                    <Button asChild variant="outline" size="sm" disabled={uploading === 'avatar'}>
                      <label htmlFor="avatar-up" className="cursor-pointer gap-2">
                        {uploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload
                      </label>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Full Name"><Input value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
                <Field label="Display Name"><Input value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></Field>
                <Field label="Date of Birth"><Input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></Field>
                <Field label="Age (auto)"><Input value={computedAge ?? ''} disabled /></Field>
                <Field label="Gender">
                  <Select value={form.gender || ''} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Nationality"><Input value={form.nationality || ''} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></Field>
                <Field label="First Language"><Input value={form.first_language || ''} onChange={(e) => setForm({ ...form, first_language: e.target.value })} /></Field>
                <Field label="Arabic Level">
                  <Select value={form.arabic_level || ''} onValueChange={(v) => setForm({ ...form, arabic_level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="How did you hear about us"><Input value={form.hear_about_us || ''} onChange={(e) => setForm({ ...form, hear_about_us: e.target.value })} /></Field>
              </div>
              <Field label="Special Needs / Accommodations"><Textarea rows={2} value={form.special_needs || ''} onChange={(e) => setForm({ ...form, special_needs: e.target.value })} /></Field>
              <Field label="Learning Goals"><Textarea rows={3} value={form.learning_goals || ''} onChange={(e) => setForm({ ...form, learning_goals: e.target.value })} /></Field>
            </TabsContent>

            {/* CONTACT */}
            <TabsContent value="contact" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="WhatsApp"><Input value={form.whatsapp_number || ''} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} /></Field>
                <Field label="Phone (alternate)"><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Country"><Input value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
                <Field label="City"><Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
                <Field label="Timezone"><Input value={form.timezone || ''} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></Field>
                <Field label="Preferred Contact Method">
                  <Select value={form.preferred_contact_method || ''} onValueChange={(v) => setForm({ ...form, preferred_contact_method: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preferred Language"><Input value={form.preferred_language || ''} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })} /></Field>
              </div>
            </TabsContent>

            {/* IDENTITY */}
            <TabsContent value="identity" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="ID Type">
                  <Select value={form.gov_id_type || ''} onValueChange={(v) => setForm({ ...form, gov_id_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNIC">CNIC</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="Iqama">Iqama</SelectItem>
                      <SelectItem value="NID">NID</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ID Number"><Input value={form.gov_id_number || ''} onChange={(e) => setForm({ ...form, gov_id_number: e.target.value })} /></Field>
                <Field label="Account Status">
                  <Select value={form.account_status || 'active'} onValueChange={(v) => setForm({ ...form, account_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {isSuperAdmin && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">ID Verified</Label>
                    <p className="text-xs text-muted-foreground">Admin only — marks government ID as verified</p>
                  </div>
                  <Switch checked={!!form.gov_id_verified} onCheckedChange={(v) => setForm({ ...form, gov_id_verified: v })} />
                </div>
              )}
            </TabsContent>

            {/* GUARDIAN */}
            <TabsContent value="guardian" className="space-y-4">
              {/* Shared-email warning (parent and student use the same login) */}
              {guardianSharesEmail && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This parent shares login credentials with the student. A separate parent account is recommended.
                  </p>
                </div>
              )}

              {/* No guardian linked — info banner suggesting upload (only when student needs one) */}
              {!parentLink && (requiresGuardian || form.guardian_type === 'parent' || form.guardian_type === 'guardian') && (
                <div className="rounded-lg border border-sky-300 bg-sky-50 dark:bg-sky-950/30 p-3 flex items-start gap-2">
                  <UsersIcon className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-sky-800 dark:text-sky-200">
                    No guardian linked. Upload the parent data file in this tab to create and link a guardian account.
                  </p>
                </div>
              )}

              <Field label="Guardian Type">
                <Select value={form.guardian_type || ''} onValueChange={(v) => setForm({ ...form, guardian_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — adult self-learner</SelectItem>
                    <SelectItem value="parent">Parent (linked account)</SelectItem>
                    <SelectItem value="guardian">Guardian (non-parent)</SelectItem>
                    <SelectItem value="emergency_contact">Emergency Contact Only</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {!parentLink && !requiresGuardian && form.guardian_type !== 'parent' && form.guardian_type !== 'guardian' ? (
                <>
                  <div className="rounded-lg border bg-muted/40 p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium">Self Learner — No Guardian Required</p>
                      <p className="text-xs text-muted-foreground">Adult learner (17+) with no shared sibling email.</p>
                    </div>
                  </div>
                  <Separator />
                  <p className="text-sm font-medium">Emergency Contact (optional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Name"><Input value={form.emergency_contact_name || ''} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></Field>
                    <Field label="Phone"><Input value={form.emergency_contact_phone || ''} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></Field>
                  </div>
                </>
              ) : (
                <>
                  {parentLink ? (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{parentLink.profile?.full_name || 'Guardian'}</p>
                            <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                              <Link2 className="h-3 w-3" /> Linked
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {parentLink.profile?.email || '—'}
                            {parentLink.profile?.whatsapp_number ? ` · ${parentLink.profile.whatsapp_number}` : ''}
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {parentLink.relationship || 'Guardian'}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => setGuardianDialogOpen(true)}>
                            Change Guardian
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={removeGuardianLink}>
                            <Unlink className="h-3.5 w-3.5" /> Remove Link
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="text-sm font-medium">No Guardian Linked</p>
                          <p className="text-xs text-muted-foreground">Minor or shared-email student requires a guardian.</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setGuardianDialogOpen(true)}>Create Guardian Account</Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ACADEMIC */}
            <TabsContent value="academic" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="UID/Roll No" value={profile?.registration_id || '—'} mono />
                <Stat label="Join Date" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
                <Stat label="Attendance" value={attendanceStats ? `${attendanceStats.present}/${attendanceStats.total}` : '—'} />
                <Stat label="Status" value={profile?.account_status || 'active'} />
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Enrolled Courses ({enrollments.length})</p>
                <div className="space-y-1">
                  {enrollments.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                  {enrollments.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span>{e.course?.name || 'Course'}</span>
                      <Badge variant={e.status === 'active' ? 'default' : 'secondary'}>{e.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Teacher Assignments ({assignments.length})</p>
                <div className="space-y-1">
                  {assignments.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                  {assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span>{a.teacher?.full_name || 'Teacher'} · {a.subject?.name || 'Subject'}</span>
                      <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* DOCUMENTS */}
            <TabsContent value="documents" className="space-y-3">
              {!isSuperAdmin ? (
                <p className="text-sm text-muted-foreground">Admin-only section.</p>
              ) : (
                <>
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Government ID Document</p>
                        <p className="text-xs text-muted-foreground">{form.gov_id_type || '—'} · {form.gov_id_number || '—'}</p>
                      </div>
                      {form.gov_id_doc && (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <a href={form.gov_id_doc} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Download</a>
                        </Button>
                      )}
                    </div>
                    <input type="file" id="govid-up" className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'identity-documents', 'gov_id')} />
                    <Button asChild variant="outline" size="sm" disabled={uploading === 'gov_id'}>
                      <label htmlFor="govid-up" className="cursor-pointer gap-2">
                        {uploading === 'gov_id' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload New
                      </label>
                    </Button>
                  </div>
                  <div className="rounded-lg border p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {form.gov_id_verified ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium">{form.gov_id_verified ? 'Verified' : 'Unverified'}</p>
                        {profile?.gov_id_verified_at && (
                          <p className="text-xs text-muted-foreground">
                            Verified {new Date(profile.gov_id_verified_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch checked={!!form.gov_id_verified} onCheckedChange={(v) => setForm({ ...form, gov_id_verified: v })} />
                  </div>
                </>
              )}
            </TabsContent>

            {/* ACTIVITY */}
            <TabsContent value="activity" className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Account Created" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
                <Stat label="Profile Completion" value={`${completion}%`} />
                <Stat label="Total Logs" value={String(logs.length)} />
              </div>
              <Separator />
              <p className="text-sm font-semibold">Activity Timeline</p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {logs.length === 0 && <p className="text-xs text-muted-foreground">No activity recorded</p>}
                {logs.map((l: any) => (
                  <div key={l.id} className="rounded border px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{l.action || l.event_type}</span>
                      <span className="text-muted-foreground">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
                    </div>
                    {l.description && <p className="text-muted-foreground mt-0.5">{l.description}</p>}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* PASSWORD */}
            <TabsContent value="password" className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Send Password Reset Email</p>
                <p className="text-xs text-muted-foreground">Sends a reset link to {form.email}</p>
                <Button onClick={sendPasswordReset} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />Send Reset Email
                </Button>
              </div>
              {isSuperAdmin && (
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Set New Password (Admin)</p>
                  <Input type="password" placeholder="New password (min 6 characters)" value={form.new_password || ''} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
                  <Button onClick={setNewPassword} disabled={!form.new_password} className="gap-2">
                    <KeyRound className="h-4 w-4" />Update Password
                  </Button>
                </div>
              )}
              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <Label className="text-sm">Force Password Reset on Next Login</Label>
                  <p className="text-xs text-muted-foreground">User will be required to change password</p>
                </div>
                <Switch checked={!!form.force_password_reset} onCheckedChange={(v) => setForm({ ...form, force_password_reset: v })} />
              </div>
            </TabsContent>
            </fieldset>
          </Tabs>
        )}
      </SheetContent>
      {userId && (
        <LinkGuardianDialog
          open={guardianDialogOpen}
          onOpenChange={setGuardianDialogOpen}
          studentId={userId}
          studentName={form.full_name || profile?.full_name || 'Student'}
        />
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
