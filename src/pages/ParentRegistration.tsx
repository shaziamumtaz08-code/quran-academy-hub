import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Search, Send, Sparkles, Trash2 } from 'lucide-react';
import { Country } from 'country-state-city';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCitySelect } from '@/components/ui/searchable-city-select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COUNTRIES = Country.getAllCountries();
const SUBJECTS = ['Quran Recitation', 'Tajweed', 'Quran Memorization', 'Arabic Language', 'Quranic Arabic', 'Tafseer', 'Islamic Studies', 'Qaida (Beginners)', 'Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS = ['Find your details', 'Your details', 'Children', 'Preferences', 'Review'];

type Child = {
  id: string; name: string; email: string; useParentEmail: boolean; age: string; gender: string;
  subjects: string[]; otherSubject: string; level: string; goals: string; time1: string; time2: string; days: string;
};
const newChild = (): Child => ({ id: crypto.randomUUID(), name: '', email: '', useParentEmail: true, age: '', gender: '', subjects: [], otherSubject: '', level: '', goals: '', time1: '', time2: '', days: '' });

export default function ParentRegistration() {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [children, setChildren] = useState<Child[]>([newChild()]);
  const [parent, setParent] = useState({
    name: '', relationship: 'Parent', email: '', phone: '', country: '', countryCode: '', city: '',
    timezone: '', address: '', occupation: '', preferredContact: 'WhatsApp', notes: '',
  });

  const patchParent = (patch: Partial<typeof parent>) => setParent(current => ({ ...current, ...patch }));
  const patchChild = (id: string, patch: Partial<Child>) => setChildren(current => current.map(child => child.id === id ? { ...child, ...patch } : child));
  const chooseCountry = (code: string) => {
    const country = COUNTRIES.find(item => item.isoCode === code);
    if (country) patchParent({ country: country.name, countryCode: code, city: '', timezone: country.timezones?.[0]?.zoneName || '' });
  };
  const toggleSubject = (child: Child, subject: string) => patchChild(child.id, {
    subjects: child.subjects.includes(subject) ? child.subjects.filter(item => item !== subject) : [...child.subjects, subject],
  });

  const lookup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('lookup_family_prefill', { _email: parent.email.trim(), _phone: parent.phone.trim() });
      if (error) throw error;
      return data as any;
    },
    onSuccess: data => {
      setLookupDone(true);
      if (!data?.found) {
        toast({ title: 'No earlier enquiry found', description: 'No problem — just fill the form in fresh.' });
        setStep(1);
        return;
      }
      setLeadId(data.lead_id ?? null);
      patchParent({
        name: parent.name || data.parent_name || '',
        relationship: data.relationship || parent.relationship,
        country: data.country || parent.country,
        city: data.city || parent.city,
        timezone: data.timezone || parent.timezone,
      });
      const prefilled: Child[] = (data.children ?? []).filter((item: any) => item?.name).map((item: any) => ({
        ...newChild(),
        name: item.name ?? '',
        age: item.age ? String(item.age) : '',
        gender: item.gender ?? '',
        subjects: SUBJECTS.filter(subject => String(item.subjects ?? '').toLowerCase().includes(subject.toLowerCase())),
        time1: '',
        days: item.preferred_time ?? '',
      }));
      if (prefilled.length) setChildren(prefilled);
      toast({ title: 'We found your enquiry', description: 'Your details are pre-filled — please check and update anything.' });
      setStep(1);
    },
    onError: () => { setLookupDone(true); setStep(1); },
  });

  const parentValid = Boolean(parent.name.trim() && EMAIL_RE.test(parent.email.trim()) && parent.phone.trim() && parent.country && parent.timezone);
  const childValid = (child: Child) => Boolean(
    child.name.trim() && child.subjects.length && child.time1 &&
    (!child.subjects.includes('Other') || child.otherSubject.trim()) &&
    (child.useParentEmail || EMAIL_RE.test(child.email.trim())),
  );
  const childrenValid = children.length > 0 && children.every(childValid);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('family_registrations').insert({
        parent_name: parent.name.trim(),
        relationship: parent.relationship || null,
        email: parent.email.trim(),
        phone: parent.phone.trim(),
        country: parent.country || null,
        city: parent.city || null,
        timezone: parent.timezone || null,
        address: parent.address || null,
        occupation: parent.occupation || null,
        preferred_contact: parent.preferredContact || null,
        notes: parent.notes || null,
        lead_id: leadId,
        source_url: window.location.href,
        status: 'pending',
        children: children.map(child => ({
          name: child.name.trim(),
          email: (child.useParentEmail ? parent.email : child.email).trim(),
          uses_parent_email: child.useParentEmail,
          age: child.age ? Number(child.age) : null,
          gender: child.gender || null,
          subjects: child.subjects.includes('Other') ? [...child.subjects.filter(s => s !== 'Other'), child.otherSubject.trim()] : child.subjects,
          level: child.level || null,
          goals: child.goals || null,
          preferred_time_1: child.time1 || null,
          preferred_time_2: child.time2 || null,
          preferred_days: child.days || null,
        })),
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: any) => toast({ title: 'Could not submit', description: error.message, variant: 'destructive' }),
  });

  if (submitted) return (
    <main className="min-h-screen grid place-items-center bg-background p-4">
      <section className="max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">JazakAllah Khair!</h1>
        <p className="text-muted-foreground">Your registration has been sent to our admissions team for review. Once approved, you and your children will receive login details on {parent.email}.</p>
      </section>
    </main>
  );

  const canContinue = step === 0 ? EMAIL_RE.test(parent.email.trim()) && parent.phone.trim().length > 5 : step === 1 ? parentValid : step === 2 ? childrenValid : true;

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-xl font-bold">Family registration</h1>
          <p className="text-sm opacity-90">Register yourself and your children with Al Quran Time Academy.</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((label, index) => (
            <li key={label} className={cn('rounded-full border px-3 py-1', index === step ? 'border-primary bg-primary/10 text-primary font-semibold' : index < step ? 'border-border text-muted-foreground' : 'border-dashed border-border text-muted-foreground/70')}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          {step === 0 && <>
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              Already enquired or booked a demo with us? Enter the same email and phone number and we will fill in whatever we already have, so you do not type it twice.
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Your email *</Label><Input className="mt-1" type="email" value={parent.email} onChange={event => patchParent({ email: event.target.value })} /></div>
              <div><Label>WhatsApp number *</Label><Input className="mt-1" value={parent.phone} onChange={event => patchParent({ phone: event.target.value })} placeholder="+92 300 1234567" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canContinue || lookup.isPending} onClick={() => lookup.mutate()}>
                {lookup.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}Check and continue
              </Button>
              <Button type="button" variant="ghost" disabled={!canContinue} onClick={() => { setLookupDone(true); setStep(1); }}>Skip, I'm new</Button>
            </div>
          </>}

          {step === 1 && <>
            <h2 className="font-semibold">Your details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Full name *</Label><Input className="mt-1" value={parent.name} onChange={event => patchParent({ name: event.target.value })} /></div>
              <div><Label>Relationship to student *</Label>
                <Select value={parent.relationship} onValueChange={relationship => patchParent({ relationship })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['Parent', 'Father', 'Mother', 'Guardian', 'Sibling', 'Other'].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Email *</Label><Input className="mt-1" type="email" value={parent.email} onChange={event => patchParent({ email: event.target.value })} /></div>
              <div><Label>WhatsApp number *</Label><Input className="mt-1" value={parent.phone} onChange={event => patchParent({ phone: event.target.value })} /></div>
              <div><Label>Country *</Label>
                <Select value={parent.countryCode} onValueChange={chooseCountry}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={parent.country || 'Select country'} /></SelectTrigger>
                  <SelectContent className="max-h-72">{COUNTRIES.map(country => <SelectItem key={country.isoCode} value={country.isoCode}>{country.flag} {country.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>City</Label><SearchableCitySelect className="mt-1" countryCode={parent.countryCode} value={parent.city} onValueChange={city => patchParent({ city })} /></div>
              <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={parent.address} onChange={event => patchParent({ address: event.target.value })} /></div>
              <div><Label>Occupation</Label><Input className="mt-1" value={parent.occupation} onChange={event => patchParent({ occupation: event.target.value })} /></div>
              <div><Label>Timezone</Label><Input className="mt-1" value={parent.timezone} onChange={event => patchParent({ timezone: event.target.value })} /></div>
            </div>
          </>}

          {step === 2 && <>
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold">Children to enrol ({children.length})</h2><p className="text-xs text-muted-foreground">Each child can use your email or their own.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => setChildren(current => [...current, newChild()])}><Plus className="h-4 w-4 mr-1" />Add child</Button>
            </div>
            {children.map((child, index) => (
              <div key={child.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{child.name || `Child ${index + 1}`}</p>
                  {children.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove child ${index + 1}`} onClick={() => setChildren(current => current.filter(item => item.id !== child.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
                <div className="grid sm:grid-cols-[1fr_100px_140px] gap-2">
                  <div><Label>Name *</Label><Input className="mt-1" value={child.name} onChange={event => patchChild(child.id, { name: event.target.value })} /></div>
                  <div><Label>Age</Label><Input className="mt-1" type="number" min="3" max="99" value={child.age} onChange={event => patchChild(child.id, { age: event.target.value })} /></div>
                  <div><Label>Gender</Label>
                    <Select value={child.gender} onValueChange={gender => patchChild(child.id, { gender })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={child.useParentEmail} onChange={event => patchChild(child.id, { useParentEmail: event.target.checked })} />Use my email{parent.email ? ` (${parent.email})` : ''}</label>
                {!child.useParentEmail && <div><Label>Child's email *</Label><Input className="mt-1" type="email" value={child.email} onChange={event => patchChild(child.id, { email: event.target.value })} /></div>}
                <div><Label>Subjects *</Label><div className="flex flex-wrap gap-1.5 mt-1.5">{SUBJECTS.map(subject => <Button key={subject} type="button" size="sm" variant={child.subjects.includes(subject) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => toggleSubject(child, subject)}>{subject}</Button>)}</div></div>
                {child.subjects.includes('Other') && <Input value={child.otherSubject} onChange={event => patchChild(child.id, { otherSubject: event.target.value })} placeholder="Specify other subject *" />}
                <Input value={child.level} onChange={event => patchChild(child.id, { level: event.target.value })} placeholder="Current level (e.g. Qaida page 5)" />
                <Textarea rows={2} value={child.goals} onChange={event => patchChild(child.id, { goals: event.target.value })} placeholder="Learning goals" />
                <div className="grid sm:grid-cols-3 gap-2">
                  <div><Label className="text-xs">Preferred time *</Label><Input className="mt-1" type="time" value={child.time1} onChange={event => patchChild(child.id, { time1: event.target.value })} /></div>
                  <div><Label className="text-xs">Backup time</Label><Input className="mt-1" type="time" value={child.time2} onChange={event => patchChild(child.id, { time2: event.target.value })} /></div>
                  <div><Label className="text-xs">Preferred days</Label><Input className="mt-1" value={child.days} onChange={event => patchChild(child.id, { days: event.target.value })} placeholder="Mon–Fri" /></div>
                </div>
                <p className="text-xs text-muted-foreground">Times are in {parent.timezone || 'your local timezone'}.</p>
              </div>
            ))}
          </>}

          {step === 3 && <>
            <h2 className="font-semibold">Contact preferences</h2>
            <div><Label>How should we contact you?</Label>
              <Select value={parent.preferredContact} onValueChange={preferredContact => patchParent({ preferredContact })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{['WhatsApp', 'Email', 'Phone call'].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Anything else we should know?</Label><Textarea className="mt-1" rows={3} value={parent.notes} onChange={event => patchParent({ notes: event.target.value })} placeholder="Medical needs, timing constraints, teacher gender preference…" /></div>
          </>}

          {step === 4 && <>
            <h2 className="font-semibold">Review and submit</h2>
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Parent:</span> {parent.name} ({parent.relationship})</p>
              <p><span className="text-muted-foreground">Contact:</span> {parent.email} · {parent.phone}</p>
              <p><span className="text-muted-foreground">Location:</span> {[parent.city, parent.country].filter(Boolean).join(', ')} · {parent.timezone}</p>
              <p><span className="text-muted-foreground">Preferred contact:</span> {parent.preferredContact}</p>
            </div>
            {children.map((child, index) => (
              <div key={child.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="font-semibold">{child.name || `Child ${index + 1}`}{child.age ? `, ${child.age}` : ''}</p>
                <p className="text-muted-foreground">{child.subjects.join(', ')}</p>
                <p className="text-muted-foreground">{child.time1}{child.time2 ? ` / ${child.time2}` : ''} {child.days}</p>
                <p className="text-muted-foreground">{child.useParentEmail ? parent.email : child.email}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Your registration goes to our admissions team for review. Accounts are created only after they approve it.</p>
          </>}
        </section>

        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep(current => current - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
          {step === 0 ? <span /> : step < 4 ? (
            <Button type="button" disabled={!canContinue} onClick={() => setStep(current => current + 1)}>Continue<ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button type="button" disabled={!parentValid || !childrenValid || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Submit registration
            </Button>
          )}
        </div>
        {!lookupDone && step === 0 && <p className="text-xs text-muted-foreground text-center">This form takes about 3 minutes.</p>}
      </div>
    </main>
  );
}
