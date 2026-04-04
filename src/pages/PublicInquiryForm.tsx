import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { GraduationCap, CheckCircle, Loader2, Send } from 'lucide-react';

export default function PublicInquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone_whatsapp: '', country: '', city: '',
    for_whom: 'self', child_name: '', child_age: '',
    subject_interest: '', preferred_time: '', message: '',
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
        subject_interest: form.subject_interest || null,
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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle className="h-12 w-12 text-teal mx-auto" />
            <h2 className="text-xl font-bold">Thank You!</h2>
            <p className="text-sm text-muted-foreground">We've received your inquiry. Our team will contact you shortly via WhatsApp or email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <GraduationCap className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Get Started</h1>
          <p className="text-sm text-muted-foreground">Tell us about yourself and we'll get back to you</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div><Label className="text-xs">Full Name *</Label><Input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Your name" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="you@email.com" /></div>
              <div><Label className="text-xs">WhatsApp</Label><Input value={form.phone_whatsapp} onChange={e => updateField('phone_whatsapp', e.target.value)} placeholder="+92..." /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={e => updateField('country', e.target.value)} /></div>
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => updateField('city', e.target.value)} /></div>
            </div>

            <div><Label className="text-xs">This inquiry is for</Label>
              <Select value={form.for_whom} onValueChange={v => updateField('for_whom', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Myself</SelectItem>
                  <SelectItem value="child">My Child</SelectItem>
                  <SelectItem value="other">Someone Else</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.for_whom === 'child' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Child's Name</Label><Input value={form.child_name} onChange={e => updateField('child_name', e.target.value)} /></div>
                <div><Label className="text-xs">Child's Age</Label><Input type="number" value={form.child_age} onChange={e => updateField('child_age', e.target.value)} /></div>
              </div>
            )}

            <div><Label className="text-xs">Subject of Interest</Label><Input value={form.subject_interest} onChange={e => updateField('subject_interest', e.target.value)} placeholder="e.g., Quran, Tajweed, Arabic" /></div>
            <div><Label className="text-xs">Preferred Time</Label><Input value={form.preferred_time} onChange={e => updateField('preferred_time', e.target.value)} placeholder="e.g., Evenings, 5-7 PM PKT" /></div>
            <div><Label className="text-xs">Message (optional)</Label><Textarea value={form.message} onChange={e => updateField('message', e.target.value)} placeholder="Any additional information..." rows={3} /></div>

            <Button onClick={() => submitMutation.mutate()} disabled={!form.name || submitMutation.isPending} className="w-full h-11">
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Inquiry
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
