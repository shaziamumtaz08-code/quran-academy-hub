import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle, Circle, UserPlus, ShieldCheck, GraduationCap, Users, MessageSquare, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type StepState = 'pending' | 'running' | 'done' | 'failed';

interface Step {
  key: string;
  label: string;
  icon: React.ElementType;
  state: StepState;
  detail?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  courseId: string;
  onActivated?: () => void;
}

const INITIAL_STEPS: Step[] = [
  { key: 'auth', label: 'Create login account', icon: UserPlus, state: 'pending' },
  { key: 'role', label: 'Assign student role', icon: ShieldCheck, state: 'pending' },
  { key: 'enroll', label: 'Enroll in course', icon: GraduationCap, state: 'pending' },
  { key: 'class', label: 'Add to class', icon: Users, state: 'pending' },
  { key: 'chat', label: 'Add to class chat', icon: MessageSquare, state: 'pending' },
];

export function ActivateApplicantDialog({ open, onOpenChange, applicant, courseId, onActivated }: Props) {
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done' | 'error'>('confirm');
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [result, setResult] = useState<{
    tempPassword?: string;
    loginEmail?: string;
    classAssigned?: string | null;
    failedSteps?: string[];
    error?: string;
  } | null>(null);

  function reset() {
    setPhase('confirm');
    setSteps(INITIAL_STEPS);
    setResult(null);
  }

  function updateStep(key: string, state: StepState, detail?: string) {
    setSteps(prev => prev.map(s => (s.key === key ? { ...s, state, detail } : s)));
  }

  async function handleActivate() {
    if (!applicant) return;
    setPhase('running');
    setSteps(INITIAL_STEPS.map(s => ({ ...s })));

    // Visual "running" indicator on the first step while the edge function executes
    updateStep('auth', 'running');

    const { data, error } = await supabase.functions.invoke('process-enrollment', {
      body: { submission_id: applicant.id, course_id: courseId },
    });

    if (error || data?.error) {
      const errMsg = error?.message || data?.error || 'Activation failed';
      updateStep('auth', 'failed', errMsg);
      setResult({ error: errMsg });
      setPhase('error');
      toast.error(errMsg);
      return;
    }

    // Map the edge function response to step states
    const failed: string[] = data?.failed_steps || [];
    const failedKey = (label: string) => failed.some(f => f.toLowerCase().includes(label.toLowerCase()));

    updateStep('auth', failedKey('auth') ? 'failed' : 'done',
      data?.auth_created ? 'New account created' : 'Existing account synced');
    updateStep('role', failedKey('role') ? 'failed' : 'done', 'Student role assigned');
    updateStep('enroll', failedKey('enrollment') ? 'failed' : 'done', 'Enrollment active');
    updateStep('class', failedKey('class') || !data?.class_assigned ? 'failed' : 'done',
      data?.class_assigned ? `Added to ${data.class_assigned}` : 'No class available');
    updateStep('chat', failedKey('chat') || !data?.chat_joined ? 'failed' : 'done',
      data?.chat_joined ? 'Joined class chat' : 'Could not join chat');

    setResult({
      tempPassword: data?.temp_password,
      loginEmail: data?.login_email,
      classAssigned: data?.class_assigned,
      failedSteps: failed,
    });
    setPhase('done');
    onActivated?.();
    toast.success(`${data?.student_name || 'Student'} activated!`);
  }

  function handleClose() {
    if (phase === 'running') return;
    onOpenChange(false);
    setTimeout(reset, 200);
  }

  const firstName = (applicant?.full_name || 'User').split(/\s+/)[0];
  const expectedPassword = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() + '1234';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Activate Student</DialogTitle>
              <DialogDescription>
                This will fully onboard <strong>{applicant?.full_name}</strong> in 5 steps:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {INITIAL_STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <div><span className="text-muted-foreground">Login email:</span> <code className="font-medium">{applicant?.email}</code></div>
              <div><span className="text-muted-foreground">Temp password:</span> <code className="font-medium">{expectedPassword}</code></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleActivate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Activate Now
              </Button>
            </DialogFooter>
          </>
        )}

        {(phase === 'running' || phase === 'done' || phase === 'error') && (
          <>
            <DialogHeader>
              <DialogTitle>
                {phase === 'running' && 'Activating…'}
                {phase === 'done' && '✅ Activation Complete'}
                {phase === 'error' && '⚠ Activation Failed'}
              </DialogTitle>
              <DialogDescription>
                {applicant?.full_name} • {applicant?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              {steps.map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.key} className={cn(
                    'flex items-center gap-3 text-sm rounded-md p-2 transition-colors',
                    s.state === 'running' && 'bg-blue-50 dark:bg-blue-950/30',
                    s.state === 'done' && 'bg-emerald-50 dark:bg-emerald-950/30',
                    s.state === 'failed' && 'bg-destructive/10',
                  )}>
                    <span className="w-6 flex items-center justify-center">
                      {s.state === 'pending' && <Circle className="h-4 w-4 text-muted-foreground" />}
                      {s.state === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {s.state === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {s.state === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{s.label}</div>
                      {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === 'done' && result?.tempPassword && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 space-y-2 text-sm">
                <div className="font-medium text-emerald-700 dark:text-emerald-400">Login credentials</div>
                <div className="flex items-center gap-2">
                  <code className="bg-background px-2 py-1 rounded text-xs flex-1">{result.loginEmail}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    navigator.clipboard.writeText(result.loginEmail || '');
                    toast.success('Email copied');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-background px-2 py-1 rounded text-xs flex-1">{result.tempPassword}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                    navigator.clipboard.writeText(result.tempPassword || '');
                    toast.success('Password copied');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {phase === 'error' && result?.error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                {result.error}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose} disabled={phase === 'running'}>
                {phase === 'running' ? 'Please wait…' : 'Close'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
