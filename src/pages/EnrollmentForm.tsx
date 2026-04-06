import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  GraduationCap, User, Shield, FileCheck, AlertTriangle, CheckCircle, Loader2,
  BookOpen, Star, Calendar, CreditCard, Clock
} from 'lucide-react';

interface LeadData {
  id: string;
  name: string;
  email: string | null;
  phone_whatsapp: string | null;
  country: string | null;
  city: string | null;
  for_whom: string;
  child_name: string | null;
  child_age: number | null;
  child_gender: string | null;
  subject_interest: string | null;
  enrollment_form_data: any | null;
  status: string;
}

export default function EnrollmentForm() {
  const { token } = useParams<{ token: string }>();

  const { data: lead, isLoading, error } = useQuery({
    queryKey: ['enrollment-form', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('enrollment_form_token', token)
        .single();
      if (error) throw error;
      if (data && !data.enrollment_form_opened_at) {
        await supabase.from('leads').update({ enrollment_form_opened_at: new Date().toISOString() }).eq('id', data.id);
      }
      return data as LeadData;
    },
    enabled: !!token,
  });

  const isChild = lead?.for_whom === 'child';
  const studentAge = lead?.child_age || null;
  const [form, setForm] = useState({
    student_name: '', student_dob: '', student_gender: '', student_email: '',
    student_whatsapp: '', student_country: '', student_city: '',
    parent_name: '', parent_relationship: '', parent_email: '', parent_whatsapp: '',
    parent_oversight: 'none',
    password: '', confirm_password: '',
    preferred_schedule: '', payment_method: '',
    terms_accepted: false, privacy_accepted: false, parental_consent: false,
  });

  useEffect(() => {
    if (!lead) return;
    setForm(prev => ({
      ...prev,
      student_name: isChild ? (lead.child_name || '') : lead.name,
      student_email: !isChild ? (lead.email || '') : '',
      student_whatsapp: !isChild ? (lead.phone_whatsapp || '') : '',
      student_country: lead.country || '',
      student_city: lead.city || '',
      student_gender: lead.child_gender || '',
      parent_name: isChild ? lead.name : '',
      parent_email: isChild ? (lead.email || '') : '',
      parent_whatsapp: isChild ? (lead.phone_whatsapp || '') : '',
    }));
  }, [lead, isChild]);

  const computedAge = useMemo(() => {
    if (!form.student_dob) return studentAge;
    const dob = new Date(form.student_dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }, [form.student_dob, studentAge]);

  const computedIsMinor = computedAge !== null && computedAge < 18;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({
        enrollment_form_data: form,
        status: 'form_submitted',
      }).eq('id', lead!.id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Enrollment form submitted successfully!' }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const alreadySubmitted = lead?.enrollment_form_data !== null;
  const hasParentDetails = form.parent_name && form.parent_email;
  const canSubmit = form.student_name && form.terms_accepted && form.privacy_accepted &&
    (computedIsMinor || (form.password && form.password === form.confirm_password));

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  // Step indicator
  const StepBadge = ({ step, label, icon: Icon }: { step: number; label: string; icon: any }) => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{step}</div>
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground text-sm">{label}</span>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your enrollment form...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md mx-auto shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Invalid or Expired Link</h2>
            <p className="text-sm text-muted-foreground">This enrollment form link is no longer valid. Please contact the academy for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySubmitted || submitMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md mx-auto shadow-xl border-0">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Enrollment Submitted!</h2>
            <p className="text-muted-foreground">Your enrollment has been submitted successfully. The academy will review your application and contact you shortly.</p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2">
              <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
              <span>You'll receive a confirmation within 24 hours</span>
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
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20l-10-10M20 20l10-10M20 20l-10 10M20 20l10 10' stroke='%23ffffff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
            }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-4 py-10 sm:py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-2">Complete Your Enrollment</h1>
          <p className="text-primary-foreground/80 text-sm sm:text-base">
            Welcome, {lead.name}! Fill in the details below to finalize your enrollment.
          </p>
          {lead.subject_interest && (
            <Badge className="mt-3 bg-white/20 text-primary-foreground border-0 text-sm px-4 py-1">
              {lead.subject_interest}
            </Badge>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 30V0C360 25 720 30 1080 25C1260 22 1380 15 1440 0V30H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 pb-12 space-y-5 -mt-1">

        {/* Step 1: Student Details */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-accent" />
          <CardContent className="pt-6 space-y-4">
            <StepBadge step={1} label="Student Details" icon={User} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name *</Label>
                <Input value={form.student_name} onChange={e => updateField('student_name', e.target.value)} className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
                <Input type="date" value={form.student_dob} onChange={e => updateField('student_dob', e.target.value)} className="mt-1 h-11" />
                {computedAge !== null && <p className="text-[10px] text-muted-foreground mt-0.5">Age: {computedAge} years</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gender</Label>
                <Select value={form.student_gender} onValueChange={v => updateField('student_gender', v)}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input type="email" value={form.student_email} onChange={e => updateField('student_email', e.target.value)} className="mt-1 h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp</Label>
                <Input value={form.student_whatsapp} onChange={e => updateField('student_whatsapp', e.target.value)} placeholder="+1 234 567 8900" className="mt-1 h-11" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</Label>
                <Input value={form.student_country} onChange={e => updateField('student_country', e.target.value)} className="mt-1 h-11" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
              <Input value={form.student_city} onChange={e => updateField('student_city', e.target.value)} className="mt-1 h-11" />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Parent/Guardian (if minor) */}
        {computedIsMinor && (
          <Card className="shadow-lg border-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <StepBadge step={2} label="Parent / Guardian" icon={Shield} />
                <Badge variant="outline" className="text-muted-foreground border-muted text-[10px]">Optional</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent Name</Label>
                  <Input value={form.parent_name} onChange={e => updateField('parent_name', e.target.value)} className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relationship</Label>
                  <Select value={form.parent_relationship} onValueChange={v => updateField('parent_relationship', v)}>
                    <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent Email</Label>
                  <Input type="email" value={form.parent_email} onChange={e => updateField('parent_email', e.target.value)} className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent WhatsApp</Label>
                  <Input value={form.parent_whatsapp} onChange={e => updateField('parent_whatsapp', e.target.value)} className="mt-1 h-11" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dashboard Access Level</Label>
                <Select value={form.parent_oversight} onValueChange={v => updateField('parent_oversight', v)}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — no parent dashboard</SelectItem>
                    <SelectItem value="full">Full — view classes, grades, attendance</SelectItem>
                    <SelectItem value="notifications">Notifications only — alerts & summaries</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {computedAge !== null && computedAge < 13 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0" />
                  We recommend adding a parent/guardian for students under 13.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2b: Account Setup (adult) */}
        {!computedIsMinor && (
          <Card className="shadow-lg border-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardContent className="pt-6 space-y-4">
              <StepBadge step={2} label="Account Setup" icon={Shield} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password *</Label>
                  <Input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Min 6 characters" className="mt-1 h-11" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password *</Label>
                  <Input type="password" value={form.confirm_password} onChange={e => updateField('confirm_password', e.target.value)} className="mt-1 h-11" />
                  {form.confirm_password && form.password !== form.confirm_password && (
                    <p className="text-[10px] text-destructive mt-0.5">Passwords don't match</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Course & Schedule */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <CardContent className="pt-6 space-y-4">
            <StepBadge step={computedIsMinor ? 3 : 3} label="Course & Schedule" icon={Calendar} />
            {lead.subject_interest && (
              <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Subject of Interest</p>
                  <p className="font-medium text-sm">{lead.subject_interest}</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preferred Schedule</Label>
              <Input value={form.preferred_schedule} onChange={e => updateField('preferred_schedule', e.target.value)} placeholder="e.g., Mon-Fri 5:00 PM PKT" className="mt-1 h-11" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
                <SelectTrigger className="mt-1 h-11"><SelectValue placeholder="Select payment method..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                  <SelectItem value="card">💳 Credit / Debit Card</SelectItem>
                  <SelectItem value="cash">💵 Cash</SelectItem>
                  <SelectItem value="pay_later">🕐 Pay Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Consent */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/60" />
          <CardContent className="pt-6 space-y-4">
            <StepBadge step={computedIsMinor ? 4 : 4} label="Consent & Agreement" icon={FileCheck} />
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Checkbox checked={form.terms_accepted} onCheckedChange={v => updateField('terms_accepted', !!v)} id="terms" className="mt-0.5" />
                <label htmlFor="terms" className="text-sm leading-snug cursor-pointer">I agree to the <span className="font-medium text-primary">Terms of Service</span> and understand the enrollment conditions *</label>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Checkbox checked={form.privacy_accepted} onCheckedChange={v => updateField('privacy_accepted', !!v)} id="privacy" className="mt-0.5" />
                <label htmlFor="privacy" className="text-sm leading-snug cursor-pointer">I agree to the <span className="font-medium text-primary">Privacy Policy</span> and consent to data processing *</label>
              </div>
              {computedIsMinor && hasParentDetails && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                  <Checkbox checked={form.parental_consent} onCheckedChange={v => updateField('parental_consent', !!v)} id="parental" className="mt-0.5" />
                  <label htmlFor="parental" className="text-sm leading-snug cursor-pointer">I, as the parent/guardian, consent to my child's enrollment and understand the oversight terms</label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isPending}
          className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-5 w-5 mr-2" />
          )}
          Submit Enrollment
        </Button>
      </div>
    </div>
  );
}
