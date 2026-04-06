import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle, Loader2, Send, BookOpen, User, Phone, MapPin,
  Clock, MessageSquare, GraduationCap, Star
} from 'lucide-react';

const SUBJECTS = [
  { value: 'nazra', label: 'Nazra Quran', emoji: '📖', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'qaida', label: 'Qaida (Beginner)', emoji: '🔤', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'hifz', label: 'Hifz (Memorization)', emoji: '🕌', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { value: 'tajweed', label: 'Tajweed', emoji: '🎙️', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { value: 'arabic', label: 'Arabic Language', emoji: '🌙', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'tarbiyah', label: 'Tarbiyah (Islamic Studies)', emoji: '📚', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
];

const TIME_SLOTS = [
  'Morning (6 AM – 9 AM)',
  'Late Morning (9 AM – 12 PM)',
  'Afternoon (12 PM – 3 PM)',
  'Evening (3 PM – 6 PM)',
  'Night (6 PM – 9 PM)',
  'Late Night (9 PM – 12 AM)',
];

export default function PublicInquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', phone_whatsapp: '', country: '', city: '',
    for_whom: 'self', child_name: '', child_age: '',
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
        child_name: form.for_whom === 'child' ? form.child_name || null : null,
        child_age: form.for_whom === 'child' && form.child_age ? parseInt(form.child_age) : null,
        subject_interest: selectedSubjects.join(', ') || null,
        preferred_time: form.preferred_time || null,
        message: form.message || null,
        status: 'new',
        source_url: window.location.href,
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateField = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const toggleSubject = (value: string) => {
    setSelectedSubjects(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md mx-auto shadow-xl border-0">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">JazakAllah Khair!</h2>
            <p className="text-muted-foreground">We've received your inquiry. Our team will contact you within 24 hours via WhatsApp or email.</p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2">
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <span className="ml-1">Trusted by 500+ families worldwide</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="relative bg-primary overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-5">
            <BookOpen className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-3 tracking-tight">
            Begin Your Quran Journey
          </h1>
          <p className="text-primary-foreground/80 text-base sm:text-lg max-w-md mx-auto">
            Expert one-on-one Quran education for all ages. Schedule a free demo class today.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6 text-primary-foreground/70 text-xs">
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Free Demo</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Certified Teachers</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Flexible Timing</span>
          </div>
        </div>
        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 40V0C240 30 480 40 720 40C960 40 1200 30 1440 0V40H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 -mt-2 pb-12 space-y-5">

        {/* Section 1: Who is this for? */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-semibold text-foreground">Personal Information</h2>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name *</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Enter your full name" className="mt-1 h-11" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="you@email.com" className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp Number</Label>
                <Input value={form.phone_whatsapp} onChange={e => updateField('phone_whatsapp', e.target.value)} placeholder="+1 234 567 8900" className="mt-1 h-11" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This inquiry is for</Label>
              <Select value={form.for_whom} onValueChange={v => updateField('for_whom', v)}>
                <SelectTrigger className="mt-1 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">
                    <span className="flex items-center gap-2">👤 Myself</span>
                  </SelectItem>
                  <SelectItem value="child">
                    <span className="flex items-center gap-2">👶 My Child</span>
                  </SelectItem>
                  <SelectItem value="other">
                    <span className="flex items-center gap-2">👥 Someone Else</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.for_whom === 'child' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border/50">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Child's Name</Label>
                  <Input value={form.child_name} onChange={e => updateField('child_name', e.target.value)} placeholder="Child's full name" className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Child's Age</Label>
                  <Input type="number" value={form.child_age} onChange={e => updateField('child_age', e.target.value)} placeholder="e.g. 8" className="mt-1 h-11" min="3" max="99" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</Label>
                <Input value={form.country} onChange={e => updateField('country', e.target.value)} placeholder="e.g. United States" className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
                <Input value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="e.g. New York" className="mt-1 h-11" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Subject Interest - Visual chips */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500" />
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="font-semibold text-foreground">What would you like to learn?</h2>
            </div>
            <p className="text-xs text-muted-foreground">Select one or more subjects you're interested in</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUBJECTS.map(subject => {
                const isSelected = selectedSubjects.includes(subject.value);
                return (
                  <button
                    key={subject.value}
                    type="button"
                    onClick={() => toggleSubject(subject.value)}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:shadow-sm'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <span className="text-2xl block mb-2">{subject.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{subject.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedSubjects.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedSubjects.map(s => {
                  const sub = SUBJECTS.find(x => x.value === s);
                  return sub ? (
                    <Badge key={s} className={`${sub.color} border-0 text-xs px-3 py-1`}>
                      {sub.emoji} {sub.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Preferred Time */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <h2 className="font-semibold text-foreground">Preferred Class Time</h2>
            </div>

            <Select value={form.preferred_time} onValueChange={v => updateField('preferred_time', v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select your preferred time slot..." />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(slot => (
                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Additional Message</Label>
              <Textarea
                value={form.message}
                onChange={e => updateField('message', e.target.value)}
                placeholder="Any specific requirements, questions, or preferences..."
                rows={3}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!form.name || submitMutation.isPending}
          className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Send className="h-5 w-5 mr-2" />
          )}
          Submit Inquiry — Get Free Demo
        </Button>

        {/* Trust indicators */}
        <div className="text-center space-y-2 pt-2">
          <div className="flex items-center justify-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className="h-4 w-4 text-amber-500" fill="currentColor" />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Trusted by 500+ families across 30+ countries
          </p>
        </div>
      </div>
    </div>
  );
}
