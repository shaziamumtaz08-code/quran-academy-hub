import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, Clock, Loader2, Plus, Send, Trash2 } from 'lucide-react';
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
type Student = { id: string; name: string; age: string; gender: string; subjects: string[]; otherSubject: string; level: string; goals: string };
const newStudent = (): Student => ({ id: crypto.randomUUID(), name: '', age: '', gender: '', subjects: [], otherSubject: '', level: '', goals: '' });

export default function PublicInquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [openStudent, setOpenStudent] = useState(0);
  const [students, setStudents] = useState<Student[]>([newStudent()]);
  const [contact, setContact] = useState({ guardian: '', relationship: '', email: '', phone: '', country: '', countryCode: '', city: '', timezone: '', time1: '', note1: '', time2: '', note2: '', message: '' });
  const patchContact = (patch: Partial<typeof contact>) => setContact(current => ({ ...current, ...patch }));
  const patchStudent = (id: string, patch: Partial<Student>) => setStudents(current => current.map(student => student.id === id ? { ...student, ...patch } : student));

  const chooseCountry = (code: string) => {
    const country = COUNTRIES.find(item => item.isoCode === code);
    if (country) patchContact({ country: country.name, countryCode: code, city: '', timezone: country.timezones?.[0]?.zoneName || '' });
  };
  const toggleSubject = (student: Student, subject: string) => patchStudent(student.id, {
    subjects: student.subjects.includes(subject) ? student.subjects.filter(item => item !== subject) : [...student.subjects, subject],
  });
  const valid = Boolean(contact.guardian.trim() && contact.email.trim() && contact.phone.trim() && contact.country && contact.timezone && contact.time1 && contact.time2 && students.every(student => student.name.trim() && student.subjects.length && (!student.subjects.includes('Other') || student.otherSubject.trim())));

  const submit = useMutation({
    mutationFn: async () => {
      const preferredTime = `TZ: ${contact.timezone} | Slot 1: ${contact.time1}${contact.note1 ? ` (${contact.note1})` : ''} | Slot 2: ${contact.time2}${contact.note2 ? ` (${contact.note2})` : ''}`;
      const rows = students.map(student => ({
        name: student.name.trim(), child_name: student.name.trim(), child_age: student.age ? Number(student.age) : null,
        child_gender: student.gender || null, gender: student.gender || null, email: contact.email.trim(), phone_whatsapp: contact.phone.trim(),
        country: contact.country, city: contact.city || null, timezone: contact.timezone, for_whom: 'child', guardian_name: contact.guardian.trim(),
        guardian_relationship: contact.relationship || null,
        subject_interest: student.subjects.map(subject => subject === 'Other' ? `Other: ${student.otherSubject.trim()}` : subject).join(', '),
        current_level_specimen: student.level || null, learning_goals: student.goals || null, preferred_time: preferredTime,
        message: contact.message || null, status: 'new', source_url: window.location.href,
      }));
      const { error } = await supabase.from('leads').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: Error) => toast({ title: 'Could not submit inquiry', description: error.message, variant: 'destructive' }),
  });

  if (submitted) return <main className="min-h-screen grid place-items-center bg-background p-4"><section className="max-w-md border border-border bg-card p-8 text-center space-y-4"><CheckCircle2 className="h-12 w-12 text-primary mx-auto" /><h1 className="text-2xl font-bold">JazakAllah Khair!</h1><p className="text-muted-foreground">Your family’s details were submitted. Our admissions team will contact you shortly.</p></section></main>;

  return <main className="min-h-screen bg-muted/30 px-3 py-6 sm:py-10"><div className="mx-auto max-w-xl space-y-4">
    <header className="border-l-4 border-primary pl-4 py-1"><p className="text-xs font-semibold uppercase text-primary">Al Quran Time Academy</p><h1 className="text-2xl font-bold">Book a free trial</h1><p className="text-sm text-muted-foreground">One short contact form for your whole family.</p></header>

    <section className="border border-border bg-card p-4 space-y-3"><h2 className="font-semibold">Parent / guardian</h2><div className="grid sm:grid-cols-2 gap-3">
      <div><Label>Parent name *</Label><Input className="mt-1" value={contact.guardian} onChange={event => patchContact({ guardian: event.target.value })} /></div>
      <div><Label>Relationship</Label><Select value={contact.relationship} onValueChange={relationship => patchContact({ relationship })}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="mother">Mother</SelectItem><SelectItem value="father">Father</SelectItem><SelectItem value="guardian">Guardian</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
      <div><Label>Email *</Label><Input className="mt-1" type="email" value={contact.email} onChange={event => patchContact({ email: event.target.value })} /></div>
      <div><Label>WhatsApp / phone *</Label><Input className="mt-1" value={contact.phone} onChange={event => patchContact({ phone: event.target.value })} placeholder="+XX…" /></div>
      <div><Label>Country *</Label><Select value={contact.countryCode} onValueChange={chooseCountry}><SelectTrigger className="mt-1"><SelectValue placeholder="Select country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map(country => <SelectItem key={country.isoCode} value={country.isoCode}>{country.flag} {country.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>City</Label><SearchableCitySelect className="mt-1" countryCode={contact.countryCode} value={contact.city} onValueChange={city => patchContact({ city })} /></div>
    </div><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{contact.timezone || 'Timezone will be set from country'}</p></section>

    <section className="border border-border bg-card p-4 space-y-3"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Children ({students.length})</h2><p className="text-xs text-muted-foreground">Add every child who needs a trial.</p></div><Button type="button" size="sm" variant="outline" onClick={() => { setStudents(current => [...current, newStudent()]); setOpenStudent(students.length); }}><Plus className="h-4 w-4 mr-1" />Add child</Button></div>
      {students.map((student, index) => { const open = openStudent === index; return <div key={student.id} className={cn('border', open && 'border-primary')}><div className="flex items-center"><Button type="button" variant="ghost" className="flex-1 justify-between rounded-none" onClick={() => setOpenStudent(open ? -1 : index)}><span>{student.name || `Child ${index + 1}`}</span><ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} /></Button>{students.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove child ${index + 1}`} onClick={() => { setStudents(current => current.filter(item => item.id !== student.id)); setOpenStudent(0); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>
        {open && <div className="border-t border-border p-3 space-y-3"><div className="grid grid-cols-[1fr_90px] gap-2"><div><Label>Student name *</Label><Input className="mt-1" value={student.name} onChange={event => patchStudent(student.id, { name: event.target.value })} /></div><div><Label>Age</Label><Input className="mt-1" type="number" min="3" max="99" value={student.age} onChange={event => patchStudent(student.id, { age: event.target.value })} /></div></div>
          <Select value={student.gender} onValueChange={gender => patchStudent(student.id, { gender })}><SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select>
          <div><Label>Subjects *</Label><div className="flex flex-wrap gap-1.5 mt-1.5">{SUBJECTS.map(subject => <Button key={subject} type="button" size="sm" variant={student.subjects.includes(subject) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => toggleSubject(student, subject)}>{subject}</Button>)}</div></div>
          {student.subjects.includes('Other') && <Input value={student.otherSubject} onChange={event => patchStudent(student.id, { otherSubject: event.target.value })} placeholder="Specify other subject *" />}
          <Input value={student.level} onChange={event => patchStudent(student.id, { level: event.target.value })} placeholder="Current level (e.g. Qaida page 5)" /><Textarea rows={2} value={student.goals} onChange={event => patchStudent(student.id, { goals: event.target.value })} placeholder="Learning goals" />
        </div>}</div>; })}
    </section>

    <section className="border border-border bg-card p-4 space-y-3"><div><h2 className="font-semibold">Preferred class times</h2><p className="text-xs text-muted-foreground">Shared contact details; each child remains a separate lead.</p></div><div className="grid sm:grid-cols-2 gap-3"><div><Label>First choice *</Label><Input className="mt-1" type="time" value={contact.time1} onChange={event => patchContact({ time1: event.target.value })} /><Input className="mt-2" value={contact.note1} onChange={event => patchContact({ note1: event.target.value })} placeholder="Days or note" /></div><div><Label>Backup choice *</Label><Input className="mt-1" type="time" value={contact.time2} onChange={event => patchContact({ time2: event.target.value })} /><Input className="mt-2" value={contact.note2} onChange={event => patchContact({ note2: event.target.value })} placeholder="Days or note" /></div></div><Textarea rows={2} value={contact.message} onChange={event => patchContact({ message: event.target.value })} placeholder="Anything else we should know?" /></section>
    <Button className="w-full h-12" size="lg" disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>{submit.isPending ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Send className="h-5 w-5 mr-2" />}Submit {students.length > 1 ? `${students.length} student inquiries` : 'inquiry'}</Button>
  </div></main>;
}