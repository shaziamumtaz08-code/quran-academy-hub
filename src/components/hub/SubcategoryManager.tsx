import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SubcategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ['complaint', 'feedback', 'suggestion', 'task', 'leave_request', 'general'];

export function SubcategoryManager({ open, onOpenChange }: SubcategoryManagerProps) {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('complaint');
  const [newName, setNewName] = useState('');
  const [newTat, setNewTat] = useState('');

  const { data: subcategories = [] } = useQuery({
    queryKey: ['ticket-subcategories-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_subcategories').select('*').order('category').order('sort_order');
      return data || [];
    },
    enabled: open,
  });

  const addSubcat = useMutation({
    mutationFn: async () => {
      const maxSort = subcategories.filter((s: any) => s.category === newCategory).length + 1;
      const { error } = await supabase.from('ticket_subcategories').insert({
        category: newCategory,
        name: newName,
        sort_order: maxSort,
        tat_override_hours: newTat ? parseInt(newTat) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName('');
      setNewTat('');
      queryClient.invalidateQueries({ queryKey: ['ticket-subcategories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-subcategories'] });
      toast.success('Subcategory added');
    },
    onError: () => toast.error('Failed to add'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('ticket_subcategories').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-subcategories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-subcategories'] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Subcategories</DialogTitle>
        </DialogHeader>

        {/* Add new */}
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Name</Label>
            <Input placeholder="Subcategory name" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="w-24">
            <Label className="text-xs">TAT (hrs)</Label>
            <Input type="number" placeholder="48" value={newTat} onChange={e => setNewTat(e.target.value)} />
          </div>
          <Button size="sm" disabled={!newName.trim()} onClick={() => addSubcat.mutate()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>TAT Override</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcategories.map((sc: any) => (
                <TableRow key={sc.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{sc.category?.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{sc.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sc.tat_override_hours ? `${sc.tat_override_hours}h` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={sc.is_active ? 'default' : 'secondary'} className="text-xs cursor-pointer"
                      onClick={() => toggleActive.mutate({ id: sc.id, is_active: sc.is_active })}>
                      {sc.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
