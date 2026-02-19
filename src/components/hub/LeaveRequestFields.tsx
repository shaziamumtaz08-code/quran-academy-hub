import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface LeaveRequestFieldsProps {
  metadata: any;
  onChange: (metadata: any) => void;
}

export function LeaveRequestFields({ metadata, onChange }: LeaveRequestFieldsProps) {
  const update = (key: string, value: any) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border border-border">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Leave Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={metadata.start_date || ''} onChange={e => update('start_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={metadata.end_date || ''} onChange={e => update('end_date', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Reason</Label>
        <Textarea placeholder="Reason for leave..." value={metadata.reason || ''} onChange={e => update('reason', e.target.value)} className="min-h-[60px]" />
      </div>
    </div>
  );
}
