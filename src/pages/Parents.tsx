import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ShieldAlert, ShieldCheck, Mail, Users as UsersIcon, KeyRound, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ParentRow {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
  created_at: string;
  hasAuth: boolean;
  childrenCount: number;
  lastSignInAt: string | null;
}

export default function Parents() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const { data: parents, isLoading } = useQuery({
    queryKey: ['parents-activation-panel'],
    queryFn: async (): Promise<ParentRow[]> => {
      // 1. Get all parent role users
      const { data: roles, error: rErr } = await supabase
        .from('user_roles').select('user_id').eq('role', 'parent');
      if (rErr) throw rErr;
      const parentIds = Array.from(new Set((roles || []).map(r => r.user_id)));
      if (parentIds.length === 0) return [];

      // 2. Profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number, created_at')
        .in('id', parentIds)
        .is('archived_at', null);

      // 3. Children count
      const { data: links } = await supabase
        .from('student_parent_links').select('parent_id, student_id').in('parent_id', parentIds);
      const childCount = new Map<string, number>();
      (links || []).forEach(l => childCount.set(l.parent_id, (childCount.get(l.parent_id) || 0) + 1));

      // 4. Auth status + last sign in via edge function
      let authStatus: Record<string, { hasAuth: boolean; lastSignInAt: string | null }> = {};
      try {
        const { data, error } = await supabase.functions.invoke('check-parent-auth-status', {
          body: { profile_ids: parentIds },
        });
        if (!error && data) authStatus = data as any;
      } catch (e) {
        // Fallback: assume unknown -> use simple existence check via check-auth-status
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

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        whatsapp_number: p.whatsapp_number,
        created_at: p.created_at,
        hasAuth: authStatus[p.id]?.hasAuth ?? false,
        childrenCount: childCount.get(p.id) || 0,
        lastSignInAt: authStatus[p.id]?.lastSignInAt ?? null,
      })).sort((a, b) => {
        if (a.hasAuth !== b.hasAuth) return a.hasAuth ? 1 : -1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
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
      qc.invalidateQueries({ queryKey: ['parents-activation-panel'] });
    },
    onError: (e: any) => {
      toast({ title: 'Activation failed', description: e?.message || 'Try again', variant: 'destructive' });
    },
    onSettled: () => setActivatingId(null),
  });

  const filtered = useMemo(() => {
    if (!parents) return [];
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.whatsapp_number || '').toLowerCase().includes(q)
    );
  }, [parents, search]);

  const flaggedCount = parents?.filter(p => !p.hasAuth).length || 0;
  const activeCount = parents?.filter(p => p.hasAuth).length || 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parent Login Activation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage login access for parent profiles. Migrated parents may lack auth accounts.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-700">
            {activeCount} Active
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-bold text-destructive">
            {flaggedCount} Need Login
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No parent profiles found.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground">{p.full_name || 'Unnamed'}</span>
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
                  {p.whatsapp_number && <span>{p.whatsapp_number}</span>}
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
                  onClick={() => {
                    setActivatingId(p.id);
                    activateMutation.mutate(p.id);
                  }}
                  className="gap-1"
                >
                  {activatingId === p.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <KeyRound className="w-3 h-3" />
                  )}
                  Create Login
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
