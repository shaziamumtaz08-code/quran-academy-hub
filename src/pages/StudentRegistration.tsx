import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Country } from 'country-state-city';
import {
  BookOpen, CheckCircle2, GraduationCap, Loader2, MapPin, Plus, Send,
  ShieldCheck, Trash2, User, Users,
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
import { TermsAcceptance, recordPolicyAcceptance } from '@/components/policies/TermsAcceptance';

const COUNTRIES = Country.getAllCountries();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Household = {
  countryCode: string; country: string; city: string; timezone: string; address: string; dialCode: string;
  fatherName: string; fatherPhone: string; motherName: string; motherPhone: string;
  guardianEmail: string; emergencyName: string; emergencyPhone: string;
  hearAbout: string; consent: boolean;
};

type Student = {
  key: string;
  fullName: string; dob: string; gender: string; language: string;
  phone: string; whatsappSame: boolean; whatsapp: string; email: string; useGuardianEmail: boolean;
  schoolName: string; gradeLevel: string; currentLevel: string;
  medicalNotes: string; goals: string;
};

const emptyStudent = (): Student => ({
  key: Math.random().toString(36).slice(2),
  fullName: '', dob: '', gender: '', language: '',
  phone: '', whatsappSame: true, whatsapp: '', email: '', useGuardianEmail: false,
  schoolName: '', gradeLevel: '', currentLevel: '',
  medicalNotes: '', goals: '',
});

const initialHousehold: Household = {
  countryCode: '', country: '', city: '', timezone: '', address: '', dialCode: '',
  fatherName: '', fatherPhone: '', motherName: '', motherPhone: '',
  guardianEmail: '', emergencyName: '', emergencyPhone: '',
  hearAbout: '', consent: false,
};

function Section({
  index, title, subtitle, icon: Icon, children,
}: { index: number | string; title: string; subtitle: string; icon: any; children: React.ReactNode }) {
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
  const [home, setHome] = useState<Household>(initialHousehold);
  const [students, setStudents] = useState<Student[]>([emptyStudent()]);
  const [submitted, setSubmitted] = useState(false);

  const set = (patch: Partial<Household>) => setHome(current => ({ ...current, ...patch }));
  const setStudent = (key: string, patch: Partial<Student>) =>
    setStudents(list => list.map(item => (item.key === key ? { ...item, ...patch } : item)));

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

  const locationDone = Boolean(home.country && home.timezone);
  const dial = home.dialCode || '+—';
  const withDial = (value: string) => (value.trim() ? `${home.dialCode} ${value.trim()}`.trim() : '');
  const studentEmail = (student: Student) =>
    (student.useGuardianEmail ? home.guardianEmail : student.email).trim();

  const studentValid = (student: Student) => Boolean(
    student.fullName.trim() && student.dob && EMAIL_RE.test(studentEmail(student)),
  );

  const valid = useMemo(() => Boolean(
    locationDone && home.address.trim() &&
    home.fatherName.trim() && home.fatherPhone.trim() && home.motherName.trim() && home.motherPhone.trim() &&
    home.emergencyPhone.trim() && home.consent && students.length && students.every(studentValid),
  ), [home, students, locationDone]);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('family_registrations').insert({
        parent_name: home.fatherName.trim() || home.motherName.trim(),
        relationship: 'Parent',
        email: (home.guardianEmail.trim() || studentEmail(students[0])),
        phone: withDial(home.fatherPhone || home.motherPhone),
        country: home.country || null,
        city: home.city || null,
        timezone: home.timezone || null,
        address: home.address.trim() || null,
        preferred_contact: 'WhatsApp',
        registration_type: 'parent',
        notes: [
          home.hearAbout && `Heard about us: ${home.hearAbout}`,
          home.emergencyName && `Emergency contact: ${home.emergencyName} ${withDial(home.emergencyPhone)}`,
          `Mother: ${home.motherName} ${withDial(home.motherPhone)}`,
        ].filter(Boolean).join(' | ') || null,
        source_url: window.location.href,
        status: 'pending',
        children: students.map(student => ({
          name: student.fullName.trim(),
          email: studentEmail(student),
          uses_parent_email: student.useGuardianEmail,
          date_of_birth: student.dob || null,
          gender: student.gender || null,
          phone: withDial(student.phone),
          whatsapp: student.whatsappSame ? withDial(student.phone) : withDial(student.whatsapp),
          school_name: student.schoolName.trim() || null,
          grade_level: student.gradeLevel.trim() || null,
          level: student.currentLevel || null,
          goals: student.goals || null,
          medical_notes: student.medicalNotes || null,
          preferred_language: student.language || null,
        })),
      });
      if (error) throw error;
      await recordPolicyAcceptance({
        audience: 'student',
        name: home.fatherName.trim() || home.motherName.trim(),
        email: (home.guardianEmail.trim() || studentEmail(students[0])),
      });
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
              JazakAllah Khair. We have registered {students.length} student{students.length > 1 ? 's' : ''}.
              Our admissions team will review the details and contact you with class timings and portal access.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="enrol-scope min-h-screen bg-background pb-28 font-body text-foreground">
      <header className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary-foreground/60">
            Al Quran Time Academy
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Student enrolment</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
            One page, one submission — for a single student or for all the children in a family.
            Add as many students as you need at the bottom of the form.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-primary-foreground/70">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Details stay private</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Takes about 4 minutes</span>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 max-w-3xl space-y-6 px-4">
        <Section index={1} title="Where the family lives" subtitle="Country first — it sets the timezone and phone code for you." icon={MapPin}>
          <Field label="Country" required>
            <Select value={home.countryCode} onValueChange={chooseCountry}>
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
              countryCode={home.countryCode}
              value={home.city}
              onValueChange={value => set({ city: value })}
              disabled={!home.countryCode}
              className="h-11"
            />
          </Field>
          <Field label="Timezone" hint="Class times will be shown in this timezone.">
            <Input value={home.timezone} onChange={e => set({ timezone: e.target.value })} placeholder="Select a country first" className="h-11" />
          </Field>
          <Field label="Residential address" required wide>
            <Textarea value={home.address} onChange={e => set({ address: e.target.value })} rows={2} placeholder="Street, area, postal code" />
          </Field>
        </Section>

        <Section index={2} title="Parents & emergency contact" subtitle="One set of details covers every student added below." icon={Users}>
          <Field label="Father's full name" required>
            <Input value={home.fatherName} onChange={e => set({ fatherName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Father's contact number" required>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
              <Input value={home.fatherPhone} onChange={e => set({ fatherPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
          <Field label="Mother's full name" required>
            <Input value={home.motherName} onChange={e => set({ motherName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Mother's contact number" required>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
              <Input value={home.motherPhone} onChange={e => set({ motherPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
          <Field label="Parent / guardian email" hint="Students can reuse this instead of their own email.">
            <Input type="email" value={home.guardianEmail} onChange={e => set({ guardianEmail: e.target.value })} className="h-11" />
          </Field>
          <Field label="Emergency contact name">
            <Input value={home.emergencyName} onChange={e => set({ emergencyName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Emergency contact number" required wide>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
              <Input value={home.emergencyPhone} onChange={e => set({ emergencyPhone: e.target.value })} className="h-11 flex-1" />
            </div>
          </Field>
        </Section>

        {students.map((student, index) => (
          <section
            key={student.key}
            className="relative rounded-3xl border border-border/70 bg-card p-6 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.55)] sm:p-8"
          >
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/25">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Student {index + 1}</p>
                <h2 className="font-heading text-xl font-semibold leading-tight text-foreground">
                  {student.fullName.trim() || 'Student details'}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Identity, academics, wellbeing and preferred timings.</p>
              </div>
              {students.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setStudents(list => list.filter(item => item.key !== student.key))}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                </Button>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required>
                <Input value={student.fullName} onChange={e => setStudent(student.key, { fullName: e.target.value })} placeholder="e.g. Aairah Khan" className="h-11" />
              </Field>
              <Field label="Date of birth" required>
                <Input type="date" value={student.dob} onChange={e => setStudent(student.key, { dob: e.target.value })} className="h-11" />
              </Field>
              <Field label="Gender">
                <Select value={student.gender} onValueChange={value => setStudent(student.key, { gender: value })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Preferred language of instruction">
                <Select value={student.language} onValueChange={value => setStudent(student.key, { language: value })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Urdu">Urdu</SelectItem>
                    <SelectItem value="Arabic">Arabic</SelectItem>
                    <SelectItem value="Mixed">English + Urdu</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Email address" required hint="Portal login and reports are sent here.">
                <div className="space-y-2">
                  <Input
                    type="email"
                    value={student.useGuardianEmail ? home.guardianEmail : student.email}
                    disabled={student.useGuardianEmail}
                    onChange={e => setStudent(student.key, { email: e.target.value })}
                    placeholder="name@email.com"
                    className="h-11"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={student.useGuardianEmail}
                      onCheckedChange={value => setStudent(student.key, { useGuardianEmail: Boolean(value) })}
                    />
                    Use the parent / guardian email
                  </label>
                </div>
              </Field>
              <Field label="Phone number">
                <div className="flex gap-2">
                  <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
                  <Input value={student.phone} onChange={e => setStudent(student.key, { phone: e.target.value })} disabled={!locationDone} placeholder="300 1234567" className="h-11 flex-1" />
                </div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={student.whatsappSame} onCheckedChange={value => setStudent(student.key, { whatsappSame: Boolean(value) })} />
                  WhatsApp is the same number
                </label>
                {!student.whatsappSame && (
                  <div className="mt-2 flex gap-2">
                    <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
                    <Input value={student.whatsapp} onChange={e => setStudent(student.key, { whatsapp: e.target.value })} placeholder="WhatsApp number" className="h-11 flex-1" />
                  </div>
                )}
              </Field>

              <Field label="School / institute">
                <Input value={student.schoolName} onChange={e => setStudent(student.key, { schoolName: e.target.value })} className="h-11" />
              </Field>
              <Field label="Grade / class">
                <Input value={student.gradeLevel} onChange={e => setStudent(student.key, { gradeLevel: e.target.value })} placeholder="e.g. Grade 6" className="h-11" />
              </Field>
              <Field label="Current Quran / Arabic level" wide hint="e.g. Qaida page 12, Juz 3 memorised, complete beginner.">
                <Input value={student.currentLevel} onChange={e => setStudent(student.key, { currentLevel: e.target.value })} className="h-11" />
              </Field>

              <Field label="Medical conditions or special needs" wide>
                <Input value={student.medicalNotes} onChange={e => setStudent(student.key, { medicalNotes: e.target.value })} placeholder="Anything the teacher should know" className="h-11" />
              </Field>

              <Field label="Learning goals" wide>
                <Textarea value={student.goals} onChange={e => setStudent(student.key, { goals: e.target.value })} rows={2} placeholder="What should the student achieve in the next 6 months?" />
              </Field>
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={() => setStudents(list => [...list, emptyStudent()])}
          className="group flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-accent/40 bg-accent/5 px-6 py-5 text-sm font-semibold text-accent transition-all hover:border-accent hover:bg-accent/10"
        >
          <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
          Add another student (same parents & address)
        </button>

        <Section index="✓" title="Confirmation" subtitle="Last step before submitting." icon={GraduationCap}>
          <Field label="How did you hear about us?" wide>
            <Input value={home.hearAbout} onChange={e => set({ hearAbout: e.target.value })} className="h-11" />
          </Field>
          <TermsAcceptance
            audience="student"
            checked={home.consent}
            onChange={value => set({ consent: value })}
            label="I confirm the information above is correct and I have read and accept Al Quran Time Academy's terms & conditions, enrolment contract, learning agreement, attendance policy and privacy policy."
          />
        </Section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {valid
              ? `Ready to submit — ${students.length} student${students.length > 1 ? 's' : ''}.`
              : 'Complete the fields marked * to submit.'}
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
