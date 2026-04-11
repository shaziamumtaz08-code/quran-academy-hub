import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus, Trash2, GripVertical, Copy, ExternalLink, Eye, EyeOff,
  Type, Mail, Phone, Calendar, CheckSquare, Upload, List, ArrowUp, ArrowDown, Loader2,
  AlignLeft, ListChecks, Hash, Globe, Heading, Download
} from 'lucide-react';

interface FormField {
  id: string;
  form_id: string;
  label: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  options: any;
  is_default: boolean;
  placeholder: string | null;
}

interface RegistrationFormEditorProps {
  courseId: string;
  courseSlug: string;
  courseName: string;
}

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Short Text', icon: Type },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'dropdown', label: 'Dropdown Select', icon: List },
  { value: 'multi_select', label: 'Multi Select (checkboxes)', icon: ListChecks },
  { value: 'checkbox', label: 'Single Checkbox', icon: CheckSquare },
  { value: 'file', label: 'File Upload', icon: Upload },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'country', label: 'Country Selector', icon: Globe },
  { value: 'heading', label: 'Section Heading (no input)', icon: Heading },
];

const DEFAULT_FIELDS = [
  { label: 'Full Name', field_key: 'full_name', field_type: 'text', is_required: true, sort_order: 0, is_default: true, placeholder: 'Enter your full name' },
  { label: 'Email', field_key: 'email', field_type: 'email', is_required: true, sort_order: 1, is_default: true, placeholder: 'your@email.com' },
  { label: 'Phone', field_key: 'phone', field_type: 'phone', is_required: true, sort_order: 2, is_default: true, placeholder: '+1 234 567 890' },
  { label: 'Date of Birth', field_key: 'dob', field_type: 'date', is_required: false, sort_order: 3, is_default: true, placeholder: null },
  { label: 'Gender', field_key: 'gender', field_type: 'dropdown', is_required: false, sort_order: 4, is_default: true, options: ['Male', 'Female', 'Other'], placeholder: null },
  { label: 'City', field_key: 'city', field_type: 'text', is_required: false, sort_order: 5, is_default: true, placeholder: 'Your city' },
  { label: 'How did you hear about us?', field_key: 'referral_source', field_type: 'dropdown', is_required: false, sort_order: 6, is_default: true, options: ['Social Media', 'Friend/Family', 'Google Search', 'WhatsApp', 'Flyer/Poster', 'Other'], placeholder: null },
];

const FIELD_ICON_MAP: Record<string, React.ElementType> = {
  text: Type, textarea: AlignLeft, email: Mail, phone: Phone, dropdown: List,
  multi_select: ListChecks, checkbox: CheckSquare, file: Upload, date: Calendar,
  number: Hash, country: Globe, heading: Heading,
};

export function RegistrationFormEditor({ courseId, courseSlug, courseName }: RegistrationFormEditorProps) {
  const queryClient = useQueryClient();
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState('');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCourseId, setImportCourseId] = useState('');

  // Fetch or create form
  const { data: form, isLoading: formLoading } = useQuery({
    queryKey: ['registration-form', courseId],
    queryFn: async () => {
      const { data: existing } = await supabase
        .from('registration_forms')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();

      if (existing) return existing;

      const slug = courseSlug || courseId;
      const { data: form, error } = await supabase
        .from('registration_forms')
        .insert({ course_id: courseId, slug, title: `${courseName} Registration` })
        .select()
        .single();
      if (error) throw error;

      const fieldsToInsert = DEFAULT_FIELDS.map(f => ({
        ...f,
        form_id: form.id,
        options: f.options ? f.options : null,
      }));
      await supabase.from('registration_form_fields').insert(fieldsToInsert);

      return form;
    },
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ['registration-form-fields', form?.id],
    enabled: !!form?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_form_fields')
        .select('*')
        .eq('form_id', form!.id)
        .order('sort_order');
      if (error) throw error;
      return data as FormField[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['registration-form', courseId] });
    queryClient.invalidateQueries({ queryKey: ['registration-form-fields', form?.id] });
  };

  // Add field
  const addField = useMutation({
    mutationFn: async () => {
      const fieldKey = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.sort_order)) + 1 : 0;
      const options = (newType === 'dropdown' || newType === 'multi_select') && newOptions.trim()
        ? newOptions.split(',').map(o => o.trim()).filter(Boolean)
        : null;

      const { error } = await supabase.from('registration_form_fields').insert({
        form_id: form!.id,
        label: newLabel.trim(),
        field_key: fieldKey,
        field_type: newType,
        is_required: newType === 'heading' ? false : newRequired,
        sort_order: maxOrder,
        options,
        is_default: false,
        placeholder: newPlaceholder || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setAddFieldOpen(false);
      setNewLabel(''); setNewType('text'); setNewRequired(false); setNewOptions(''); setNewPlaceholder('');
      toast({ title: 'Field added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Delete field
  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from('registration_form_fields').delete().eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: 'Field removed' }); },
  });

  // Toggle required
  const toggleRequired = useMutation({
    mutationFn: async ({ id, required }: { id: string; required: boolean }) => {
      const { error } = await supabase.from('registration_form_fields').update({ is_required: required }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  // Update label
  const updateLabel = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.from('registration_form_fields').update({ label }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  // Reorder
  const moveField = useMutation({
    mutationFn: async ({ fieldId, direction }: { fieldId: string; direction: 'up' | 'down' }) => {
      const idx = fields.findIndex(f => f.id === fieldId);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= fields.length) return;

      const currentOrder = fields[idx].sort_order;
      const swapOrder = fields[swapIdx].sort_order;

      await Promise.all([
        supabase.from('registration_form_fields').update({ sort_order: swapOrder }).eq('id', fields[idx].id),
        supabase.from('registration_form_fields').update({ sort_order: currentOrder }).eq('id', fields[swapIdx].id),
      ]);
    },
    onSuccess: () => invalidate(),
  });

  // Toggle form active
  const toggleActive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('registration_forms')
        .update({ is_active: !form?.is_active })
        .eq('id', form!.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: form?.is_active ? 'Form deactivated' : 'Form activated' }); },
  });

  // Duplicate form fields
  const handleDuplicateForm = async () => {
    if (!fields.length) return;
    navigator.clipboard.writeText(JSON.stringify(fields.map(f => ({
      label: f.label, field_key: f.field_key, field_type: f.field_type,
      is_required: f.is_required, sort_order: f.sort_order, options: f.options,
      is_default: f.is_default, placeholder: f.placeholder,
    }))));
    toast({ title: 'Form structure copied', description: 'Paste into another course form editor.' });
  };

  // Download sample CSV
  const handleDownloadSample = () => {
    const inputFields = fields.filter(f => f.field_type !== 'heading');
    const headers = inputFields.map(f => f.field_key).join(',');
    const sampleRow = inputFields.map(f => {
      if (f.field_type === 'email') return 'example@email.com';
      if (f.field_type === 'phone') return '+923001234567';
      if (f.field_type === 'date') return '2000-01-15';
      if (f.field_type === 'number') return '0';
      if (f.field_type === 'dropdown') return (Array.isArray(f.options) ? f.options[0] : '') || '';
      if (f.field_type === 'multi_select') return (Array.isArray(f.options) ? f.options[0] : '') || '';
      if (f.field_type === 'checkbox') return 'true';
      if (f.field_type === 'country') return 'Pakistan';
      return '';
    }).join(',');

    const csv = `${headers}\n${sampleRow}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registration_template_${courseId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const publicUrl = `/apply/${form?.slug || courseSlug}`;

  if (formLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Form Editor */}
      <div className="space-y-4">
        {/* Header with URL + toggle */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Registration Form</h3>
                <p className="text-xs text-muted-foreground">{fields.length} fields</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setImportDialogOpen(true)}>
                  <Download className="h-3.5 w-3.5" /> Import
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleDuplicateForm}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleDownloadSample}>
                  <Download className="h-3.5 w-3.5" /> Sample CSV
                </Button>
                <Label className="text-xs text-muted-foreground">{form?.is_active ? 'Active' : 'Inactive'}</Label>
                <Switch checked={form?.is_active || false} onCheckedChange={() => toggleActive.mutate()} />
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="text-xs flex-1 truncate">{window.location.origin}{publicUrl}</code>
              <Button variant="ghost" size="sm" className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`); toast({ title: 'Link copied!' }); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fields list */}
        <div className="space-y-2">
          {fields.map((field, idx) => {
            const Icon = FIELD_ICON_MAP[field.field_type] || Type;
            return (
              <Card key={field.id} className={cn("shadow-sm", field.field_type === 'heading' && "border-dashed bg-muted/30")}>
                <CardContent className="p-3 flex items-center gap-2">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveField.mutate({ fieldId: field.id, direction: 'up' })}
                      disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveField.mutate({ fieldId: field.id, direction: 'down' })}
                      disabled={idx === fields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <EditableLabel
                    value={field.label}
                    onChange={(label) => updateLabel.mutate({ id: field.id, label })}
                  />
                  <Badge variant="outline" className="text-[10px] shrink-0">{field.field_type}</Badge>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {field.field_type !== 'heading' && (
                      <button
                        onClick={() => toggleRequired.mutate({ id: field.id, required: !field.is_required })}
                        className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                          field.is_required ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                        )}>
                        {field.is_required ? 'Required' : 'Optional'}
                      </button>
                    )}
                    {!field.is_default && (
                      <button onClick={() => deleteField.mutate(field.id)}
                        className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button variant="outline" className="w-full gap-1.5" onClick={() => setAddFieldOpen(true)}>
          <Plus className="h-4 w-4" /> Add Custom Field
        </Button>
      </div>

      {/* RIGHT: Live Preview */}
      <div>
        <Card className="sticky top-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" /> Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <h3 className="font-semibold text-base">{form?.title || 'Registration Form'}</h3>
              <p className="text-xs text-muted-foreground mt-1">{courseName}</p>
            </div>
            {fields.map(field => (
              <div key={field.id} className="space-y-1">
                {field.field_type === 'heading' ? (
                  <div className="pt-3 pb-1 border-b">
                    <p className="font-medium text-sm">{field.label}</p>
                  </div>
                ) : (
                  <>
                    <Label className="text-xs">
                      {field.label} {field.is_required && <span className="text-destructive">*</span>}
                    </Label>
                    {field.field_type === 'dropdown' ? (
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" disabled>
                        <option>Select {field.label}...</option>
                        {(Array.isArray(field.options) ? field.options : []).map((o: string) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : field.field_type === 'multi_select' ? (
                      <div className="space-y-1.5 pl-1">
                        {(Array.isArray(field.options) ? field.options : []).map((o: string) => (
                          <label key={o} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" disabled className="h-3.5 w-3.5" /> {o}
                          </label>
                        ))}
                      </div>
                    ) : field.field_type === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <input type="checkbox" disabled className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">{field.label}</span>
                      </div>
                    ) : field.field_type === 'file' ? (
                      <div className="border border-dashed border-border rounded-md p-3 text-center text-xs text-muted-foreground">
                        <Upload className="h-4 w-4 mx-auto mb-1" /> Click to upload
                      </div>
                    ) : field.field_type === 'textarea' ? (
                      <Textarea placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} disabled rows={3} />
                    ) : field.field_type === 'country' ? (
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" disabled>
                        <option>Select country...</option>
                      </select>
                    ) : (
                      <Input
                        type={field.field_type === 'email' ? 'email' : field.field_type === 'phone' ? 'tel' : field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled
                      />
                    )}
                  </>
                )}
              </div>
            ))}
            <Button className="w-full" disabled>Submit Application</Button>
          </CardContent>
        </Card>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>Add a new field to the registration form</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Field Label *</Label>
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Previous Quran Experience" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map(t => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {t.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {(newType === 'dropdown' || newType === 'multi_select') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Options (comma-separated)</Label>
                <Input value={newOptions} onChange={e => setNewOptions(e.target.value)} placeholder="Option 1, Option 2, Option 3" />
              </div>
            )}
            {newType !== 'heading' && newType !== 'checkbox' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input value={newPlaceholder} onChange={e => setNewPlaceholder(e.target.value)} placeholder="Placeholder text" />
              </div>
            )}
            {newType !== 'heading' && (
              <div className="flex items-center gap-2">
                <Switch checked={newRequired} onCheckedChange={setNewRequired} />
                <Label className="text-xs">Required field</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFieldOpen(false)}>Cancel</Button>
            <Button onClick={() => addField.mutate()} disabled={!newLabel.trim() || addField.isPending}>
              {addField.isPending ? 'Adding…' : 'Add Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline editable label
function EditableLabel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (editing) {
    return (
      <Input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { setEditing(false); if (text.trim() && text !== value) onChange(text.trim()); }}
        onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); if (text.trim() && text !== value) onChange(text.trim()); } }}
        className="h-7 text-sm flex-1"
        autoFocus
      />
    );
  }

  return (
    <span className="text-sm font-medium truncate flex-1 cursor-pointer hover:text-primary" onClick={() => setEditing(true)}>
      {value}
    </span>
  );
}
