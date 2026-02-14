import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Package, Percent, Plus, Pencil, Trash2, Loader2, DollarSign, Tag, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';

// ─── Types ───────────────────────────────────────────────────────────
interface FeePackage {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  days_per_week: number;
  is_active: boolean;
}

interface DiscountRule {
  id: string;
  name: string;
  type: string;
  value: number;
  is_active: boolean;
}

const CURRENCIES = ['USD', 'GBP', 'PKR', 'EUR', 'AED', 'SAR', 'CAD', 'AUD'];
const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

// ─── Fee Packages Tab ────────────────────────────────────────────────
function FeePackagesTab() {
  const { activeBranch, activeDivision } = useDivision();
  const activeBranchId = activeBranch?.id || null;
  const activeDivisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<FeePackage | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'USD', days_per_week: '5' });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['fee-packages', activeBranchId, activeDivisionId],
    queryFn: async () => {
      let q = supabase
        .from('fee_packages')
        .select('id, name, amount, currency, billing_cycle, days_per_week, is_active')
        .order('created_at', { ascending: false });
      if (activeBranchId) q = q.eq('branch_id', activeBranchId);
      if (activeDivisionId) q = q.eq('division_id', activeDivisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FeePackage[];
    },
    enabled: !!activeBranchId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        days_per_week: parseInt(form.days_per_week) || 5,
        billing_cycle: 'monthly' as any,
        branch_id: activeBranchId,
        division_id: activeDivisionId,
      };
      if (editingPkg) {
        const { error } = await supabase.from('fee_packages').update(payload).eq('id', editingPkg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fee_packages').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-packages'] });
      toast({ title: editingPkg ? 'Package updated' : 'Package created' });
      closeDialog();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('fee_packages').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-packages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-packages'] });
      toast({ title: 'Package deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditingPkg(null);
    setForm({ name: '', amount: '', currency: 'USD', days_per_week: '5' });
    setDialogOpen(true);
  };

  const openEdit = (pkg: FeePackage) => {
    setEditingPkg(pkg);
    setForm({
      name: pkg.name,
      amount: pkg.amount.toString(),
      currency: pkg.currency,
      days_per_week: (pkg.days_per_week || 5).toString(),
    });
    setDialogOpen(true);
  };

  const openDuplicate = (pkg: FeePackage) => {
    setEditingPkg(null);
    setForm({
      name: `${pkg.name} (Copy)`,
      amount: pkg.amount.toString(),
      currency: pkg.currency,
      days_per_week: (pkg.days_per_week || 5).toString(),
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPkg(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{packages.length} package(s) configured</p>
        <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Create Package</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mb-4 opacity-40" />
          <p className="font-medium">No fee packages yet</p>
          <p className="text-sm">Create your first package to get started</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Name</TableHead>
                <TableHead>Days/Week</TableHead>
                <TableHead className="text-right">Base Amount (30-Min)</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pkg.days_per_week || 5} days</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {Number(pkg.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{pkg.currency}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={pkg.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: pkg.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDuplicate(pkg)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(pkg.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Edit Package' : 'Create Fee Package'}</DialogTitle>
            <DialogDescription>Define a reusable fee structure for student billing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Package Name</Label>
              <Input placeholder="e.g. USA - 5 Days/Week" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Base Amount (30-Min)</Label>
                <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Days per Week</Label>
              <Select value={form.days_per_week} onValueChange={(v) => setForm(f => ({ ...f, days_per_week: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_PER_WEEK_OPTIONS.map((d) => <SelectItem key={d} value={d.toString()}>{d} days/week</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.amount || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingPkg ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Discount Rules Tab ──────────────────────────────────────────────
function DiscountRulesTab() {
  const { activeBranch, activeDivision } = useDivision();
  const activeBranchId = activeBranch?.id || null;
  const activeDivisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [form, setForm] = useState({ name: '', type: 'percentage', value: '' });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['discount-rules', activeBranchId, activeDivisionId],
    queryFn: async () => {
      let q = supabase
        .from('discount_rules')
        .select('id, name, type, value, is_active')
        .order('created_at', { ascending: false });
      if (activeBranchId) q = q.eq('branch_id', activeBranchId);
      if (activeDivisionId) q = q.eq('division_id', activeDivisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DiscountRule[];
    },
    enabled: !!activeBranchId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type as any,
        value: parseFloat(form.value) || 0,
        branch_id: activeBranchId,
        division_id: activeDivisionId,
      };
      if (editingRule) {
        const { error } = await supabase.from('discount_rules').update(payload).eq('id', editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('discount_rules').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-rules'] });
      toast({ title: editingRule ? 'Discount updated' : 'Discount created' });
      closeDialog();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('discount_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discount-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-rules'] });
      toast({ title: 'Discount deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: '', type: 'percentage', value: '' });
    setDialogOpen(true);
  };

  const openEdit = (rule: DiscountRule) => {
    setEditingRule(rule);
    setForm({ name: rule.name, type: rule.type, value: rule.value.toString() });
    setDialogOpen(true);
  };

  const openDuplicate = (rule: DiscountRule) => {
    setEditingRule(null);
    setForm({ name: `${rule.name} (Copy)`, type: rule.type, value: rule.value.toString() });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{rules.length} discount rule(s)</p>
        <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Create Discount</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Tag className="h-12 w-12 mb-4 opacity-40" />
          <p className="font-medium">No discount rules yet</p>
          <p className="text-sm">Create sibling, need-based, or promotional discounts</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Discount Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize gap-1">
                      {rule.type === 'percentage' ? <Percent className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
                      {rule.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {rule.type === 'percentage' ? `${Number(rule.value)}%` : Number(rule.value).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDuplicate(rule)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(rule.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Discount' : 'Create Discount Rule'}</DialogTitle>
            <DialogDescription>Set up reusable discount rules for student billing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Discount Name</Label>
              <Input placeholder="e.g. Sibling Discount" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  placeholder={form.type === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                  value={form.value}
                  onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.value || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function FinanceSetup() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Finance Setup</h1>
          <p className="text-muted-foreground mt-1">Configure fee packages and discount rules for your branch</p>
        </div>

        <Tabs defaultValue="packages" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="packages" className="gap-2">
              <Package className="h-4 w-4" /> Fee Packages
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2">
              <Tag className="h-4 w-4" /> Global Discounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="mt-6">
            <FeePackagesTab />
          </TabsContent>

          <TabsContent value="discounts" className="mt-6">
            <DiscountRulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
