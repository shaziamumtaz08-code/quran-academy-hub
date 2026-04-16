import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, CheckCircle2, XCircle, ShieldAlert, RefreshCw, Wrench } from 'lucide-react';

interface ProfileWithAuth {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  hasAuth: boolean;
}

export function AuthAuditTab() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'missing'>('missing');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; created: number; skipped: number; failed: number } | null>(null);

  // Scan query
  const { data: scanResults, isLoading: isScanning, refetch: runScan, isFetched } = useQuery({
    queryKey: ['auth-audit-scan'],
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .is('archived_at', null)
        .order('full_name');
      if (pErr) throw pErr;

      // Fetch roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map<string, string>();
      (roles || []).forEach(r => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
      });

      const profileIds = (profiles || []).map(p => p.id);

      // Check auth status in batches of 500
      const authMap: Record<string, boolean> = {};
      for (let i = 0; i < profileIds.length; i += 500) {
        const batch = profileIds.slice(i, i + 500);
        const { data, error } = await supabase.functions.invoke('check-auth-status', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: { profile_ids: batch },
        });
        if (error) throw error;
        Object.assign(authMap, data);
      }

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        role: roleMap.get(p.id) || null,
        hasAuth: authMap[p.id] === true,
      })) as ProfileWithAuth[];
    },
    enabled: false,
  });

  const displayResults = scanResults?.filter(r => filter === 'all' || !r.hasAuth) || [];
  const missingCount = scanResults?.filter(r => !r.hasAuth).length || 0;
  const missingProfiles = scanResults?.filter(r => !r.hasAuth) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllMissing = () => {
    setSelectedIds(new Set(missingProfiles.map(p => p.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const allMissingSelected = missingProfiles.length > 0 && missingProfiles.every(p => selectedIds.has(p.id));

  // Bulk create mutation
  const handleBulkCreate = async () => {
    const toCreate = missingProfiles.filter(p => selectedIds.has(p.id));
    if (toCreate.length === 0) return;

    const progress = { current: 0, total: toCreate.length, created: 0, skipped: 0, failed: 0 };
    setBulkProgress(progress);

    for (const profile of toCreate) {
      try {
        const firstName = (profile.full_name || 'User').split(/\s+/)[0];
        const password = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() + '1234';

        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: {
            email: profile.email,
            password,
            fullName: profile.full_name,
            role: profile.role || 'student',
          },
        });

        if (error) {
          progress.failed++;
        } else if (data?.alreadyExists) {
          progress.skipped++;
        } else {
          progress.created++;
        }
      } catch {
        progress.failed++;
      }

      progress.current++;
      setBulkProgress({ ...progress });
    }

    toast({
      title: 'Bulk creation complete',
      description: `${progress.created} created, ${progress.skipped} skipped, ${progress.failed} failed`,
    });

    setBulkProgress(null);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['auth-audit-scan'] });
    runScan();
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Scan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Auth Account Audit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => runScan()} disabled={isScanning}>
              {isScanning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" /> Scan for Missing Auth Accounts</>
              )}
            </Button>

            {isFetched && (
              <>
                <Button variant="outline" size="sm" onClick={() => runScan()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Rescan
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    Show All ({scanResults?.length || 0})
                  </Button>
                  <Button
                    variant={filter === 'missing' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('missing')}
                  >
                    Missing Only ({missingCount})
                  </Button>
                </div>
              </>
            )}
          </div>

          {isFetched && scanResults && (
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Total profiles: <strong>{scanResults.length}</strong></span>
              <span className="text-emerald-600">With auth: <strong>{scanResults.length - missingCount}</strong></span>
              <span className="text-destructive">Missing auth: <strong>{missingCount}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Results + Fix */}
      {isFetched && scanResults && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Bulk actions */}
            {missingCount > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allMissingSelected}
                    onCheckedChange={() => allMissingSelected ? deselectAll() : selectAllMissing()}
                  />
                  <span className="text-sm text-muted-foreground">Select All Missing</span>
                </div>
                <Button
                  onClick={handleBulkCreate}
                  disabled={selectedIds.size === 0 || !!bulkProgress}
                >
                  {bulkProgress ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating {bulkProgress.current}/{bulkProgress.total}</>
                  ) : (
                    <>Create {selectedIds.size} Account{selectedIds.size !== 1 ? 's' : ''}</>
                  )}
                </Button>
              </div>
            )}

            {/* Progress bar */}
            {bulkProgress && (
              <div className="space-y-2">
                <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Created: {bulkProgress.created}</span>
                  <span>Skipped: {bulkProgress.skipped}</span>
                  <span>Failed: {bulkProgress.failed}</span>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Auth Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {filter === 'missing' ? 'All profiles have auth accounts ✓' : 'No results'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayResults.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {!r.hasAuth && (
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email || '—'}</TableCell>
                      <TableCell>
                        {r.role ? (
                          <Badge variant="secondary" className="capitalize">{r.role.replace('_', ' ')}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">No role</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.hasAuth ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Missing
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
