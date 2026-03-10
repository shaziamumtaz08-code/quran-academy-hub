import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Search, Users, DollarSign, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const SALARY_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'admin_admissions', label: 'Admissions Admin' },
  { value: 'admin_fees', label: 'Fees Admin' },
  { value: 'admin_academic', label: 'Academic Admin' },
  { value: 'examiner', label: 'Examiner' },
  { value: 'teacher', label: 'Teacher' },
];

interface StaffSalaryForm {
  user_id: string;
  role: string;
  monthly_amount: number;
  effective_from: string;
  effective_to: string;
  prorate_partial_months: boolean;
  notes: string;
}

const emptyForm: StaffSalaryForm = {
  user_id: '',
  role: '',
  monthly_amount: 0,
  effective_from: format(new Date(), 'yyyy-MM-dd'),
  effective_to: '',
  prorate_partial_months: true,
  notes: '',
};

export default function StaffSalarySetup() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffSalaryForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch all staff salaries with profile names
  const { data: staffSalaries = [], isLoading } = useQuery({
    queryKey: ['staff-salaries-setup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_salaries')
        .select('*, profiles:user_id(full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles that have non-teaching roles (for the user dropdown)
  const { data: eligibleUsers = [] } = useQuery({
    queryKey: ['staff-salary-eligible-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .is('archived_at', null)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user roles to show which roles a user has
  const { data: userRoles = [] } = useQuery({
    queryKey: ['staff-salary-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data || [];
    },
  });

  const userRolesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    userRoles.forEach((ur: any) => {
      if (!map[ur.user_id]) map[ur.user_id] = [];
      map[ur.user_id].push(ur.role);
    });
    return map;
  }, [userRoles]);

  // Filter eligible roles for the selected user
  const rolesForSelectedUser = useMemo(() => {
    if (!form.user_id) return SALARY_ROLES;
    const roles = userRolesMap[form.user_id] || [];
    return SALARY_ROLES.filter(r => roles.includes(r.value));
  }, [form.user_id, userRolesMap]);

  const saveMutation = useMutation({
    mutationFn: async (data: StaffSalaryForm) => {
      const payload: any = {
        user_id: data.user_id,
        role: data.role,
        monthly_amount: data.monthly_amount,
        effective_from: data.effective_from,
        effective_to: data.effective_to || null,
        prorate_partial_months: data.prorate_partial_months,
        notes: data.notes || null,
        created_by: profile?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('staff_salaries')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff_salaries')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-salaries-setup'] });
      queryClient.invalidateQueries({ queryKey: ['staff-salaries'] });
      toast({ title: editingId ? 'Salary updated' : 'Salary added', description: 'Staff salary configuration saved.' });
      setShowDialog(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_salaries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-salaries-setup'] });
      queryClient.invalidateQueries({ queryKey: ['staff-salaries'] });
      toast({ title: 'Deleted', description: 'Staff salary entry removed.' });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (entry: any) => {
    setEditingId(entry.id);
    setForm({
      user_id: entry.user_id,
      role: entry.role,
      monthly_amount: entry.monthly_amount,
      effective_from: entry.effective_from,
      effective_to: entry.effective_to || '',
      prorate_partial_months: entry.prorate_partial_months,
      notes: entry.notes || '',
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.user_id || !form.role || !form.monthly_amount) {
      toast({ title: 'Missing fields', description: 'User, role and monthly amount are required.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(form);
  };

  const filteredSalaries = useMemo(() => {
    return staffSalaries.filter((s: any) => {
      const name = s.profiles?.full_name || '';
      const matchesSearch = !search || name.toLowerCase().includes(search.toLowerCase());
      const matchesRole = filterRole === 'all' || s.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [staffSalaries, search, filterRole]);

  const getRoleLabel = (role: string) => {
    return SALARY_ROLES.find(r => r.value === role)?.label || role;
  };

  // Summary stats
  const totalActive = staffSalaries.filter((s: any) => !s.effective_to || new Date(s.effective_to) >= new Date()).length;
  const totalMonthly = staffSalaries
    .filter((s: any) => !s.effective_to || new Date(s.effective_to) >= new Date())
    .reduce((sum: number, s: any) => sum + Number(s.monthly_amount), 0);
  const uniqueStaff = new Set(staffSalaries.map((s: any) => s.user_id)).size;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Staff Salary Setup</h1>
            <p className="text-muted-foreground text-sm">Configure flat monthly salaries for non-teaching and dual-role staff</p>
          </div>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff Salary
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Staff Members</p>
                <p className="text-2xl font-bold text-foreground">{uniqueStaff}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                <Calendar className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Entries</p>
                <p className="text-2xl font-bold text-foreground">{totalActive}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Monthly</p>
                <p className="text-2xl font-bold text-foreground">PKR {totalMonthly.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {SALARY_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Monthly (PKR)</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Pro-rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : filteredSalaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No staff salary entries found. Click "Add Staff Salary" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSalaries.map((entry: any) => {
                    const isActive = !entry.effective_to || new Date(entry.effective_to) >= new Date();
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{entry.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{entry.profiles?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getRoleLabel(entry.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {Number(entry.monthly_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(entry.effective_from), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm">
                          {entry.effective_to ? format(new Date(entry.effective_to), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.prorate_partial_months ? 'default' : 'secondary'} className="text-xs">
                            {entry.prorate_partial_months ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? 'default' : 'secondary'}>
                            {isActive ? 'Active' : 'Ended'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(entry.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Staff Salary' : 'Add Staff Salary'}</DialogTitle>
            <DialogDescription>
              Configure a flat monthly salary for a staff member's role. This will appear in the Salary Engine payroll.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm(f => ({ ...f, user_id: v, role: '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} {u.email ? `(${u.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {rolesForSelectedUser.length > 0 ? (
                    rolesForSelectedUser.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none" disabled>No matching roles for this user</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.user_id && rolesForSelectedUser.length === 0 && (
                <p className="text-xs text-destructive">This user has no salary-eligible roles assigned.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Monthly Amount (PKR) *</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_amount || ''}
                onChange={(e) => setForm(f => ({ ...f, monthly_amount: Number(e.target.value) }))}
                placeholder="e.g. 25000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Effective From *</Label>
                <Input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm(f => ({ ...f, effective_from: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective To</Label>
                <Input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) => setForm(f => ({ ...f, effective_to: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Leave empty for ongoing</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Pro-rate Partial Months</Label>
                <p className="text-xs text-muted-foreground">Automatically adjust for partial months based on effective dates</p>
              </div>
              <Switch
                checked={form.prorate_partial_months}
                onCheckedChange={(v) => setForm(f => ({ ...f, prorate_partial_months: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Part-time arrangement, special terms..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Staff Salary</DialogTitle>
            <DialogDescription>
              This will permanently remove this salary entry. Existing payouts will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
