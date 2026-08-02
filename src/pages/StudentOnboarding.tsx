import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, CheckCircle2, HeartPulse, User } from 'lucide-react';

type Values = Record<string, string>;

const STEPS = [
  { key: 'personal', title: 'Student & academics', icon: User, hint: 'Required — identity, contact and academic details.' },
  { key: 'medical', title: 'Parents & wellbeing', icon: HeartPulse, hint: 'Parent names, contact numbers and an emergency number are required.' },
  { key: 'learning', title: 'Learning preferences', icon: BookOpen, hint: 'Optional — you can update these later.' },
];

export default function StudentOnboarding() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!token) { setInvalid('Missing registration token.'); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke('student-onboarding', {
        body: { token, action: 'load' },
      });
      if (error || data?.error) {
        setInvalid(data?.error ?? 'This registration link is invalid or has expired.');
      } else {
        const p = data.profile ?? {};
        const clean: Values = {};
        Object.entries(p).forEach(([k, v]) => { if (typeof v === 'string') clean[k] = v; });
        setValues(clean);
      }
      setLoading(false);
    })();
  }, [token]);

  const save = async (complete: boolean) => {
    if (complete) {
      const required: Array<[string, string, number]> = [
        ['full_name', 'Student full name', 0],
        ['date_of_birth', 'Date of birth', 0],
        ['email', 'Email address', 0],
        ['address', 'Address', 0],
        ['school_name', 'School / institute', 0],
        ['grade_level', 'Grade / class', 0],
        ['father_name', "Father's name", 1],
        ['father_contact', "Father's contact number", 1],
        ['mother_name', "Mother's name", 1],
        ['mother_contact', "Mother's contact number", 1],
        ['emergency_contact_phone', 'Emergency contact number', 1],
      ];
      const missing = required.filter(([k]) => !values[k]?.trim());
      if (missing.length) {
        toast({ title: 'Please complete required fields', description: missing.map(([, l]) => l).join(', '), variant: 'destructive' });
        setStep(missing[0][2]);
        return;
      }
    } else if (!values.full_name?.trim()) {
      toast({ title: 'Student name is required', variant: 'destructive' });
      setStep(0);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('student-onboarding', {
      body: { token, action: 'save', values, complete },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: 'Could not save', description: data?.error ?? error?.message, variant: 'destructive' });
      return;
    }
    if (complete) setDone(true);
    else toast({ title: 'Saved' });
  };

  const Field = ({ k, label, type = 'text', area = false, placeholder }: { k: string; label: string; type?: string; area?: boolean; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {area ? (
        <Textarea id={k} value={values[k] ?? ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} rows={3} />
      ) : (
        <Input id={k} type={type} value={values[k] ?? ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-serif font-bold text-foreground">Student registration</h1>
            <p className="text-xs text-muted-foreground">
              Complete the student profile — fields marked * are required.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>
        ) : invalid ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">Link unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{invalid}</p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-teal-500" />
            <p className="mt-3 text-lg font-serif font-bold text-foreground">Registration submitted</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you. Our team will review the details and get in touch shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => setStep(i)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    i === step ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <s.icon className={`h-4 w-4 ${i === step ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="mt-1 text-xs font-semibold text-foreground">{s.title}</p>
                </button>
              ))}
            </div>

            <section className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="border-b bg-muted/30 px-5 py-3">
                <h2 className="font-semibold text-foreground">{STEPS[step].title}</h2>
                <p className="text-xs text-muted-foreground">{STEPS[step].hint}</p>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {step === 0 && (
                  <>
                    <Field k="full_name" label="Student full name *" />
                    <Field k="email" label="Email address *" type="email" />
                    <Field k="whatsapp_number" label="Phone / WhatsApp" />
                    <Field k="date_of_birth" label="Date of birth *" type="date" />
                    <Field k="gender" label="Gender (male / female)" />
                    <Field k="school_name" label="School / institute *" />
                    <Field k="grade_level" label="Grade / class *" />
                    <Field k="city" label="City" />
                    <Field k="country" label="Country" />
                    <Field k="timezone" label="Timezone" placeholder="e.g. Asia/Karachi" />
                    <div className="sm:col-span-2"><Field k="address" label="Address *" area /></div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <Field k="father_name" label="Father's full name *" />
                    <Field k="father_contact" label="Father's contact number *" />
                    <Field k="mother_name" label="Mother's full name *" />
                    <Field k="mother_contact" label="Mother's contact number *" />
                    <Field k="emergency_contact_name" label="Emergency contact name" />
                    <Field k="emergency_contact_phone" label="Emergency contact number *" />
                    <Field k="guardian_type" label="Relation to student" />
                    <Field k="blood_group" label="Blood group" placeholder="e.g. O+" />
                    <Field k="preferred_contact_method" label="Preferred contact method" />
                    <Field k="medical_conditions" label="Medical conditions" />
                    <div className="sm:col-span-2"><Field k="medical_notes" label="Medical notes" area /></div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <Field k="preferred_language" label="Preferred language" />
                    <Field k="arabic_level" label="Arabic / Quran level" />
                    <Field k="hear_about_us" label="How did you hear about us?" />
                    <div className="sm:col-span-2"><Field k="learning_goals" label="Learning goals" area /></div>
                    <div className="sm:col-span-2"><Field k="special_needs" label="Special needs / notes" area /></div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-5 py-3">
                <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => save(false)}>Save progress</Button>
                  {step < STEPS.length - 1 ? (
                    <Button size="sm" onClick={() => setStep((s) => s + 1)}>Next</Button>
                  ) : (
                    <Button size="sm" disabled={saving} onClick={() => save(true)}>Submit registration</Button>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
