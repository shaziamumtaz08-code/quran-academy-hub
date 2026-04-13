import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DuplicateProfileMerge } from '@/components/admin/DuplicateProfileMerge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Users, Link2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DuplicateGroup {
  email: string;
  profiles: Array<{
    id: string;
    full_name: string;
    registration_id: string | null;
    roles: string[];
    created_at: string;
  }>;
}

export default function IdentityResolution() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'duplicates' | 'unregistered' | 'search'>('duplicates');

  // Find profiles sharing the same email (potential duplicates)
  const { data: duplicates, isLoading: loadingDupes } = useQuery({
    queryKey: ['identity-duplicates'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, registration_id, created_at')
        .not('email', 'is', null)
        .order('email');

      if (!profiles?.length) return [];

      // Get roles for all profiles
      const profileIds = profiles.map(p => p.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds);

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      // Group by email
      const emailGroups = new Map<string, DuplicateGroup['profiles']>();
      for (const p of profiles) {
        if (!p.email) continue;
        const key = p.email.toLowerCase();
        const existing = emailGroups.get(key) || [];
        existing.push({
          id: p.id,
          full_name: p.full_name || 'Unknown',
          registration_id: p.registration_id,
          roles: roleMap.get(p.id) || [],
          created_at: p.created_at,
        });
        emailGroups.set(key, existing);
      }

      // Only keep groups with 2+ profiles (actual duplicates)
      const results: DuplicateGroup[] = [];
      emailGroups.forEach((profiles, email) => {
        if (profiles.length > 1) {
          results.push({ email, profiles });
        }
      });

      return results;
    },
  });

  // Profiles without registration IDs
  const { data: unregistered, isLoading: loadingUnreg } = useQuery({
    queryKey: ['identity-unregistered'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, created_at')
        .is('registration_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data?.length) return [];

      const profileIds = data.map(p => p.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds);

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      return data.map(p => ({
        ...p,
        roles: roleMap.get(p.id) || [],
      }));
    },
  });

  // Search profiles
  const { data: searchResults } = useQuery({
    queryKey: ['identity-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, registration_id, created_at')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,registration_id.ilike.%${searchTerm}%`)
        .limit(20);

      if (!data?.length) return [];

      const profileIds = data.map(p => p.id);
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', profileIds);

      const roleMap = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      return data.map(p => ({
        ...p,
        roles: roleMap.get(p.id) || [],
      }));
    },
    enabled: searchTerm.length >= 2,
  });

  // Generate registration IDs for profiles missing them
  const generateIdMutation = useMutation({
    mutationFn: async (profileId: string) => {
      // Get profile details + roles to determine org/branch/role codes
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', profileId)
        .single();

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profileId);

      const primaryRole = roles?.[0]?.role || 'student';
      const roleCode = primaryRole === 'teacher' ? 'TCH' : primaryRole === 'parent' ? 'PAR' : primaryRole === 'admin' ? 'ADM' : 'STU';

      const { data: regId, error } = await supabase.rpc('generate_registration_id', {
        _org_code: 'AQT',
        _branch_code: 'ONL',
        _role_code: roleCode,
      });

      if (error) throw error;

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ registration_id: regId })
        .eq('id', profileId);

      if (updateErr) throw updateErr;

      return regId;
    },
    onSuccess: (regId) => {
      toast({ title: 'ID Generated', description: `Registration ID: ${regId}` });
      queryClient.invalidateQueries({ queryKey: ['identity-unregistered'] });
      queryClient.invalidateQueries({ queryKey: ['identity-search'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const TABS = [
    { id: 'duplicates' as const, label: 'Duplicates', icon: AlertTriangle, count: duplicates?.length || 0 },
    { id: 'unregistered' as const, label: 'No URN', icon: Link2, count: unregistered?.length || 0 },
    { id: 'search' as const, label: 'Search', icon: Search, count: 0 },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-black text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Identity Resolution
            </h1>
            <p className="text-xs text-muted-foreground">Manage URNs, detect duplicates, and resolve identity conflicts</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="bg-destructive/20 text-destructive text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or registration ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchResults?.length ? (
              <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                {searchResults.map(p => (
                  <div key={p.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{p.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.email}</p>
                      <div className="flex gap-1 mt-1">
                        {p.roles.map(r => (
                          <span key={r} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{r}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      {p.registration_id ? (
                        <span className="text-[11px] font-mono bg-teal/10 text-teal px-2 py-1 rounded-lg">{p.registration_id}</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateIdMutation.mutate(p.id)}
                          disabled={generateIdMutation.isPending}
                          className="text-[10px] h-7"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Generate URN
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchTerm.length >= 2 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No results found</p>
            ) : null}
          </div>
        )}

        {/* Duplicates Tab */}
        {activeTab === 'duplicates' && (
          <div className="space-y-3">
            {loadingDupes ? (
              <p className="text-xs text-muted-foreground text-center py-6">Scanning...</p>
            ) : (
              <>
                <DuplicateProfileMerge />
                {!duplicates?.length && (
                  <div className="bg-card rounded-xl border border-border p-8 text-center">
                    <CheckCircle className="w-8 h-8 text-teal mx-auto mb-2" />
                    <p className="text-sm font-bold text-foreground">No duplicates detected</p>
                    <p className="text-xs text-muted-foreground">All identities are unique</p>
                  </div>
                )}
                {duplicates?.map(group => (
                  <div key={group.email} className="bg-card rounded-xl border border-destructive/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <p className="text-xs font-bold text-foreground">{group.email}</p>
                      <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-bold">
                        {group.profiles.length} profiles
                      </span>
                    </div>
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {group.profiles.map(p => (
                        <div key={p.id} className="px-3 py-2 flex items-center justify-between bg-background">
                          <div>
                            <p className="text-[13px] font-bold">{p.full_name}</p>
                            <div className="flex gap-1 mt-0.5">
                              {p.roles.map(r => (
                                <span key={r} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{r}</span>
                              ))}
                            </div>
                          </div>
                          {p.registration_id ? (
                            <span className="text-[10px] font-mono bg-teal/10 text-teal px-2 py-0.5 rounded">{p.registration_id}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">No URN</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Unregistered Tab */}
        {activeTab === 'unregistered' && (
          <div className="space-y-3">
            {loadingUnreg ? (
              <p className="text-xs text-muted-foreground text-center py-6">Loading...</p>
            ) : !unregistered?.length ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <CheckCircle className="w-8 h-8 text-teal mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">All profiles have URNs</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      for (const p of unregistered) {
                        await generateIdMutation.mutateAsync(p.id);
                      }
                    }}
                    disabled={generateIdMutation.isPending}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Generate All URNs
                  </Button>
                </div>
                <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {unregistered.map(p => (
                    <div key={p.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{p.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.email || 'No email'}</p>
                        <div className="flex gap-1 mt-1">
                          {p.roles.map((r: string) => (
                            <span key={r} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{r}</span>
                          ))}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateIdMutation.mutate(p.id)}
                        disabled={generateIdMutation.isPending}
                        className="text-[10px] h-7"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Generate
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
