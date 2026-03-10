import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface StaffMember {
  id: string;
  full_name: string;
}

interface BulkAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'addition' | 'deduction';
  staffMembers: StaffMember[];
  salaryMonth: string;
  onSubmit: (data: {
    staffIds: string[];
    adjustmentType: string;
    mode: 'flat' | 'percentage';
    value: number;
    reason: string;
  }) => void;
  isPending?: boolean;
}

export function BulkAdjustmentDialog({
  open, onOpenChange, type, staffMembers, salaryMonth, onSubmit, isPending
}: BulkAdjustmentDialogProps) {
  const [applyTo, setApplyTo] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(staffMembers.map(s => s.id)));
  const [mode, setMode] = useState<'flat' | 'percentage'>('flat');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [adjType, setAdjType] = useState(type === 'addition' ? 'bonus' : 'deduction');

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(staffMembers.map(s => s.id)) : new Set());
  };

  const finalIds = applyTo === 'all' ? staffMembers.map(s => s.id) : [...selectedIds];

  const handleSubmit = () => {
    onSubmit({
      staffIds: finalIds,
      adjustmentType: adjType,
      mode,
      value: parseFloat(value) || 0,
      reason,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk {type === 'addition' ? 'Addition' : 'Deduction'}</DialogTitle>
          <DialogDescription>Apply {type} to multiple staff for {salaryMonth}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {type === 'addition' && (
            <div>
              <Label className="text-xs">Adjustment Type</Label>
              <Select value={adjType} onValueChange={setAdjType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="allowance">Allowance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'flat' | 'percentage')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Amount</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{mode === 'percentage' ? 'Percentage (%)' : 'Amount (PKR)'}</Label>
              <Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={mode === 'percentage' ? '10' : '5000'} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this adjustment..." className="min-h-[60px]" />
          </div>
          <div>
            <Label className="text-xs">Apply To</Label>
            <Select value={applyTo} onValueChange={(v) => setApplyTo(v as 'all' | 'selected')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff ({staffMembers.length})</SelectItem>
                <SelectItem value="selected">Selected Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {applyTo === 'selected' && (
            <div className="border rounded-lg">
              <div className="px-3 py-2 border-b bg-muted/50 flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === staffMembers.length}
                  onCheckedChange={(c) => handleSelectAll(!!c)}
                />
                <span className="text-xs font-medium">Select All ({selectedIds.size}/{staffMembers.length})</span>
              </div>
              <ScrollArea className="max-h-48">
                <div className="p-2 space-y-1">
                  {staffMembers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => handleToggle(s.id)} />
                      <span className="text-sm">{s.full_name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!value || parseFloat(value) <= 0 || finalIds.length === 0 || isPending}
            className={type === 'addition' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Apply to {finalIds.length} staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
