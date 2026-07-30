import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, Clock, Loader2, Mail, Plus, Send, Trash2, User, Users } from 'lucide-react';
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

type Mode = 'self' | 'child' | 'other';
type Student = { id: string; name: string; email: string; useContactEmail: boolean; age: string; gender: string; subjects: string[]; otherSubject: string; level: string; goals: string; time1: string; note1: string; time2: string; note2: string };
const newStudent = (): Student => ({ id: crypto.randomUUID(), name: '', email: '', useContactEmail: true, age: '', gender: '', subjects: [], otherSubject: '', level: '', goals: '', time1: '', note1: '', time2: '', note2: '' });

export default function PublicInquiryForm() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [openStudent, setOpenStudent] = useState(0);
  const [students, setStudents] = useState<Student[]>([newStudent()]);
  const [contact, setContact] = useState({ guardian: '', relationship: '', email: '', phone: '', country: '', countryCode: '', city: '', timezone: '', message: '' });
  const patchContact = (patch: Partial<typeof contact>) => setContact(current => ({ ...current, ...patch }));
  const patchStudent = (id: string, patch: Partial<Student>) => setStudents(current => current.map(student => student.id === id ? { ...student, ...patch } : student));
  const isSelf = mode === 'self';

  const chooseCountry = (code: string) => {
    const country = COUNTRIES.find(item => item.isoCode === code);
    if (country) patchContact({ country: country.name, countryCode: code, city: '', timezone: country.timezones?.[0]?.zoneName || '' });
  };
  const toggleSubject = (student: Student, subject: string) => patchStudent(student.id, {
    subjects: student.subjects.includes(subject) ? student.subjects.filter(item => item !== subject) : [...student.subjects, subject],
  });

  const studentValid = (student: Student) => Boolean(
    student.name.trim() && student.subjects.length && student.time1 && student.time2 &&
    (!student.subjects.includes('Other') || student.otherSubject.trim()) &&
    (isSelf || student.useContactEmail || EMAIL_RE.test(student.email.trim()))
  );
  const valid = Boolean(
    mode && EMAIL_RE.test(contact.email.trim()) && contact.phone.trim() && contact.country && contact.timezone &&
    (isSelf || contact.guardian.trim()) && students.every(studentValid)
  );

  const submit = useMutation({
    mutationFn: async () => {
      const rows = students.map(student => {
        const preferredTime = `TZ: ${contact.timezone} | Slot 1: ${student.time1}${student.note1 ? ` (${student.note1})` : ''} | Slot 2: ${student.time2}${student.note2 ? ` (${student.note2})` : ''}`;
        const email = (isSelf || student.useContactEmail ? contact.email : student.email).trim();
        return {
          name: student.name.trim(), child_name: isSelf ? null : student.name.trim(), child_age: student.age ? Number(student.age) : null,
          child_gender: isSelf ? null : (student.gender || null), gender: student.gender || null, email,
          phone_whatsapp: contact.phone.trim(), country: contact.country, city: contact.city || null, timezone: contact.timezone,
          for_whom: mode === 'self' ? 'self' : mode === 'child' ? 'child' : 'other',
          guardian_name: isSelf ? null : contact.guardian.trim(),
          guardian_relationship: isSelf ? null : (contact.relationship || null),
          subject_interest: student.subjects.map(subject => subject === 'Other' ? `Other: ${student.otherSubject.trim()}` : subject).join(', '),
          current_level_specimen: student.level || null, learning_goals: student.goals || null, preferred_time: preferredTime,
          message: contact.message || null, status: 'new', source_url: window.location.href,
        };
      });
      const { error } = await supabase.from('leads').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: Error) => toast({ title: 'Could not submit inquiry', description: error.message, variant: 'destructive' }),
  });

  if (submitted) return <main className="min-h-screen grid place-items-center bg-background p-4"><section className="max-w-md border border-border bg-card p-8 text-center space-y-4"><CheckCircle2 className="h-12 w-12 text-primary mx-auto" /><h1 className="text-2xl font-bold">JazakAllah Khair!</h1><p className="text-muted-foreground">Your details were submitted. Our admissions team will contact you shortly on the email and WhatsApp number you provided.</p></section></main>;

  return <main className="min-h-screen bg-muted/30 px-3 py-6 sm:py-10"><div className="mx-auto max-w-xl space-y-4">
    <header className="border-l-4 border-primary pl-4 py-1"><p className="text-xs font-semibold uppercase text-primary">Al Quran Time Academy</p><h1 className="text-2xl font-bold">Book a free trial</h1><p className="text-sm text-muted-foreground">Takes about a minute.</p></header>

    <section className="border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Who is this trial for? *</h2>
      <div className="grid sm:grid-cols-3 gap-2">
        {([['self', 'Myself', User], ['child', 'My child / children', Users], ['other', 'Someone else', Users]] as const).map(([value, label, Icon]) => (
          <Button key={value} type="button" variant={mode === value ? 'default' : 'outline'} className="h-auto py-3 flex-col gap-1 text-xs" onClick={() => { setMode(value); if (value === 'self') { setStudents(current => [current[0]]); setOpenStudent(0); } }}>
            <Icon className="h-4 w-4" />{label}
          </Button>
        ))}
      </div>
    </section>

    {mode && <>
      <section className="border border-border bg-card p-4 space-y-3"><h2 className="font-semibold">{isSelf ? 'Your contact details' : 'Parent / guardian contact'}</h2><div className="grid sm:grid-cols-2 gap-3">
        {!isSelf && <>
          <div><Label>{mode === 'child' ? 'Parent name *' : 'Your name *'}</Label><Input className="mt-1" value={contact.guardian} onChange={event => patchContact({ guardian: event.target.value })} /></div>
          <div><Label>Relationship to student</Label><Select value={contact.relationship} onValueChange={relationship => patchContact({ relationship })}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="mother">Mother</SelectItem><SelectItem value="father">Father</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="relative">Relative</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
        </>}
        {isSelf && <div className="sm:col-span-2"><Label>Full name *</Label><Input className="mt-1" value={students[0]?.name || ''} onChange={event => patchStudent(students[0].id, { name: event.target.value })} /></div>}
        <div><Label>Email *</Label><Input className="mt-1" type="email" value={contact.email} onChange={event => patchContact({ email: event.target.value })} /></div>
        <div><Label>WhatsApp / phone *</Label><Input className="mt-1" value={contact.phone} onChange={event => patchContact({ phone: event.target.value })} placeholder="+XX…" /></div>
        <div><Label>Country *</Label><Select value={contact.countryCode} onValueChange={chooseCountry}><SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map(country => <SelectItem key={country.isoCode} value={country.isoCode}>{country.flag} {country.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>City</Label><SearchableCitySelect className="mt-1" countryCode={contact.countryCode} value={contact.city} onValueChange={city => patchContact({ city })} /></div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{contact.timezone || 'Timezone will be set from country'}</p>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />A valid email is required — demo links, teacher chat and class details are sent there.</p></section>

      <section className="border border-border bg-card p-4 space-y-3">
        {!isSelf && <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Students ({students.length})</h2><p className="text-xs text-muted-foreground">Each student needs their own email and time slots.</p></div><Button type="button" size="sm" variant="outline" onClick={() => { setStudents(current => [...current, newStudent()]); setOpenStudent(students.length); }}><Plus className="h-4 w-4 mr-1" />Add student</Button></div>}
        {isSelf && <h2 className="font-semibold">Your learning details</h2>}
        {students.map((student, index) => { const open = isSelf || openStudent === index; return <div key={student.id} className={cn(!isSelf && 'border', !isSelf && open && 'border-primary')}>
          {!isSelf && <div className="flex items-center"><Button type="button" variant="ghost" className="flex-1 justify-between rounded-none" onClick={() => setOpenStudent(open ? -1 : index)}><span>{student.name || `Student ${index + 1}`}</span><ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></Button>{students.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove student ${index + 1}`} onClick={() => { setStudents(current => current.filter(item => item.id !== student.id)); setOpenStudent(0); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>}
          {open && <div className={cn('space-y-3', !isSelf && 'border-t border-border p-3')}>
            {!isSelf && <>
              <div className="grid grid-cols-[1fr_90px] gap-2"><div><Label>Student name *</Label><Input className="mt-1" value={student.name} onChange={event => patchStudent(student.id, { name: event.target.value })} /></div><div><Label>Age</Label><Input className="mt-1" type="number" min="3" max="99" value={student.age} onChange={event => patchStudent(student.id, { age: event.target.value })} /></div></div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={student.useContactEmail} onChange={event => patchStudent(student.id, { useContactEmail: event.target.checked })} />Use the parent/guardian email above{contact.email ? ` (${contact.email})` : ''}</label>
                {!student.useContactEmail && <div><Label>Student email *</Label><Input className="mt-1" type="email" value={student.email} onChange={event => patchStudent(student.id, { email: event.target.value })} placeholder="Used for the demo link & chat" /></div>}
              </div>
            </>}
            {isSelf && <div><Label>Age</Label><Input className="mt-1 max-w-[120px]" type="number" min="3" max="99" value={student.age} onChange={event => patchStudent(student.id, { age: event.target.value })} /></div>}
            <Select value={student.gender} onValueChange={gender => patchStudent(student.id, { gender })}><SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select>
            <div><Label>Subjects *</Label><div className="flex flex-wrap gap-1.5 mt-1.5">{SUBJECTS.map(subject => <Button key={subject} type="button" size="sm" variant={student.subjects.includes(subject) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => toggleSubject(student, subject)}>{subject}</Button>)}</div></div>
            {student.subjects.includes('Other') && <Input value={student.otherSubject} onChange={event => patchStudent(student.id, { otherSubject: event.target.value })} placeholder="Specify other subject *" />}
            <Input value={student.level} onChange={event => patchStudent(student.id, { level: event.target.value })} placeholder="Current level (e.g. Qaida page 5)" />
            <Textarea rows={2} value={student.goals} onChange={event => patchStudent(student.id, { goals: event.target.value })} placeholder="Learning goals" />
            <div className="border-t border-border pt-3"><Label className="text-sm font-semibold">Preferred class times *</Label><div className="grid sm:grid-cols-2 gap-3 mt-2">
              <div><Label className="text-xs">First choice *</Label><Input className="mt-1" type="time" value={student.time1} onChange={event => patchStudent(student.id, { time1: event.target.value })} /><Input className="mt-2" value={student.note1} onChange={event => patchStudent(student.id, { note1: event.target.value })} placeholder="Days or note" /></div>
              <div><Label className="text-xs">Backup choice *</Label><Input className="mt-1" type="time" value={student.time2} onChange={event => patchStudent(student.id, { time2: event.target.value })} /><Input className="mt-2" value={student.note2} onChange={event => patchStudent(student.id, { note2: event.target.value })} placeholder="Days or note" /></div>
            </div><p className="text-xs text-muted-foreground mt-2">Times are in {contact.timezone || 'your local timezone'}.</p></div>
          </div>}
        </div>; })}
      </section>

      <section className="border border-border bg-card p-4"><Textarea rows={2} value={contact.message} onChange={event => patchContact({ message: event.target.value })} placeholder="Anything else we should know?" /></section>
      <Button className="w-full h-12" size="lg" disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}Submit {students.length > 1 ? `${students.length} inquiries` : 'inquiry'}</Button>
    </>}
  </div></main>;
}
