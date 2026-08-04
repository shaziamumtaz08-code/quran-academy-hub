import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AtSign, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Row = {
  id: string; name: string; old_email: string; new_email: string;
  password?: string; migrated: boolean; error?: string;
};

/**
 * Moves students still sitting on a parent's / shared inbox onto their own
 * AQT login id (name@alqurantimeacademy.com). Login-only — no mailbox.
 */
export function MigrateStudentLoginsDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [applied, setApplied] = useState(false);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-student-logins', {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRows(((data as any)?.results ?? []) as Row[]);
      setApplied(!dryRun);
      if (!dryRun) toast({ title: 'Logins migrated', description: `${(data as any)?.count ?? 0} student(s) updated.` });
    } catch (e: any) {
      toast({ title: 'Migration failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    const text = (rows || [])
      .map(r => `${r.name}: ${r.new_email}${r.password ? ` / ${r.password}` : ''}`)
      .join('\n');
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast({ title: 'Credentials copied' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows(null); setApplied(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AtSign className="h-4 w-4" /> Fix student logins
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> AQT student logins
          </DialogTitle>
          <DialogDescription>
            Parent emails stay with parents. Students on a parent's or shared inbox are moved to their own
            login id at <strong>@alqurantimeacademy.com</strong>. These are login-only ids — password resets
            are done by an admin.
          </DialogDescription>
        </DialogHeader>

        {rows && (
          <div className="max-h-72 space-y-2 overflow-auto rounded-lg border p-3">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No students need migrating — everyone owns a unique login.</p>
            )}
            {rows.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground line-through">{r.old_email}</span>
                <span className="text-muted-foreground">→</span>
                <code className="rounded bg-muted px-2 py-0.5">{r.new_email}</code>
                {r.password && <code className="rounded bg-muted px-2 py-0.5">{r.password}</code>}
                {r.error
                  ? <Badge variant="destructive">{r.error}</Badge>
                  : <Badge variant={r.migrated ? 'default' : 'secondary'}>{r.migrated ? 'Updated' : 'Preview'}</Badge>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {rows?.length ? (
            <Button variant="ghost" size="sm" onClick={copyAll} className="gap-2">
              <Copy className="h-4 w-4" /> Copy list
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run(true)} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Preview
            </Button>
            <Button onClick={() => run(false)} disabled={busy || applied || rows?.length === 0}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Migrate now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
