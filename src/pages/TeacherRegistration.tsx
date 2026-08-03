import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Country } from 'country-state-city';
import {
  BriefcaseBusiness, CheckCircle2, Landmark, Loader2, MapPin, Send, ShieldCheck, User, Video,
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYOUT_METHODS = ['Bank account', 'Easypaisa', 'JazzCash', 'SadaPay', 'NayaPay', 'Wise', 'Payoneer'];

type Form = {
  fullName: string; dob: string; gender: string;
  countryCode: string; country: string; city: string; timezone: string; dialCode: string; address: string;
  phone: string; whatsappSame: boolean; whatsapp: string; email: string;
  qualification: string; specialization: string; yearsExperience: string; previousInstitutes: string;
  subjects: string[]; languages: string; availability: string; expectedSalary: string;
  payoutMethod: string; bankName: string; accountTitle: string; accountNumber: string; iban: string; branch: string;
  zoomEmail: string; hearAbout: string; about: string; consent: boolean;
};

const initial: Form = {
  fullName: '', dob: '', gender: '',
  countryCode: '', country: '', city: '', timezone: '', dialCode: '', address: '',
  phone: '', whatsappSame: true, whatsapp: '', email: '',
  qualification: '', specialization: '', yearsExperience: '', previousInstitutes: '',
  subjects: [], languages: '', availability: '', expectedSalary: '',
  payoutMethod: 'Bank account', bankName: '', accountTitle: '', accountNumber: '', iban: '', branch: '',
  zoomEmail: '', hearAbout: '', about: '', consent: false,
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

export default function TeacherRegistration() {
  const [form, setForm] = useState<Form>(initial);
  const [submitted, setSubmitted] = useState(false);
  const set = (patch: Partial<Form>) => setForm(current => ({ ...current, ...patch }));

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

  const dial = form.dialCode || '+—';
  const withDial = (value: string) => (value.trim() ? `${form.dialCode} ${value.trim()}`.trim() : '');
  const locationDone = Boolean(form.country && form.timezone);

  const payoutDone = Boolean(form.payoutMethod && form.accountTitle.trim() && form.accountNumber.trim());

  const valid = useMemo(() => Boolean(
    form.fullName.trim() && EMAIL_RE.test(form.email.trim()) && form.phone.trim() && locationDone &&
    form.qualification.trim() && form.yearsExperience.trim() && form.subjects.length && payoutDone && form.consent,
  ), [form, locationDone, payoutDone]);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('family_registrations').insert({
        parent_name: form.fullName.trim(),
        relationship: 'Teacher applicant',
        email: form.email.trim(),
        phone: withDial(form.phone),
        country: form.country || null,
        city: form.city || null,
        timezone: form.timezone || null,
        address: form.address.trim() || null,
        occupation: form.specialization.trim() || 'Teacher',
        preferred_contact: 'WhatsApp',
        registration_type: 'teacher',
        status: 'pending',
        source_url: window.location.href,
        children: [],
        notes: [
          `Qualification: ${form.qualification}`,
          form.specialization && `Specialization: ${form.specialization}`,
          `Experience: ${form.yearsExperience} years`,
          form.subjects.length && `Subjects: ${form.subjects.join(', ')}`,
          form.availability && `Availability: ${form.availability}`,
        ].filter(Boolean).join(' | '),
        applicant_data: {
          full_name: form.fullName.trim(),
          date_of_birth: form.dob || null,
          gender: form.gender || null,
          whatsapp: form.whatsappSame ? withDial(form.phone) : withDial(form.whatsapp),
          qualification: form.qualification.trim(),
          specialization: form.specialization.trim() || null,
          years_experience: Number(form.yearsExperience) || 0,
          previous_institutes: form.previousInstitutes.trim() || null,
          subjects: form.subjects,
          languages: form.languages.trim() || null,
          availability: form.availability.trim() || null,
          expected_salary: form.expectedSalary.trim() || null,
          zoom_email: form.zoomEmail.trim() || null,
          heard_about: form.hearAbout.trim() || null,
          about: form.about.trim() || null,
          banking: {
            payout_method: form.payoutMethod,
            bank_name: form.bankName.trim() || form.payoutMethod,
            bank_account_title: form.accountTitle.trim(),
            bank_account_number: form.accountNumber.trim(),
            bank_iban: form.iban.trim() || null,
            branch: form.branch.trim() || null,
          },
        },
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
            <h1 className="mt-5 font-heading text-2xl font-semibold text-foreground">Application received</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              JazakAllah Khair, {form.fullName.split(' ')[0]}. Our academic team will review your application
              and contact you on <span className="font-medium text-foreground">{form.email}</span> for the demo lesson.
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
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-4xl">Teach with AQTA</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
            One page, one submission. Tell us who you are, what you teach and when you are available —
            shortlisted teachers are invited for a demo lesson.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-primary-foreground/70">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Details stay private</span>
            <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="h-3.5 w-3.5" /> Takes about 3 minutes</span>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-8 max-w-3xl space-y-6 px-4">
        <Section index={1} title="Where you are based" subtitle="Country first — it sets your timezone and phone code." icon={MapPin}>
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
          <Field label="Timezone" hint="Class allocations respect this timezone.">
            <Input value={form.timezone} onChange={e => set({ timezone: e.target.value })} placeholder="Select a country first" className="h-11" />
          </Field>
          <Field label="Residential address">
            <Input value={form.address} onChange={e => set({ address: e.target.value })} className="h-11" />
          </Field>
        </Section>

        <Section index={2} title="Your identity & contact" subtitle="Exactly as on your CNIC / passport." icon={User}>
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={e => set({ fullName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Date of birth">
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
          <Field label="Email address" required hint="Your LMS login is created with this email.">
            <Input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="name@email.com" className="h-11" />
          </Field>
          <Field label="Phone number" required wide>
            <div className="flex gap-2">
              <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
              <Input value={form.phone} onChange={e => set({ phone: e.target.value })} disabled={!locationDone} placeholder="300 1234567" className="h-11 flex-1" />
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={form.whatsappSame} onCheckedChange={value => set({ whatsappSame: Boolean(value) })} />
              WhatsApp is the same number
            </label>
            {!form.whatsappSame && (
              <div className="mt-2 flex gap-2">
                <span className="inline-flex h-11 min-w-[4.5rem] items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">{dial}</span>
                <Input value={form.whatsapp} onChange={e => set({ whatsapp: e.target.value })} placeholder="WhatsApp number" className="h-11 flex-1" />
              </div>
            )}
          </Field>
        </Section>

        <Section index={3} title="Qualification & experience" subtitle="What you studied and where you have taught." icon={BriefcaseBusiness}>
          <Field label="Highest qualification" required>
            <Input value={form.qualification} onChange={e => set({ qualification: e.target.value })} placeholder="e.g. Hafiz-e-Quran, MA Islamic Studies" className="h-11" />
          </Field>
          <Field label="Specialization">
            <Input value={form.specialization} onChange={e => set({ specialization: e.target.value })} placeholder="e.g. Tajweed, Hifz" className="h-11" />
          </Field>
          <Field label="Years of teaching experience" required>
            <Input type="number" min={0} value={form.yearsExperience} onChange={e => set({ yearsExperience: e.target.value })} className="h-11" />
          </Field>
          <Field label="Expected monthly salary">
            <Input value={form.expectedSalary} onChange={e => set({ expectedSalary: e.target.value })} placeholder="e.g. PKR 60,000" className="h-11" />
          </Field>
          <Field label="Previous institutes / academies" wide>
            <Textarea value={form.previousInstitutes} onChange={e => set({ previousInstitutes: e.target.value })} rows={2} placeholder="Institute name, role, duration" />
          </Field>
        </Section>

        <Section index={4} title="Teaching profile" subtitle="Subjects, languages and the hours you can commit." icon={Video}>
          <div className="space-y-3 sm:col-span-2">
            <Label className="text-[13px] font-medium text-foreground">Subjects you can teach<span className="ml-1 text-accent">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(subject => {
                const active = form.subjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => set({
                      subjects: active ? form.subjects.filter(item => item !== subject) : [...form.subjects, subject],
                    })}
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
          <Field label="Languages you teach in">
            <Input value={form.languages} onChange={e => set({ languages: e.target.value })} placeholder="e.g. English, Urdu, Arabic" className="h-11" />
          </Field>
          <Field label="Zoom account email" hint="Leave blank if you do not have one — we will provide it.">
            <Input type="email" value={form.zoomEmail} onChange={e => set({ zoomEmail: e.target.value })} className="h-11" />
          </Field>
          <Field label="Weekly availability" wide hint={form.timezone ? `In ${form.timezone}` : 'Select a country to set your timezone'}>
            <Textarea value={form.availability} onChange={e => set({ availability: e.target.value })} rows={2} placeholder="e.g. Mon–Fri 4pm–9pm, Sat mornings" />
          </Field>
          <Field label="Tell us about yourself" wide>
            <Textarea value={form.about} onChange={e => set({ about: e.target.value })} rows={3} placeholder="Teaching style, achievements, ijazah, references" />
          </Field>
          <Field label="How did you hear about us?" wide>
            <Input value={form.hearAbout} onChange={e => set({ hearAbout: e.target.value })} className="h-11" />
          </Field>
        </Section>

        <Section
          index={5}
          title="Salary account details"
          subtitle="Where your salary is credited. Kept private — visible only to the finance admin."
          icon={Landmark}
        >
          <Field label="Payout method" required>
            <Select value={form.payoutMethod} onValueChange={value => set({ payoutMethod: value })}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bank / wallet name" hint="e.g. Meezan Bank, Easypaisa">
            <Input value={form.bankName} onChange={e => set({ bankName: e.target.value })} className="h-11" />
          </Field>
          <Field label="Account title" required hint="Exactly as registered with the bank / wallet.">
            <Input value={form.accountTitle} onChange={e => set({ accountTitle: e.target.value })} className="h-11" />
          </Field>
          <Field label="Account / wallet number" required>
            <Input value={form.accountNumber} onChange={e => set({ accountNumber: e.target.value })} className="h-11 font-mono" />
          </Field>
          <Field label="IBAN" hint="Required for local bank transfers in Pakistan.">
            <Input value={form.iban} onChange={e => set({ iban: e.target.value })} placeholder="PK00XXXX0000000000000000" className="h-11 font-mono uppercase" />
          </Field>
          <Field label="Branch / city">
            <Input value={form.branch} onChange={e => set({ branch: e.target.value })} className="h-11" />
          </Field>
        </Section>



        <section className="rounded-3xl border border-accent/30 bg-accent/5 p-6 sm:p-8">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground">
            <Checkbox checked={form.consent} onCheckedChange={value => set({ consent: Boolean(value) })} className="mt-0.5" />
            <span>
              I confirm the information above is correct and I agree to Al Quran Time Academy's hiring,
              conduct and privacy policies.<span className="ml-1 text-accent">*</span>
            </span>
          </label>
        </section>
      </main>

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
            Submit application
          </Button>
        </div>
      </div>
    </div>
  );
}
