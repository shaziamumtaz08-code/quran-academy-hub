import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Copy, KeyRound, Loader2, XCircle } from 'lucide-react';

type Row = {
  id: string; name: string; current_login: string; new_login: string;
  password?: string; fixed: boolean; error?: string;
};

const DEFAULT_TEMP_PASSWORD = 'AqtaLms@2026';

/**
 * One place for admins to (a) repair student logins with a single shared
 * temporary password + forced change on first sign-in, and (b) test any
 * email/password pair without leaving their own session.
 */
export function StudentLoginToolkitDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // repair tab
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(DEFAULT_TEMP_PASSWORD);
  const [scope, setScope] = useState<'mismatched' | 'all_students'>('mismatched');
  const [rows, setRows] = useState<Row[] | null>(null);

  // verify tab
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState(DEFAULT_TEMP_PASSWORD);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { valid: boolean; reason?: string; name?: string | null; must_change_password?: boolean } | null
  >(null);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('student-login-repair', {
        body: { dry_run: dryRun, password, scope },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRows(((data as any)?.results ?? []) as Row[]);
      if (!dryRun) toast({ title: 'Logins repaired', description: `${(data as any)?.count ?? 0} student(s) updated.` });
    } catch (e: any) {
      toast({ title: 'Could not run', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    const text = (rows || []).map(r => `${r.name}\t${r.new_login}\t${password}`).join('\n');
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast({ title: 'Credential sheet copied' });
  };

  const verify = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-login', {
        body: { email: testEmail, password: testPassword },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setTestResult(data as any);
    } catch (e: any) {
      toast({ title: 'Check failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows(null); setTestResult(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <KeyRound className="h-4 w-4" /> Student logins
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Student login toolkit</DialogTitle>
          <DialogDescription>
            Re-sync each student's sign-in address to the AQT id on their sheet, give everyone the
            same temporary password, and force a private password on first sign-in.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="repair">
          <TabsList className="w-full">
            <TabsTrigger value="repair" className="flex-1">Repair &amp; reset</TabsTrigger>
            <TabsTrigger value="verify" className="flex-1">Test a login</TabsTrigger>
          </TabsList>

          <TabsContent value="repair" className="space-y-3 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="temp-pass">Temporary password (same for everyone)</Label>
                <Input id="temp-pass" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Apply to</Label>
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    variant={scope === 'mismatched' ? 'default' : 'outline'}
                    onClick={() => setScope('mismatched')}
                  >
                    Broken logins only
                  </Button>
                  <Button
                    type="button" size="sm"
                    variant={scope === 'all_students' ? 'default' : 'outline'}
                    onClick={() => setScope('all_students')}
                  >
                    All students
                  </Button>
                </div>
              </div>
            </div>

            {rows && (
              <div className="max-h-64 space-y-1.5 overflow-auto rounded-lg border p-3">
                {rows.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing to fix — every student login matches their sheet.</p>
                )}
                {rows.map(r => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{r.name}</span>
                    {r.current_login !== r.new_login && (
                      <span className="text-muted-foreground line-through">{r.current_login}</span>
                    )}
                    <code className="rounded bg-muted px-2 py-0.5">{r.new_login}</code>
                    <code className="rounded bg-muted px-2 py-0.5">{password}</code>
                    {r.error
                      ? <Badge variant="destructive">{r.error}</Badge>
                      : <Badge variant={r.fixed ? 'default' : 'secondary'}>{r.fixed ? 'Fixed' : 'Preview'}</Badge>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              {rows?.length ? (
                <Button variant="ghost" size="sm" onClick={copyAll} className="gap-2">
                  <Copy className="h-4 w-4" /> Copy sheet
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => run(true)} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Preview
                </Button>
                <Button onClick={() => run(false)} disabled={busy || password.length < 8}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="verify" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              Checks the credentials against the real sign-in service and throws the session away —
              your own session and the student's account stay untouched.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="test-email">Login email</Label>
                <Input id="test-email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="name@alqurantimeacademy.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="test-pass">Password</Label>
                <Input id="test-pass" value={testPassword} onChange={(e) => setTestPassword(e.target.value)} />
              </div>
            </div>
            <Button onClick={verify} disabled={testing || !testEmail || !testPassword}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Check credentials
            </Button>

            {testResult && (
              <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                {testResult.valid
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  : <XCircle className="mt-0.5 h-4 w-4 text-destructive" />}
                <div>
                  {testResult.valid ? (
                    <>
                      <p className="font-medium">Works{testResult.name ? ` — ${testResult.name}` : ''}</p>
                      {testResult.must_change_password && (
                        <p className="text-muted-foreground">Will be asked to set a new password on sign-in.</p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium">Rejected — {testResult.reason}</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
