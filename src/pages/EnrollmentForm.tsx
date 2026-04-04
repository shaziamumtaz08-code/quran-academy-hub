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
import { GraduationCap, User, Shield, FileCheck, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

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
      // Mark as opened
      if (data && !data.enrollment_form_opened_at) {
        await supabase.from('leads').update({ enrollment_form_opened_at: new Date().toISOString() }).eq('id', data.id);
      }
      return data as LeadData;
    },
    enabled: !!token,
  });

  const isChild = lead?.for_whom === 'child';
  const studentName = isChild ? (lead?.child_name || '') : (lead?.name || '');
  const studentAge = lead?.child_age || null;
  const isMinor = studentAge !== null && studentAge < 18;
  const forcedOversight = studentAge !== null && studentAge < 13;

  const [form, setForm] = useState({
    student_name: '', student_dob: '', student_gender: '', student_email: '',
    student_whatsapp: '', student_country: '', student_city: '',
    parent_name: '', parent_relationship: '', parent_email: '', parent_whatsapp: '',
    parent_oversight: 'none',
    password: '', confirm_password: '',
    preferred_schedule: '', payment_method: '',
    terms_accepted: false, privacy_accepted: false, parental_consent: false,
  });

  // Pre-fill from lead data
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

  // Compute age from DOB
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
  const computedForcedOversight = computedAge !== null && computedAge < 13;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({
        enrollment_form_data: form,
        status: 'form_submitted',
      }).eq('id', lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Enrollment form submitted successfully!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const alreadySubmitted = lead?.enrollment_form_data !== null;

  const canSubmit = form.student_name && form.terms_accepted && form.privacy_accepted &&
    (!computedIsMinor || (form.parent_name && form.parent_email && form.parental_consent)) &&
    (computedIsMinor || (form.password && form.password === form.confirm_password));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-bold">Invalid or Expired Link</h2>
            <p className="text-sm text-muted-foreground">This enrollment form link is no longer valid. Please contact the academy for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySubmitted || submitMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-teal mx-auto" />
            <h2 className="text-lg font-bold">Form Submitted</h2>
            <p className="text-sm text-muted-foreground">Your enrollment form has been submitted successfully. The academy will review your application and contact you shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const updateField = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <GraduationCap className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Enrollment Form</h1>
          <p className="text-sm text-muted-foreground">Complete your enrollment details below</p>
          {lead.subject_interest && <Badge variant="outline">{lead.subject_interest}</Badge>}
        </div>

        {/* Section 1: Student Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Student Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Full Name *</Label><Input value={form.student_name} onChange={e => updateField('student_name', e.target.value)} /></div>
              <div>
                <Label className="text-xs">Date of Birth</Label>
                <Input type="date" value={form.student_dob} onChange={e => updateField('student_dob', e.target.value)} />
                {computedAge !== null && <p className="text-[10px] text-muted-foreground mt-0.5">Age: {computedAge} years</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Gender</Label>
                <Select value={form.student_gender} onValueChange={v => updateField('student_gender', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.student_email} onChange={e => updateField('student_email', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">WhatsApp</Label><Input value={form.student_whatsapp} onChange={e => updateField('student_whatsapp', e.target.value)} placeholder="+92..." /></div>
              <div><Label className="text-xs">Country</Label><Input value={form.student_country} onChange={e => updateField('student_country', e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">City</Label><Input value={form.student_city} onChange={e => updateField('student_city', e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* Section 2a: Parental Consent (if minor) */}
        {computedIsMinor && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-600" /> Parental / Guardian Consent
                <Badge variant="outline" className="text-amber-600 border-amber-300">Required</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Parent/Guardian Name *</Label><Input value={form.parent_name} onChange={e => updateField('parent_name', e.target.value)} /></div>
                <div><Label className="text-xs">Relationship</Label>
                  <Select value={form.parent_relationship} onValueChange={v => updateField('parent_relationship', v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Parent Email *</Label><Input type="email" value={form.parent_email} onChange={e => updateField('parent_email', e.target.value)} /></div>
                <div><Label className="text-xs">Parent WhatsApp</Label><Input value={form.parent_whatsapp} onChange={e => updateField('parent_whatsapp', e.target.value)} /></div>
              </div>

              {!computedForcedOversight && (
                <div>
                  <Label className="text-xs">Parent Dashboard Access</Label>
                  <Select value={form.parent_oversight} onValueChange={v => updateField('parent_oversight', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full oversight — view classes, grades, attendance</SelectItem>
                      <SelectItem value="notifications">Notifications only — receive alerts & summaries</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {computedForcedOversight && (
                <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  Full parental oversight is mandatory for students under 13.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 2b: Account Setup (if adult) */}
        {!computedIsMinor && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Account Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Password *</Label><Input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Min 6 characters" /></div>
                <div>
                  <Label className="text-xs">Confirm Password *</Label>
                  <Input type="password" value={form.confirm_password} onChange={e => updateField('confirm_password', e.target.value)} />
                  {form.confirm_password && form.password !== form.confirm_password && (
                    <p className="text-[10px] text-destructive mt-0.5">Passwords don't match</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Course / Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.subject_interest && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <span className="text-muted-foreground">Subject:</span> <span className="font-medium">{lead.subject_interest}</span>
              </div>
            )}
            <div><Label className="text-xs">Preferred Schedule</Label><Input value={form.preferred_schedule} onChange={e => updateField('preferred_schedule', e.target.value)} placeholder="e.g., Mon-Fri 5pm PKT" /></div>
            <div><Label className="text-xs">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => updateField('payment_method', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="pay_later">Pay Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Consent */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileCheck className="h-4 w-4" /> Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox checked={form.terms_accepted} onCheckedChange={v => updateField('terms_accepted', !!v)} id="terms" />
              <label htmlFor="terms" className="text-xs leading-snug cursor-pointer">I agree to the Terms of Service and understand the enrollment conditions *</label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox checked={form.privacy_accepted} onCheckedChange={v => updateField('privacy_accepted', !!v)} id="privacy" />
              <label htmlFor="privacy" className="text-xs leading-snug cursor-pointer">I agree to the Privacy Policy and consent to data processing *</label>
            </div>
            {computedIsMinor && (
              <div className="flex items-start gap-2">
                <Checkbox checked={form.parental_consent} onCheckedChange={v => updateField('parental_consent', !!v)} id="parental" />
                <label htmlFor="parental" className="text-xs leading-snug cursor-pointer">I, as the parent/guardian, consent to my child's enrollment and understand the oversight terms *</label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending} className="w-full h-12 text-base font-semibold">
          {submitMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
          Submit Enrollment
        </Button>
      </div>
    </div>
  );
}
