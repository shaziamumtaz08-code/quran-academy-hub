import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { QUIZ_EXPORT_COLUMNS, exportQuizCsv, exportQuizXlsx, type QuizExportRow } from '@/lib/quizExport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: QuizExportRow[];
  filename?: string;
}

export default function QuizResultsExportDialog({ open, onOpenChange, rows, filename = 'quiz-results' }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(QUIZ_EXPORT_COLUMNS.map((c) => c.key as string)));
  const [busy, setBusy] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const stamp = `${filename}-${new Date().toISOString().split('T')[0]}`;
  const keys = Array.from(selected);

  const doXlsx = async () => {
    setBusy(true);
    try {
      await exportQuizXlsx(rows, keys, stamp);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doCsv = () => {
    exportQuizCsv(rows, keys, stamp);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Quiz Results</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(QUIZ_EXPORT_COLUMNS.map((c) => c.key as string)))}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Deselect All
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {QUIZ_EXPORT_COLUMNS.map((c) => (
              <div key={c.key} className="flex items-center gap-2">
                <Checkbox
                  id={`qexp-${c.key}`}
                  checked={selected.has(c.key as string)}
                  onCheckedChange={() => toggle(c.key as string)}
                />
                <Label htmlFor={`qexp-${c.key}`} className="text-sm cursor-pointer">
                  {c.label}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length} records · {selected.size} columns · Excel export includes styled headers, pass/fail row
            tinting, % formatting and a frozen header row.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={doCsv} disabled={selected.size === 0 || busy}>
            <Download className="h-4 w-4 mr-1" /> Plain CSV
          </Button>
          <Button onClick={doXlsx} disabled={selected.size === 0 || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            Export Excel (.xlsx)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
