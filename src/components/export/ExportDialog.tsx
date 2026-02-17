import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';

interface ExportField {
  key: string;
  label: string;
  defaultChecked?: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: ExportField[];
  data: Record<string, any>[];
  filename?: string;
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportDialog({ open, onOpenChange, title, fields, data, filename = 'export' }: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(fields.filter(f => f.defaultChecked !== false).map(f => f.key))
  );

  const toggleField = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(fields.map(f => f.key)));
  const deselectAll = () => setSelected(new Set());

  const handleExport = () => {
    const selectedFields = fields.filter(f => selected.has(f.key));
    if (selectedFields.length === 0) return;

    const header = selectedFields.map(f => escapeCSV(f.label)).join(',');
    const rows = data.map(row =>
      selectedFields.map(f => escapeCSV(row[f.key])).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {fields.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <Checkbox
                  id={`export-${f.key}`}
                  checked={selected.has(f.key)}
                  onCheckedChange={() => toggleField(f.key)}
                />
                <Label htmlFor={`export-${f.key}`} className="text-sm cursor-pointer">{f.label}</Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{data.length} records · {selected.size} fields selected</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={selected.size === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
