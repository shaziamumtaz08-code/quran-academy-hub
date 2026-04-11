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
import { toast } from '@/hooks/use-toast';
import {
  BookOpen, CheckCircle2, Loader2, Upload, AlertCircle, Shield
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!formInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Form Not Found</h2>
            <p className="text-sm text-muted-foreground">This registration form is no longer available or does not exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <div className="max-w-lg w-full text-center py-16">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Application Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for applying to <strong>{formInfo.course?.name}</strong>. We'll review your application and get back to you soon.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>Back to home</Button>
        </div>
      </div>
    );
  }

  const renderField = (field: FormField) => {
    if (field.field_type === 'heading') {
      return (
        <div key={field.id} className="pt-6 pb-2 border-b border-border/60">
          <p className="font-semibold text-sm text-foreground">{field.label}</p>
        </div>
      );
    }

    return (
      <div key={field.id} className="space-y-1.5">
        <Label className="text-sm font-medium">
          {field.label} {field.is_required && <span className="text-destructive">*</span>}
        </Label>

        {field.field_type === 'textarea' ? (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}
            className={errors[field.field_key] ? 'border-destructive' : ''}
            rows={4}
          />
        ) : field.field_type === 'dropdown' ? (
          <select
            className={`w-full h-10 rounded-md border px-3 text-sm bg-background ${errors[field.field_key] ? 'border-destructive' : 'border-input'}`}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}>
            <option value="">Select {field.label}...</option>
            {(Array.isArray(field.options) ? field.options : []).map((o: string) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : field.field_type === 'multi_select' ? (
          <div className="space-y-2 pl-1">
            {(Array.isArray(field.options) ? field.options : []).map((opt: string) => {
              const current: string[] = formData[field.field_key] || [];
              return (
                <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer min-h-[28px]">
                  <Checkbox
                    checked={current.includes(opt)}
                    onCheckedChange={(checked) => {
                      const updated = checked ? [...current, opt] : current.filter((v: string) => v !== opt);
                      updateField(field.field_key, updated);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
            {errors[field.field_key] && <p className="text-xs text-destructive">{errors[field.field_key]}</p>}
          </div>
        ) : field.field_type === 'checkbox' ? (
          <div className="flex items-center gap-2.5 min-h-[28px]">
            <Checkbox
              checked={!!formData[field.field_key]}
              onCheckedChange={checked => updateField(field.field_key, checked)}
            />
            <span className="text-sm text-muted-foreground">{field.label}</span>
          </div>
        ) : field.field_type === 'file' ? (
          <div className="space-y-1">
            {formData[field.field_key] ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-md border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-700 truncate">File uploaded</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto"
                  onClick={() => updateField(field.field_key, null)}>Change</Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  onChange={handleFileUpload(field.field_key)}
                  disabled={uploadingFile === field.field_key}
                />
                {uploadingFile === field.field_key && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : field.field_type === 'country' ? (
          <select
            className={`w-full h-10 rounded-md border px-3 text-sm bg-background ${errors[field.field_key] ? 'border-destructive' : 'border-input'}`}
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
            className={errors[field.field_key] ? 'border-destructive' : ''}
          />
        ) : (
          <Input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'date' ? 'date' : 'text'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={formData[field.field_key] || ''}
            onChange={e => updateField(field.field_key, e.target.value)}
            className={errors[field.field_key] ? 'border-destructive' : ''}
          />
        )}

        {field.field_type !== 'multi_select' && errors[field.field_key] && (
          <p className="text-xs text-destructive">{errors[field.field_key]}</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
        {formInfo.course?.hero_image_url && (
          <img src={formInfo.course.hero_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 text-center text-white">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">{formInfo.course?.name}</h1>
          {formInfo.course?.description && (
            <p className="mt-2 text-white/80 text-sm sm:text-base max-w-lg mx-auto">{formInfo.course.description}</p>
          )}
          {formInfo.course?.level && (
            <span className="inline-block mt-3 px-3 py-1 rounded-full bg-white/20 text-xs font-medium">
              {formInfo.course.level}
            </span>
          )}
        </div>
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 60V30C360 0 720 60 1080 30C1260 15 1380 22 1440 30V60H0Z" className="fill-background" />
        </svg>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 py-8 -mt-4 relative z-10">
        <Card className="shadow-lg border-border/50">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold">Apply for this course</h2>
              <p className="text-xs text-muted-foreground mt-1">Fill in your details below. Fields marked <span className="text-destructive">*</span> are required.</p>
            </div>

            <div className="space-y-5">
              {formInfo.fields.map(field => renderField(field))}
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Please fill in all required fields before submitting.
              </div>
            )}

            <Button
              className="w-full h-11 text-base font-medium mt-6"
              onClick={() => submitForm.mutate()}
              disabled={submitForm.isPending || !!uploadingFile}>
              {submitForm.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</>
              ) : 'Submit Application'}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground mt-4 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" /> Your information is secure and will only be used for enrollment purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
