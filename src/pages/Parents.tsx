import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  ShieldAlert, ShieldCheck, Mail, Users as UsersIcon, KeyRound, Search, Loader2,
  AlertTriangle, UserCheck, Phone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type GuardianTypeFilter = 'all' | 'parent' | 'guardian' | 'emergency_contact' | 'no_guardian';

interface ParentRow {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  created_at: string;
  hasAuth: boolean;
  childrenCount: number;
  lastSignInAt: string | null;
  guardian_type: 'none' | 'parent' | 'guardian' | 'emergency_contact' | null;
}

interface MinorAtRisk {
  id: string;
  full_name: string | null;
  email: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
  registration_id: string | null;
}

export default function Parents() {
  const { isSuperAdmin: isSA, activeRole } = useAuth();
  const isSuperAdmin = isSA || activeRole === 'admin_division' || activeRole === 'admin';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [tab, setTab] = useState<GuardianTypeFilter>('all');

  // Parents/guardians/emergency-contact profiles
  const { data: parents, isLoading } = useQuery({
    queryKey: ['parents-and-guardians-panel'],
    queryFn: async (): Promise<ParentRow[]> => {
      const { data: roles, error: rErr } = await supabase
        .from('user_roles').select('user_id').eq('role', 'parent');
      if (rErr) throw rErr;
      const parentIds = Array.from(new Set((roles || []).map(r => r.user_id)));
      if (parentIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number, created_at, guardian_type')
        .in('id', parentIds)
        .is('archived_at', null);

      const { data: links } = await supabase
        .from('student_parent_links').select('parent_id, student_id').in('parent_id', parentIds);
      const childCount = new Map<string, number>();
      (links || []).forEach(l => childCount.set(l.parent_id, (childCount.get(l.parent_id) || 0) + 1));

      let authStatus: Record<string, { hasAuth: boolean; lastSignInAt: string | null }> = {};
      try {
        const { data, error } = await supabase.functions.invoke('check-parent-auth-status', {
          body: { profile_ids: parentIds },
        });
        if (!error && data) authStatus = data as any;
      } catch {
        try {
          const { data } = await supabase.functions.invoke('check-auth-status', {
            body: { profile_ids: parentIds },
          });
          if (data && typeof data === 'object') {
            for (const id of parentIds) {
              authStatus[id] = { hasAuth: !!(data as any)[id], lastSignInAt: null };
            }
          }
        } catch {}
      }

      return (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        whatsapp_number: p.whatsapp_number,
        created_at: p.created_at,
        hasAuth: authStatus[p.id]?.hasAuth ?? false,
        childrenCount: childCount.get(p.id) || 0,
        lastSignInAt: authStatus[p.id]?.lastSignInAt ?? null,
        guardian_type: p.guardian_type ?? 'parent',
      })).sort((a, b) => {
        if (a.hasAuth !== b.hasAuth) return a.hasAuth ? 1 : -1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
    },
  });

  // Minors with no linked guardian (red flag)
  const { data: minorsAtRisk = [], isLoading: loadingMinors } = useQuery({
    queryKey: ['minors-at-risk'],
    queryFn: async (): Promise<MinorAtRisk[]> => {
      const { data: studentRoles } = await supabase
        .from('user_roles').select('user_id').eq('role', 'student');
      const studentIds = Array.from(new Set((studentRoles || []).map(r => r.user_id)));
      if (studentIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, age, city, country, registration_id, guardian_type')
        .in('id', studentIds)
        .is('archived_at', null)
        .lt('age', 17);

      const { data: links } = await supabase
        .from('student_parent_links').select('student_id').in('student_id', studentIds);
      const linkedSet = new Set((links || []).map(l => l.student_id));

      return (profiles || [])
        .filter((p: any) => !linkedSet.has(p.id) && p.guardian_type !== 'guardian' && p.guardian_type !== 'emergency_contact')
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          age: p.age,
          city: p.city,
          country: p.country,
          registration_id: p.registration_id,
        }));
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { data, error } = await supabase.functions.invoke('activate-parent-login', {
        body: { profile_id: profileId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { tempPassword: string; inviteSent: boolean };
    },
    onSuccess: (data) => {
      toast({
        title: 'Login activated',
        description: `Temp password: ${data.tempPassword}${data.inviteSent ? ' • Invite email sent' : ''}`,
      });
      qc.invalidateQueries({ queryKey: ['parents-and-guardians-panel'] });
    },
    onError: (e: any) => toast({ title: 'Activation failed', description: e?.message || 'Try again', variant: 'destructive' }),
    onSettled: () => setActivatingId(null),
  });

  const filtered = useMemo(() => {
    if (!parents) return [];
    const q = search.trim().toLowerCase();
    let list = parents;
    if (tab === 'parent') list = list.filter(p => (p.guardian_type ?? 'parent') === 'parent');
    else if (tab === 'guardian') list = list.filter(p => p.guardian_type === 'guardian');
    else if (tab === 'emergency_contact') list = list.filter(p => p.guardian_type === 'emergency_contact');
    if (!q) return list;
    return list.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.whatsapp_number || '').toLowerCase().includes(q),
    );
  }, [parents, search, tab]);

  const flaggedCount = parents?.filter(p => !p.hasAuth).length || 0;
  const activeCount = parents?.filter(p => p.hasAuth).length || 0;
  const parentCount = parents?.filter(p => (p.guardian_type ?? 'parent') === 'parent').length || 0;
  const guardianCount = parents?.filter(p => p.guardian_type === 'guardian').length || 0;
  const emergencyCount = parents?.filter(p => p.guardian_type === 'emergency_contact').length || 0;
  const minorAtRiskCount = minorsAtRisk.length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parents &amp; Guardians</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage parent/guardian profiles, login access, and minors needing guardian links.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700">
            {activeCount} Active
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">
            {flaggedCount} Need Login
          </div>
          {minorAtRiskCount > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {minorAtRiskCount} Minors at Risk
            </div>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as GuardianTypeFilter)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({parents?.length || 0})</TabsTrigger>
          <TabsTrigger value="parent">Parents ({parentCount})</TabsTrigger>
          <TabsTrigger value="guardian">Guardians ({guardianCount})</TabsTrigger>
          <TabsTrigger value="emergency_contact">Emergency Contacts ({emergencyCount})</TabsTrigger>
          <TabsTrigger value="no_guardian" className="gap-1.5 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
            <AlertTriangle className="w-3 h-3" />
            No Guardian ({minorAtRiskCount})
          </TabsTrigger>
        </TabsList>

        {tab !== 'no_guardian' && (
          <div className="relative max-w-md mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        <TabsContent value="all" className="mt-4"><GuardianList rows={filtered} isLoading={isLoading} isSuperAdmin={isSuperAdmin} activatingId={activatingId} onActivate={(id) => { setActivatingId(id); activateMutation.mutate(id); }} /></TabsContent>
        <TabsContent value="parent" className="mt-4"><GuardianList rows={filtered} isLoading={isLoading} isSuperAdmin={isSuperAdmin} activatingId={activatingId} onActivate={(id) => { setActivatingId(id); activateMutation.mutate(id); }} /></TabsContent>
        <TabsContent value="guardian" className="mt-4"><GuardianList rows={filtered} isLoading={isLoading} isSuperAdmin={isSuperAdmin} activatingId={activatingId} onActivate={(id) => { setActivatingId(id); activateMutation.mutate(id); }} /></TabsContent>
        <TabsContent value="emergency_contact" className="mt-4"><GuardianList rows={filtered} isLoading={isLoading} isSuperAdmin={isSuperAdmin} activatingId={activatingId} onActivate={(id) => { setActivatingId(id); activateMutation.mutate(id); }} /></TabsContent>

        <TabsContent value="no_guardian" className="mt-4 space-y-3">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-destructive font-medium">
              These minor students have no linked parent or guardian. Action required.
            </span>
          </div>
          {loadingMinors ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : minorsAtRisk.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <UserCheck className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
              All minors have a guardian linked. 
            </Card>
          ) : (
            <div className="space-y-2">
              {minorsAtRisk.map(m => (
                <Card key={m.id} className="p-4 border-l-4 border-l-destructive flex items-center gap-4 flex-wrap md:flex-nowrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{m.full_name || 'Unnamed'}</span>
                      {m.registration_id && (
                        <Badge variant="outline" className="text-[10px] font-mono">{m.registration_id}</Badge>
                      )}
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" /> Minor – No Guardian
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>Age: {m.age ?? '?'}</span>
                      {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</span>}
                      {(m.city || m.country) && <span>{[m.city, m.country].filter(Boolean).join(', ')}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/user-management?focus=${m.id}`}>Open Profile</a>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GuardianList({
  rows, isLoading, isSuperAdmin, activatingId, onActivate,
}: {
  rows: ParentRow[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  activatingId: string | null;
  onActivate: (id: string) => void;
}) {
  if (isLoading) {
    return <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }
  if (rows.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">No profiles found.</Card>;
  }
  return (
    <div className="space-y-2">
      {rows.map(p => (
        <Card key={p.id} className="p-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground">{p.full_name || 'Unnamed'}</span>
              <Badge variant="outline" className="capitalize text-[10px]">
                {(p.guardian_type || 'parent').replace('_', ' ')}
              </Badge>
              {p.hasAuth ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white gap-1">
                  <ShieldCheck className="w-3 h-3" /> Active
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="w-3 h-3" /> No Login Access
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {p.email || '—'}</span>
              {p.whatsapp_number && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.whatsapp_number}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted text-foreground">
            <UsersIcon className="w-3 h-3" />
            <span className="font-bold">{p.childrenCount}</span>
            <span className="text-muted-foreground">{p.childrenCount === 1 ? 'child' : 'children'}</span>
          </div>
          <div className="text-xs text-muted-foreground min-w-[110px]">
            <div className="font-semibold text-foreground">Last login</div>
            <div>{p.lastSignInAt ? format(new Date(p.lastSignInAt), 'MMM d, yyyy') : '—'}</div>
          </div>
          {!p.hasAuth && isSuperAdmin && (
            <Button
              size="sm"
              disabled={activatingId === p.id || !p.email}
              onClick={() => onActivate(p.id)}
              className="gap-1"
            >
              {activatingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
              Create Login
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
