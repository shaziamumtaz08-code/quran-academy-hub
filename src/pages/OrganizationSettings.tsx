import React, { useState } from 'react';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Plus, Pencil, Trash2, Globe, MapPin, Layers, Loader2, Save, CalendarOff } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type BranchType = Database['public']['Enums']['branch_type'];
type DivisionModel = Database['public']['Enums']['division_model'];

export default function OrganizationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Organization ──
  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const [orgForm, setOrgForm] = useState<{ name: string; logo_url: string; settings: any }>({ name: '', logo_url: '', settings: {} });
  const [orgFormInit, setOrgFormInit] = useState(false);

  if (org && !orgFormInit) {
    setOrgForm({
      name: org.name,
      logo_url: org.logo_url || '',
      settings: typeof org.settings === 'object' && org.settings !== null ? org.settings : {},
    });
    setOrgFormInit(true);
  }

  const updateOrg = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const { error } = await supabase.from('organizations').update({
        name: orgForm.name,
        logo_url: orgForm.logo_url || null,
        settings: orgForm.settings,
      }).eq('id', org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({ title: 'Organization updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Branches ──
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const [branchDialog, setBranchDialog] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const [branchForm, setBranchForm] = useState({ name: '', type: 'online' as BranchType, timezone: '', address: '' });

  const openNewBranch = () => {
    setEditBranch(null);
    setBranchForm({ name: '', type: 'online', timezone: '', address: '' });
    setBranchDialog(true);
  };

  const openEditBranch = (b: any) => {
    setEditBranch(b);
    setBranchForm({ name: b.name, type: b.type, timezone: b.timezone || '', address: b.address || '' });
    setBranchDialog(true);
  };

  const saveBranch = useMutation({
    mutationFn: async () => {
      if (!org) return;
      if (editBranch) {
        const { error } = await supabase.from('branches').update({
          name: branchForm.name,
          type: branchForm.type,
          timezone: branchForm.timezone || null,
          address: branchForm.address || null,
        }).eq('id', editBranch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert({
          org_id: org.id,
          name: branchForm.name,
          type: branchForm.type,
          timezone: branchForm.timezone || null,
          address: branchForm.address || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setBranchDialog(false);
      toast({ title: editBranch ? 'Branch updated' : 'Branch created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleBranchStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('branches').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: 'Branch status updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      toast({ title: 'Branch deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── Divisions ──
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('divisions').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const [divDialog, setDivDialog] = useState(false);
  const [divForm, setDivForm] = useState({ name: '', model_type: 'one_to_one' as DivisionModel, branch_id: '' });

  const saveDivision = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('divisions').insert({
        branch_id: divForm.branch_id,
        name: divForm.name,
        model_type: divForm.model_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
      setDivDialog(false);
      toast({ title: 'Division created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleDivision = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('divisions').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    },
  });

  // ── Holidays ──
  const { data: holidaysList = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['holidays-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays' as any).select('*').order('holiday_date', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Array<{
        id: string; holiday_date: string; name: string; is_recurring: boolean;
        branch_id: string | null; division_id: string | null; created_at: string;
      }>;
    },
  });

  const [holidayDialog, setHolidayDialog] = useState(false);
  const [editHoliday, setEditHoliday] = useState<any>(null);
  const [holidayForm, setHolidayForm] = useState({ name: '', holiday_date: '', is_recurring: false, branch_id: '', division_id: '' });

  const openNewHoliday = () => {
    setEditHoliday(null);
    setHolidayForm({ name: '', holiday_date: format(new Date(), 'yyyy-MM-dd'), is_recurring: false, branch_id: '', division_id: '' });
    setHolidayDialog(true);
  };

  const openEditHoliday = (h: any) => {
    setEditHoliday(h);
    setHolidayForm({ name: h.name, holiday_date: h.holiday_date, is_recurring: h.is_recurring, branch_id: h.branch_id || '', division_id: h.division_id || '' });
    setHolidayDialog(true);
  };

  const saveHolidayMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: holidayForm.name,
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring,
        branch_id: holidayForm.branch_id || null,
        division_id: holidayForm.division_id || null,
      };
      if (editHoliday) {
        const { error } = await supabase.from('holidays' as any).update(payload).eq('id', editHoliday.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        payload.created_by = userData.user?.id;
        const { error } = await supabase.from('holidays' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays-settings'] });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setHolidayDialog(false);
      toast({ title: editHoliday ? 'Holiday updated' : 'Holiday created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteHoliday = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays-settings'] });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast({ title: 'Holiday deleted' });
    },
  });

  if (orgLoading || branchesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const settings = orgForm.settings as Record<string, string>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">System Control</h1>
          <p className="text-muted-foreground">Organization, branches, and division management</p>
        </div>

        <Tabs defaultValue="identity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="identity">🏢 Identity</TabsTrigger>
            <TabsTrigger value="branches">🌐 Branches</TabsTrigger>
            <TabsTrigger value="divisions">📦 Divisions</TabsTrigger>
            <TabsTrigger value="holidays">📅 Holidays</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Identity ── */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Organization Identity</CardTitle>
                <CardDescription>Global branding and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input value={orgForm.logo_url} onChange={e => setOrgForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Master Website</Label>
                    <Input value={settings.website || ''} onChange={e => setOrgForm(p => ({ ...p, settings: { ...p.settings, website: e.target.value } }))} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label>HQ Address</Label>
                    <Input value={settings.address || ''} onChange={e => setOrgForm(p => ({ ...p, settings: { ...p.settings, address: e.target.value } }))} />
                  </div>
                </div>
                <Button onClick={() => updateOrg.mutate()} disabled={updateOrg.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> {updateOrg.isPending ? 'Saving...' : 'Save Organization'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: Branches ── */}
          <TabsContent value="branches">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Branch Manager</CardTitle>
                  <CardDescription>Manage online and onsite campus locations</CardDescription>
                </div>
                <Button onClick={openNewBranch} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Branch</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Timezone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>
                          <Badge variant={b.type === 'online' ? 'default' : 'secondary'}>
                            {b.type === 'online' ? '🌐 Online' : '🏢 Onsite'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.timezone || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={b.is_active}
                              onCheckedChange={checked => toggleBranchStatus.mutate({ id: b.id, is_active: checked })}
                            />
                            <span className={`text-xs font-medium ${b.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {b.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditBranch(b)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteBranch.mutate(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {branches.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No branches configured</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 3: Divisions ── */}
          <TabsContent value="divisions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Division Manager</CardTitle>
                  <CardDescription>Toggle academic models per branch</CardDescription>
                </div>
                <Button onClick={() => { setDivForm({ name: '', model_type: 'one_to_one', branch_id: branches[0]?.id || '' }); setDivDialog(true); }} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Division</Button>
              </CardHeader>
              <CardContent>
                {branches.filter(b => b.is_active).map(branch => {
                  const branchDivisions = divisions.filter(d => d.branch_id === branch.id);
                  return (
                    <div key={branch.id} className="mb-6 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-foreground">{branch.name}</h3>
                        <Badge variant="outline" className="text-xs">{branch.type}</Badge>
                      </div>
                      {branchDivisions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
                          {branchDivisions.map(div => (
                            <div key={div.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                              <div>
                                <p className="font-medium text-sm">{div.name}</p>
                                <Badge variant="outline" className="text-xs mt-1">
                                  {div.model_type === 'one_to_one' ? '1:1 Mentorship' : 'Group Academy'}
                                </Badge>
                              </div>
                              <Switch
                                checked={div.is_active}
                                onCheckedChange={checked => toggleDivision.mutate({ id: div.id, is_active: checked })}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">No divisions — add one above</p>
                      )}
                      <Separator className="mt-4" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 4: Holidays ── */}
          <TabsContent value="holidays">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5" /> Holiday Calendar</CardTitle>
                  <CardDescription>Manage holidays — these dates are excluded from missing attendance</CardDescription>
                </div>
                <Button onClick={openNewHoliday} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Holiday</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Recurring</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidaysList.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.holiday_date}</TableCell>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>
                          <Badge variant={h.is_recurring ? 'default' : 'outline'}>
                            {h.is_recurring ? '🔁 Annual' : 'One-off'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEditHoliday(h)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteHoliday.mutate(h.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {holidaysList.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No holidays configured</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Branch Dialog ── */}
      <Dialog open={branchDialog} onOpenChange={setBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBranch ? 'Edit Branch' : 'New Branch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={branchForm.name} onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Onsite Karachi" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={branchForm.type} onValueChange={v => setBranchForm(p => ({ ...p, type: v as BranchType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">🌐 Online</SelectItem>
                  <SelectItem value="onsite">🏢 Onsite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={branchForm.timezone} onChange={e => setBranchForm(p => ({ ...p, timezone: e.target.value }))} placeholder="e.g. Asia/Karachi" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={branchForm.address} onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveBranch.mutate()} disabled={saveBranch.isPending || !branchForm.name}>
              {saveBranch.isPending ? 'Saving...' : editBranch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Division Dialog ── */}
      <Dialog open={divDialog} onOpenChange={setDivDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Division</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={divForm.branch_id} onValueChange={v => setDivForm(p => ({ ...p, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.filter(b => b.is_active).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Division Name</Label>
              <Input value={divForm.name} onChange={e => setDivForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Evening Batch" />
            </div>
            <div className="space-y-2">
              <Label>Model Type</Label>
              <Select value={divForm.model_type} onValueChange={v => setDivForm(p => ({ ...p, model_type: v as DivisionModel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_to_one">1:1 Mentorship</SelectItem>
                  <SelectItem value="group">Group Academy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveDivision.mutate()} disabled={saveDivision.isPending || !divForm.name || !divForm.branch_id}>
              {saveDivision.isPending ? 'Creating...' : 'Create Division'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Holiday Dialog ── */}
      <Dialog open={holidayDialog} onOpenChange={setHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editHoliday ? 'Edit Holiday' : 'New Holiday'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input value={holidayForm.name} onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Eid ul Fitr" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={holidayForm.holiday_date} onChange={e => setHolidayForm(p => ({ ...p, holiday_date: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={holidayForm.is_recurring} onCheckedChange={c => setHolidayForm(p => ({ ...p, is_recurring: c }))} />
              <Label>Recurring annually</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveHolidayMut.mutate()} disabled={saveHolidayMut.isPending || !holidayForm.name || !holidayForm.holiday_date}>
              {saveHolidayMut.isPending ? 'Saving...' : editHoliday ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
