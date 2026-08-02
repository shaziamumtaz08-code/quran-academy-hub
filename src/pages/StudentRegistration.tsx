import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Country } from 'country-state-city';
import {
  BookOpen, CheckCircle2, GraduationCap, HeartPulse, Loader2, MapPin, Phone, Send, ShieldCheck, User, Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCitySelect } from '@/components/ui/searchable-city-select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COUNTRIES = Country.getAllCountries();
const SUBJECTS = ['Quran Recitation', 'Tajweed', 'Quran Memorization', 'Qaida (Beginners)', 'Arabic Language', 'Quranic Arabic', 'Tafseer', 'Islamic Studies'];
const DAY_SETS = ['Mon–Fri', 'Sat–Sun', 'Mon / Wed / Fri', 'Tue / Thu / Sat', 'Any day'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  // identity
  fullName: string; dob: string; gender: string;
  // location
  countryCode: string; country: string; city: string; timezone: string; address: string;
  // contact
  dialCode: string; phone: string; whatsappSame: boolean; whatsapp: string; email: string;
  // academics
  schoolName: string; gradeLevel: string; currentLevel: string;
  // guardian
  fatherName: string; fatherPhone: string; motherName: string; motherPhone: string;
  guardianEmail: string; emergencyName: string; emergencyPhone: string;
  // wellbeing
  bloodGroup: string; medicalNotes: string;
  // learning
  subjects: string[]; goals: string; days: string; time1: string; time2: string; language: string; hearAbout: string;
  consent: boolean;
};

const initial: FormState = {
  fullName: '', dob: '', gender: '',
  countryCode: '', country: '', city: '', timezone: '', address: '',
  dialCode: '', phone: '', whatsappSame: true, whatsapp: '', email: '',
  schoolName: '', gradeLevel: '', currentLevel: '',
  fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
  guardianEmail: '', emergencyName: '', emergencyPhone: '',
  bloodGroup: '', medicalNotes: '',
  subjects: [], goals: '', days: '', time1: '', time2: '', language: '', hearAbout: '',
  consent: false,
};

function Section({
  index, title, subtitle, icon: Icon, children,
}: { index: number; title: string; subtitle: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="relative rounded-3xl border border-border/70 bg-card p-6 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.55)] sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Step {index}</p>
          <h2 className="font-heading text-xl font-semibold leading-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label, required, hint, wide, children,
}: { label: string; required?: boolean; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-2', wide && 'sm:col-span-2')}>
      <Label className="text-[13px] font-medium text-foreground">
        {label}{required && <span className="ml-1 text-accent">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function StudentRegistration() {
  const [form, setForm] = useState<FormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<FormState>) => setForm(current => ({ ...current, ...patch }));

  const chooseCountry = (isoCode: string) => {
    const country = COUNTRIES.find(item => item.isoCode === isoCode);
    if (!country) return;
    set({
      countryCode: isoCode,
      country: country.name,
      city: '',
      timezone: country.timezones?.[0]?.zoneName || '',
      dialCode: country.phonecode.startsWith('+') ? country.phonecode : `+${country.phonecode}`,
    });
  };

  const toggleSubject = (subject: string) => set({
    subjects: form.subjects.includes(subject) ? form.subjects.filter(item => item !== subject) : [...form.subjects, subject],
  });

  const locationDone = Boolean(form.country && form.timezone);
  const valid = useMemo(() => Boolean(
    form.fullName.trim() && form.dob && locationDone && form.phone.trim() &&
    EMAIL_RE.test(form.email.trim()) && form.address.trim() &&
    form.fatherName.trim() && form.fatherPhone.trim() && form.motherName.trim() && form.motherPhone.trim() &&
    form.emergencyPhone.trim() && form.schoolName.trim() && form.gradeLevel.trim() &&
    form.subjects.length && form.consent,
  ), [form, locationDone]);

  const withDial = (value: string) => (value.trim() ? `${form.dialCode} ${value.trim()}`.trim() : '');

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('family_registrations').insert({
        parent_name: form.fatherName.trim() || form.motherName.trim(),
        relationship: 'Parent',
        email: (form.guardianEmail.trim() || form.email.trim()),
        phone: withDial(form.fatherPhone || form.phone),
        country: form.country || null,
        city: form.city || null,
        timezone: form.timezone || null,
        address: form.address.trim() || null,
        preferred_contact: 'WhatsApp',
        notes: [
          form.medicalNotes && `Medical: ${form.medicalNotes}`,
          form.hearAbout && `Heard about us: ${form.hearAbout}`,
          form.bloodGroup && `Blood group: ${form.bloodGroup}`,
          form.emergencyName && `Emergency contact: ${form.emergencyName} ${withDial(form.emergencyPhone)}`,
          form.motherName && `Mother: ${form.motherName} ${withDial(form.motherPhone)}`,
        ].filter(Boolean).join(' | ') || null,
        source_url: window.location.href,
        status: 'pending',
        children: [{
          name: form.fullName.trim(),
          email: form.email.trim(),
          uses_parent_email: false,
          date_of_birth: form.dob || null,
          gender: form.gender || null,
          phone: withDial(form.phone),
          whatsapp: form.whatsappSame ? withDial(form.phone) : withDial(form.whatsapp),
          school_name: form.schoolName.trim() || null,
          grade_level: form.gradeLevel.trim() || null,
          subjects: form.subjects,
          level: form.currentLevel || null,
          goals: form.goals || null,
          preferred_time_1: form.time1 || null,
          preferred_time_2: form.time2 || null,
          preferred_days: form.days || null,
          preferred_language: form.language || null,
        }],
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: any) => toast({ title: 'Could not submit', description: error.message, variant: 'destructive' }),
  });

  if (submitted) {
    return (
      <div className="enrol-scope min-h-screen bg-background">
        <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4">
          <section className="w-full rounded-3xl border border-border/70 bg-card p-10 text-center shadow-[0_30px_70px_-40px_hsl(var(--primary)/0.7)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-heading text-2xl font-semibold text-foreground">Registration received</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              JazakAllah Khair, {form.fullName.split(' ')[0]}. Our admissions team will review the details and
              contact you on <span className="font-medium text-foreground">{form.email}</span> with class timings and login access.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="enrol-scope min-h-screen bg-background pb-28 font-body text-foreground">
      {/* Hero */}
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(var(--accent)) 0, transparent 45%), radial-gradient(circle at 85% 0%, hsl(var(--accent)) 0, transparent 40%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/80 ring-1 ring-primary-foreground/20">
            <GraduationCap className="h-3.5 w-3.5" /> Al Quran Time Academy
          </span>
          <h1 className="mt-5 font-heading text-3xl font-semibold leading-tight sm:text-[2.6rem]">
            Student enrolment form
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
            One page, one submission. Fill it once — admissions verifies the details and sets up classes,
            teacher allocation and portal access for the student.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-primary-foreground/70">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Details stay private</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Takes about 4 minutes</span>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 max-w-3xl space-y-6 px-4">
        <Section index={1} title="Student identity" subtitle="Exactly as it should appear on certificates." icon={User}>
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={e => set({ fullName: e.target.value })} placeholder="e.g. Aairah Khan" className="h-11" />
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" value={form.dob} onChange={e => set({ dob: e.target.value })} className="h-11" />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onValueChange={value => set({ gender: value })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Preferred language of instruction">
            <Select value={form.language} onValueChange={value => set({ language: value })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Urdu">Urdu</SelectItem>
                <SelectItem value="Arabic">Arabic</SelectItem>
                <SelectItem value="Mixed">English + Urdu</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section index={2} title="Where the student lives" subtitle="Country first — it sets the timezone and phone code for you." icon={MapPin}>
          <Field label="Country" required>
            <Select value={form.countryCode} onValueChange={chooseCountry}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {COUNTRIES.map(country => (
                  <SelectItem key={country.isoCode} value={country.isoCode}>{country.flag} {country.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="City">
            <SearchableCitySelect
              countryCode={form.countryCode}
              value={form.city}
              onValueChange={value => set({ city: value })}
              disabled={!form.countryCode}
              className="h-11"
            />
          </Field>
          <Field label="Timezone" hint="Class times will be shown in this timezone.">
            <Input value={form.timezone} onChange={e => set({ timezone: e.target.value })} placeholder="Select a country first" className="h-11" />
          </Field>
          <Field label="Residential address" required wide>
            <Textarea value={form.address} onChange={e => set({ address: e.target.value })} rows={2} placeholder="Street, area, postal code" />
          </Field>
        </Section>

        <Section index={3} title="How we reach the student" subtitle="Country code is filled from the location above." icon={Phone}>
          <Field label="Phone number" required>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                {form.dialCode || '+—'}
              </span>
              <Input value={form.phone} onChange={e => set({ phone: e.target.value })} disabled={!locationDone} placeholder="300 1234567" className="h-11 flex-1" />
            </div>
          </Field>
          <Field label="Email address" required hint="Portal login and reports are sent here.">
            <Input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="name@email.com" className="h-11" />
          </Field>
          <div className="sm:col-span-2 space-y-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
              <Checkbox checked={form.whatsappSame} onCheckedChange={value => set({ whatsappSame: Boolean(value) })} />
              WhatsApp is the same as the number above
            </label>
            {!form.whatsappSame && (
              <div className="flex gap-2">
                <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                  {form.dialCode || '+—'}
                </span>
                <Input value={form.whatsapp} onChange={e => set({ whatsapp: e.target.value })} placeholder="WhatsApp number" className="h-11 flex-1" />
              </div>
            )}
          </div>
        </Section>

        <Section index={4} title="Parents & emergency contact" subtitle="Required for every student, including adults enrolling themselves." icon={Users}>
          <Field label="Father's full name" required>
            <Input value={form.fatherName} onChange={e => set({ fatherName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Father's contact number" required>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{form.dialCode || '+—'}</span>
              <Input value={form.fatherPhone} onChange={e => set({ fatherPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
          <Field label="Mother's full name" required>
            <Input value={form.motherName} onChange={e => set({ motherName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Mother's contact number" required>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{form.dialCode || '+—'}</span>
              <Input value={form.motherPhone} onChange={e => set({ motherPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
          <Field label="Guardian email" hint="Leave blank to use the student's email.">
            <Input type="email" value={form.guardianEmail} onChange={e => set({ guardianEmail: e.target.value })} className="h-11" />
          </Field>
          <Field label="Emergency contact name">
            <Input value={form.emergencyName} onChange={e => set({ emergencyName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Emergency contact number" required wide>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{form.dialCode || '+—'}</span>
              <Input value={form.emergencyPhone} onChange={e => set({ emergencyPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
        </Section>

        <Section index={5} title="Academic background" subtitle="Helps us place the student at the right level." icon={GraduationCap}>
          <Field label="School / institute" required>
            <Input value={form.schoolName} onChange={e => set({ schoolName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Grade / class" required>
            <Input value={form.gradeLevel} onChange={e => set({ gradeLevel: e.target.value })} placeholder="e.g. Grade 6" className="h-11" />
          </Field>
          <Field label="Current Quran / Arabic level" wide hint="e.g. Qaida page 12, Juz 3 memorised, complete beginner.">
            <Input value={form.currentLevel} onChange={e => set({ currentLevel: e.target.value })} className="h-11" />
          </Field>
        </Section>

        <Section index={6} title="Wellbeing" subtitle="Shared only with the assigned teacher and admissions." icon={HeartPulse}>
          <Field label="Blood group">
            <Input value={form.bloodGroup} onChange={e => set({ bloodGroup: e.target.value })} placeholder="e.g. O+" className="h-11" />
          </Field>
          <Field label="Medical conditions or special needs" wide>
            <Textarea value={form.medicalNotes} onChange={e => set({ medicalNotes: e.target.value })} rows={2} placeholder="Anything the teacher should know" />
          </Field>
        </Section>

        <Section index={7} title="Courses & timings" subtitle="Pick the subjects and the slots that suit the student." icon={BookOpen}>
          <div className="sm:col-span-2 space-y-3">
            <Label className="text-[13px] font-medium text-foreground">Subjects<span className="ml-1 text-accent">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(subject => {
                const active = form.subjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm transition-all',
                      active
                        ? 'border-accent bg-accent text-accent-foreground shadow-[0_8px_20px_-10px_hsl(var(--accent))]'
                        : 'border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground',
                    )}
                  >
                    {subject}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Preferred days">
            <Select value={form.days} onValueChange={value => set({ days: value })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {DAY_SETS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="How did you hear about us?">
            <Input value={form.hearAbout} onChange={e => set({ hearAbout: e.target.value })} className="h-11" />
          </Field>
          <Field label="Preferred time" hint={form.timezone ? `In ${form.timezone}` : 'Select a country to set your timezone'}>
            <Input type="time" value={form.time1} onChange={e => set({ time1: e.target.value })} className="h-11" />
          </Field>
          <Field label="Backup time">
            <Input type="time" value={form.time2} onChange={e => set({ time2: e.target.value })} className="h-11" />
          </Field>
          <Field label="Learning goals" wide>
            <Textarea value={form.goals} onChange={e => set({ goals: e.target.value })} rows={3} placeholder="What should the student achieve in the next 6 months?" />
          </Field>
        </Section>

        <section className="rounded-3xl border border-accent/30 bg-accent/5 p-6 sm:p-8">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground">
            <Checkbox checked={form.consent} onCheckedChange={value => set({ consent: Boolean(value) })} className="mt-0.5" />
            <span>
              I confirm the information above is correct and I agree to Al Quran Time Academy's terms,
              attendance policy and privacy policy.<span className="ml-1 text-accent">*</span>
            </span>
          </label>
        </section>
      </main>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {valid ? 'All required details are complete.' : 'Complete the fields marked * to submit.'}
          </p>
          <Button
            size="lg"
            disabled={!valid || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full gap-2 rounded-xl text-base font-semibold sm:w-auto sm:px-8"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit enrolment
          </Button>
        </div>
      </div>
    </div>
  );
}
