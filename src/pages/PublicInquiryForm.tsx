import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, Loader2, ArrowRight, Star } from 'lucide-react';

// Palette (locked from selected direction)
const CREAM = '#fcfaf7';
const CARD_BORDER = '#e5e0d8';
const EMERALD = '#064e3b';
const EMERALD_DARK = '#053d2e';
const GOLD = '#d4af37';
const INPUT_BG = '#fdfcfb';

const SERIF: React.CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif" };

const SUBJECTS = [
  { value: 'quran_recitation', label: 'Quran Recitation' },
  { value: 'tajweed', label: 'Tajweed' },
  { value: 'memorization', label: 'Quran Memorization' },
  { value: 'arabic', label: 'Arabic Language' },
  { value: 'islamic_studies', label: 'Islamic Studies' },
  { value: 'qaida', label: 'Qaida (Beginners)' },
];

const TIME_SLOTS = [
  'Morning (6 AM – 9 AM)',
  'Late Morning (9 AM – 12 PM)',
  'Afternoon (12 PM – 3 PM)',
  'Evening (3 PM – 6 PM)',
  'Night (6 PM – 9 PM)',
  'Late Night (9 PM – 12 AM)',
];

// ── Field primitives matching the selected direction ──
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[11px] font-semibold uppercase tracking-[0.15em] mb-1.5 ml-1"
      style={{ color: EMERALD }}
    >
      {children}
    </label>
  );
}

const inputCls =
  'w-full px-4 py-3 rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-800 border';

const inputStyle: React.CSSProperties = {
  backgroundColor: INPUT_BG,
  borderColor: CARD_BORDER,
};

function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputCls} focus:ring-2 focus:ring-[${GOLD}] focus:border-transparent ${props.className || ''}`}
      style={{ ...inputStyle, ...(props.style || {}) }}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`${inputCls} appearance-none bg-no-repeat pr-10 focus:ring-2 focus:ring-[${GOLD}] focus:border-transparent ${props.className || ''}`}
      style={{
        ...inputStyle,
        backgroundImage:
          "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23064e3b' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 1rem center',
        backgroundSize: '0.7rem',
        ...(props.style || {}),
      }}
    >
      {props.children}
    </select>
  );
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputCls} resize-none focus:ring-2 focus:ring-[${GOLD}] focus:border-transparent ${props.className || ''}`}
      style={{ ...inputStyle, ...(props.style || {}) }}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1" style={{ backgroundColor: CARD_BORDER }} />
      <h3
        className="text-xs font-semibold uppercase tracking-[0.25em]"
        style={{ color: EMERALD }}
      >
        {children}
      </h3>
      <div className="h-px flex-1" style={{ backgroundColor: CARD_BORDER }} />
    </div>
  );
}

// ── Success Screen ──
function SuccessScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: CREAM }}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden relative border"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="relative flex flex-col items-center justify-center text-center px-8 pt-12 pb-16" style={{ backgroundColor: EMERALD }}>
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/az-subtle.png')" }}
          />
          <div className="relative">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <CheckCircle className="h-8 w-8" style={{ color: GOLD }} />
            </div>
            <h1 className="text-3xl mb-2" style={{ ...SERIF, color: GOLD }}>JazakAllah Khair</h1>
            <p className="text-emerald-50/80 text-sm font-light tracking-wide max-w-xs mx-auto">
              We've received your inquiry. Our team will reach out within 24 hours via WhatsApp or email.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-[100%]" />
        </div>
        <div className="px-8 pb-10 pt-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map(n => <Star key={n} className="h-4 w-4" style={{ color: GOLD }} fill={GOLD} />)}
          </div>
          <p className="text-xs text-gray-500">Trusted by 500+ families across 30+ countries</p>
        </div>
        <div className="h-1.5 w-1/3 mx-auto rounded-t-full" style={{ backgroundColor: GOLD }} />
      </div>
    </div>
  );
}

// ── Main Form ──
export default function PublicInquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', phone_whatsapp: '', country: '', city: '',
    for_whom: 'child', gender: '', date_of_birth: '',
    child_age: '', current_level_specimen: '', learning_goals: '',
    guardian_name: '', guardian_relationship: '',
    preferred_time: '', message: '',
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').insert({
        name: form.name,
        email: form.email || null,
        phone_whatsapp: form.phone_whatsapp || null,
        country: form.country || null,
        city: form.city || null,
        for_whom: form.for_whom,
        child_name: form.for_whom === 'child' ? form.name : null,
        child_age: form.child_age ? parseInt(form.child_age) : null,
        child_gender: form.gender || null,
        subject_interest: selectedSubjects.map(s => SUBJECTS.find(x => x.value === s)?.label).filter(Boolean).join(', ') || null,
        preferred_time: form.preferred_time || null,
        message: form.message || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        current_level_specimen: form.current_level_specimen || null,
        learning_goals: form.learning_goals || null,
        guardian_name: form.guardian_name || null,
        guardian_relationship: form.guardian_relationship || null,
        status: 'new',
        source_url: window.location.href,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateField = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));
  const toggleSubject = (value: string) =>
    setSelectedSubjects(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]);

  if (submitted) return <SuccessScreen />;

  const showGuardian = form.for_whom === 'child' || form.for_whom === 'other';
  const canSubmit = form.name && form.country && form.phone_whatsapp && selectedSubjects.length > 0 && !submitMutation.isPending;

  return (
    <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 lg:p-10 animate-fade-in" style={{ backgroundColor: CREAM }}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden relative border"
        style={{ borderColor: CARD_BORDER }}
      >
        {/* Decorative Emerald Header */}
        <div className="relative flex flex-col items-center justify-center text-center px-8 pt-12 pb-16" style={{ backgroundColor: EMERALD }}>
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/az-subtle.png')" }}
          />
          <div className="relative">
            <h1 className="text-3xl sm:text-4xl mb-2" style={{ ...SERIF, color: GOLD }}>
              Al Quran Time Academy
            </h1>
            <p className="text-emerald-50/80 text-sm font-light tracking-wide max-w-md mx-auto">
              Begin your journey of divine understanding — schedule a free demo class
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white rounded-t-[100%]" />
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) submitMutation.mutate(); }}
          className="px-6 sm:px-10 pb-10 pt-2 space-y-6"
        >
          <SectionTitle>Student Details</SectionTitle>

          <div>
            <FieldLabel>Full Name *</FieldLabel>
            <TextField value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Enter your name" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Age</FieldLabel>
              <TextField type="number" min={3} max={99} value={form.child_age} onChange={e => updateField('child_age', e.target.value)} placeholder="e.g. 12" />
            </div>
            <div>
              <FieldLabel>Gender</FieldLabel>
              <SelectField value={form.gender} onChange={e => updateField('gender', e.target.value)}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </SelectField>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Date of Birth</FieldLabel>
              <TextField type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} />
            </div>
            <div>
              <FieldLabel>City</FieldLabel>
              <TextField value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="e.g. Lahore" />
            </div>
          </div>

          <div>
            <FieldLabel>Country *</FieldLabel>
            <TextField value={form.country} onChange={e => updateField('country', e.target.value)} placeholder="e.g. United Kingdom" required />
          </div>

          <SectionTitle>Programs of Interest *</SectionTitle>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SUBJECTS.map(s => {
              const selected = selectedSubjects.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSubject(s.value)}
                  className="relative px-3 py-3 rounded-xl border text-xs font-medium text-left transition-all"
                  style={{
                    backgroundColor: selected ? EMERALD : INPUT_BG,
                    color: selected ? GOLD : '#1f2937',
                    borderColor: selected ? EMERALD : CARD_BORDER,
                    boxShadow: selected ? `0 4px 12px ${EMERALD}26` : undefined,
                  }}
                >
                  {selected && <CheckCircle className="absolute top-1.5 right-1.5 h-3.5 w-3.5" style={{ color: GOLD }} />}
                  <span className="block leading-tight pr-4">{s.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <FieldLabel>Current Level / Specimen</FieldLabel>
            <TextField
              value={form.current_level_specimen}
              onChange={e => updateField('current_level_specimen', e.target.value)}
              placeholder="e.g. Noorani Qaida page 5, Surah Al-Baqarah ayah 10"
            />
          </div>

          <div>
            <FieldLabel>Learning Goals</FieldLabel>
            <TextareaField
              rows={3}
              value={form.learning_goals}
              onChange={e => updateField('learning_goals', e.target.value)}
              placeholder="What does the student want to achieve?"
            />
          </div>

          <SectionTitle>Contact & Enrollment</SectionTitle>

          <div>
            <FieldLabel>Who is filling this form? *</FieldLabel>
            <SelectField value={form.for_whom} onChange={e => updateField('for_whom', e.target.value)}>
              <option value="self">Self</option>
              <option value="child">Parent / Guardian</option>
              <option value="other">Someone Else</option>
            </SelectField>
          </div>

          {showGuardian && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-xl border" style={{ backgroundColor: CREAM, borderColor: CARD_BORDER }}>
              <div>
                <FieldLabel>Guardian Name</FieldLabel>
                <TextField value={form.guardian_name} onChange={e => updateField('guardian_name', e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <FieldLabel>Relationship</FieldLabel>
                <SelectField value={form.guardian_relationship} onChange={e => updateField('guardian_relationship', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </SelectField>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>WhatsApp / Phone *</FieldLabel>
              <TextField value={form.phone_whatsapp} onChange={e => updateField('phone_whatsapp', e.target.value)} placeholder="+XX XXX XXX XXXX" required />
            </div>
            <div>
              <FieldLabel>Email Address</FieldLabel>
              <TextField type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="email@example.com" />
            </div>
          </div>

          <div>
            <FieldLabel>Preferred Class Time</FieldLabel>
            <SelectField value={form.preferred_time} onChange={e => updateField('preferred_time', e.target.value)}>
              <option value="">Select preferred slot…</option>
              {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
            </SelectField>
          </div>

          <div>
            <FieldLabel>Special Notes</FieldLabel>
            <TextareaField
              rows={3}
              value={form.message}
              onChange={e => updateField('message', e.target.value)}
              placeholder="Any additional context for our team…"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full mt-2 py-4 font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              backgroundColor: EMERALD,
              color: GOLD,
              boxShadow: `0 10px 24px -8px ${EMERALD}40`,
            }}
            onMouseOver={(e) => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.backgroundColor = EMERALD_DARK; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = EMERALD; }}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="tracking-[0.18em] uppercase text-sm">Submit Inquiry</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-gray-400">
            Our team typically responds within 24 hours. May Allah bless your journey.
          </p>
        </form>

        {/* Bottom gold accent */}
        <div className="h-1.5 w-1/3 mx-auto rounded-t-full" style={{ backgroundColor: GOLD }} />
      </div>
    </div>
  );
}
