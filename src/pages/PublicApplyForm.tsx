import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  BookOpen, CheckCircle2, Loader2, Upload, AlertCircle, Shield,
  Star, Users, Clock, GraduationCap, ArrowRight, Sparkles
} from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  options: any;
  placeholder: string | null;
}

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bahrain','Bangladesh',
  'Belgium','Brazil','Canada','China','Colombia','Denmark','Egypt','Ethiopia','Finland',
  'France','Germany','Ghana','Greece','India','Indonesia','Iran','Iraq','Ireland','Italy',
  'Japan','Jordan','Kenya','Kuwait','Lebanon','Libya','Malaysia','Mexico','Morocco',
  'Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Philippines',
  'Poland','Portugal','Qatar','Russia','Saudi Arabia','Singapore','Somalia','South Africa',
  'South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Tanzania',
  'Thailand','Tunisia','Turkey','UAE','Uganda','UK','USA','Uzbekistan','Vietnam','Yemen',
];

export default function PublicApplyForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(0);

  const { data: formInfo, isLoading } = useQuery({
    queryKey: ['public-apply-form', slug],
    queryFn: async () => {
      const { data: form, error } = await supabase
        .from('registration_forms')
        .select('*')
        .eq('slug', slug!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!form) return null;

      const { data: course } = await supabase
        .from('courses')
        .select('name, description, level, hero_image_url')
        .eq('id', form.course_id)
        .single();

      const { data: fields } = await supabase
        .from('registration_form_fields')
        .select('*')
        .eq('form_id', form.id)
        .order('sort_order');

      return { form, course, fields: (fields || []) as FormField[] };
    },
  });

  // Group fields by heading sections
  const sections = React.useMemo(() => {
    if (!formInfo?.fields) return [];
    const result: { heading: string | null; fields: FormField[] }[] = [];
    let current: { heading: string | null; fields: FormField[] } = { heading: null, fields: [] };

    for (const field of formInfo.fields) {
      if (field.field_type === 'heading') {
        if (current.fields.length > 0 || current.heading) {
          result.push(current);
        }
        current = { heading: field.label, fields: [] };
      } else {
        current.fields.push(field);
      }
    }
    if (current.fields.length > 0 || current.heading) {
      result.push(current);
    }
    return result;
  }, [formInfo?.fields]);

  const handleFileUpload = (fieldKey: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setUploadingFile(fieldKey);
    const path = `${slug}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('registration-uploads').upload(path, file);
    setUploadingFile(null);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data: urlData } = supabase.storage.from('registration-uploads').getPublicUrl(path);
    updateField(fieldKey, urlData.publicUrl);
  };

  const submitForm = useMutation({
    mutationFn: async () => {
      if (!formInfo?.form) throw new Error('Form not found');

      const newErrors: Record<string, string> = {};
      formInfo.fields.forEach(f => {
        if (f.field_type === 'heading') return;
        if (f.is_required) {
          const val = formData[f.field_key];
          if (!val || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0)) {
            newErrors[f.field_key] = `${f.label} is required`;
          }
        }
        if (f.field_type === 'email' && formData[f.field_key]) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData[f.field_key])) {
            newErrors[f.field_key] = 'Please enter a valid email';
          }
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Please fill in all required fields');
      }

      const { error } = await supabase.from('registration_submissions').insert({
        form_id: formInfo.form.id,
        course_id: formInfo.form.course_id,
        data: formData,
        source_tag: 'website',
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: any) => {
      if (err.message !== 'Please fill in all required fields') {
        toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
      }
    },
  });

  const updateField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (!formInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md w-full mx-4 shadow-xl border-0">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-bold mb-2">Form Not Found</h2>
            <p className="text-sm text-muted-foreground">This registration form is no longer available or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
        <div className="max-w-lg w-full text-center">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <Sparkles className="h-5 w-5 text-amber-400 absolute top-0 right-1/3 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Thank you for applying to <strong className="text-foreground">{formInfo.course?.name}</strong>. We'll review your application and get back to you soon, In shaa Allah.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>Back to home</Button>
          </div>
        </div>
      </div>
    );
  }

  const renderField = (field: FormField) => {
    const hasError = !!errors[field.field_key];

    return (
      <div key={field.id} className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          {field.label}
          {field.is_required && <span className="text-destructive text-xs">*</span>}
        </Label>

        {field.field_type === 'textarea' ? (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}
            className={cn('resize-none transition-all focus:ring-2 focus:ring-primary/20', hasError && 'border-destructive ring-destructive/20')}
            rows={4}
          />
        ) : field.field_type === 'dropdown' ? (
          <select
            className={cn(
              'w-full h-11 rounded-lg border px-3 text-sm bg-background transition-all focus:outline-none focus:ring-2 focus:ring-primary/20',
              hasError ? 'border-destructive' : 'border-input'
            )}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}>
            <option value="">Select {field.label}...</option>
            {(Array.isArray(field.options) ? field.options : []).map((o: string) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : field.field_type === 'multi_select' ? (
          <div className="grid grid-cols-2 gap-2">
            {(Array.isArray(field.options) ? field.options : []).map((opt: string) => {
              const current: string[] = formData[field.field_key] || [];
              const isSelected = current.includes(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    const updated = isSelected ? current.filter((v: string) => v !== opt) : [...current, opt];
                    updateField(field.field_key, updated);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-input hover:border-primary/30 hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                  )}>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  {opt}
                </button>
              );
            })}
            {hasError && <p className="text-xs text-destructive col-span-2">{errors[field.field_key]}</p>}
          </div>
        ) : field.field_type === 'checkbox' ? (
          <button
            type="button"
            onClick={() => updateField(field.field_key, !formData[field.field_key])}
            className={cn(
              'flex items-center gap-3 w-full px-4 py-3 rounded-lg border text-left transition-all',
              formData[field.field_key]
                ? 'border-primary bg-primary/5'
                : 'border-input hover:border-primary/30'
            )}
          >
            <Checkbox checked={!!formData[field.field_key]} />
            <span className="text-sm">{field.label}</span>
          </button>
        ) : field.field_type === 'file' ? (
          <div>
            {formData[field.field_key] ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-800">File uploaded</p>
                  <p className="text-xs text-emerald-600">Ready for submission</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7"
                  onClick={() => updateField(field.field_key, null)}>Change</Button>
              </div>
            ) : (
              <label className={cn(
                'flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5',
                hasError ? 'border-destructive' : 'border-muted-foreground/20'
              )}>
                <Upload className="h-6 w-6 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload file</span>
                <span className="text-xs text-muted-foreground/60">PDF, JPG, PNG, DOC · Max 10MB</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload(field.field_key)}
                  disabled={uploadingFile === field.field_key}
                />
                {uploadingFile === field.field_key && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </label>
            )}
          </div>
        ) : field.field_type === 'country' ? (
          <select
            className={cn(
              'w-full h-11 rounded-lg border px-3 text-sm bg-background transition-all focus:outline-none focus:ring-2 focus:ring-primary/20',
              hasError ? 'border-destructive' : 'border-input'
            )}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}>
            <option value="">Select country...</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : field.field_type === 'number' ? (
          <Input
            type="number"
            placeholder={field.placeholder || '0'}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}
            className={cn('h-11 rounded-lg', hasError && 'border-destructive')}
          />
        ) : (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'date' ? 'date' : 'text'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}
            className={cn('h-11 rounded-lg', hasError && 'border-destructive')}
          />
        )}

        {field.field_type !== 'multi_select' && hasError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors[field.field_key]}
          </p>
        )}
      </div>
    );
  };

  const filledCount = formInfo.fields.filter(f => f.field_type !== 'heading' && formData[f.field_key]).length;
  const totalRequired = formInfo.fields.filter(f => f.field_type !== 'heading' && f.is_required).length;
  const filledRequired = formInfo.fields.filter(f => f.field_type !== 'heading' && f.is_required && formData[f.field_key]).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Banner — full bleed */}
      <div className="relative overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>
        </div>
        {formInfo.course?.hero_image_url && (
          <img src={formInfo.course.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15" />
        )}
        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-12 pb-20 sm:pt-16 sm:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 text-xs mb-6">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Registration Open</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {formInfo.course?.name}
          </h1>
          {formInfo.course?.description && (
            <p className="mt-3 text-white/60 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              {formInfo.course.description}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-5">
            {formInfo.course?.level && (
              <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1">
                {formInfo.course.level}
              </Badge>
            )}
            <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1">
              <Clock className="h-3 w-3 mr-1" />
              {formInfo.fields.length} fields
            </Badge>
          </div>
        </div>

        {/* Wave separator */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 80V40C240 10 480 60 720 35C960 10 1200 50 1440 30V80H0Z" className="fill-background" />
        </svg>
      </div>

      {/* Form Container */}
      <div className="bg-background min-h-[50vh]">
        <div className="max-w-xl mx-auto px-4 -mt-6 pb-12 relative z-10">
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{filledRequired} of {totalRequired} required fields completed</span>
              <span className="font-medium">{totalRequired > 0 ? Math.round(filledRequired / totalRequired * 100) : 0}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${totalRequired > 0 ? (filledRequired / totalRequired * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, idx) => (
              <Card key={idx} className="shadow-sm border-border/60 overflow-hidden">
                {section.heading && (
                  <div className="px-6 py-3 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {idx + 1}
                      </div>
                      <h3 className="font-semibold text-sm">{section.heading}</h3>
                    </div>
                  </div>
                )}
                <CardContent className={cn('space-y-5', section.heading ? 'p-6' : 'p-6')}>
                  {section.fields.map(field => renderField(field))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Error banner */}
          {Object.keys(errors).length > 0 && (
            <div className="mt-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20 text-destructive text-sm flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Please fix the errors above</p>
                <p className="text-xs mt-0.5 opacity-80">{Object.keys(errors).length} field(s) need your attention</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full h-12 text-base font-semibold mt-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            onClick={() => submitForm.mutate()}
            disabled={submitForm.isPending || !!uploadingFile}>
            {submitForm.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</>
            ) : (
              <>Submit Application <ArrowRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>

          {/* Trust footer */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Your information is secure and will only be used for enrollment purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
