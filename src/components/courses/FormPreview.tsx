import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  FileText, ExternalLink, Mail, Phone, Calendar, Globe, MapPin,
  CheckCircle2, Hash, Type, AlignLeft, ListChecks, Upload, Heading
} from 'lucide-react';

const FIELD_ICONS: Record<string, typeof Type> = {
  text: Type,
  textarea: AlignLeft,
  email: Mail,
  phone: Phone,
  date: Calendar,
  number: Hash,
  country: Globe,
  file: Upload,
  checkbox: CheckCircle2,
  multi_select: ListChecks,
  dropdown: ListChecks,
  heading: Heading,
};

interface FormPreviewProps {
  formId: string;
  submissionData: Record<string, any>;
}

export function FormPreview({ formId, submissionData }: FormPreviewProps) {
  const { data: fields = [] } = useQuery({
    queryKey: ['form-fields-preview', formId],
    queryFn: async () => {
      const { data } = await supabase.from('registration_form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('sort_order');
      return data || [];
    },
  });

  // Group fields by heading sections
  const sections = React.useMemo(() => {
    const result: { heading: string | null; fields: any[] }[] = [];
    let current: { heading: string | null; fields: any[] } = { heading: null, fields: [] };

    for (const field of fields) {
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
  }, [fields]);

  const renderValue = (field: any) => {
    const value = submissionData[field.field_key];

    if (field.field_type === 'multi_select') {
      const items = Array.isArray(value) ? value : [];
      if (items.length === 0) return <span className="text-sm text-muted-foreground italic">Not provided</span>;
      return (
        <div className="flex flex-wrap gap-1.5">
          {items.map((v: string) => (
            <Badge key={v} variant="secondary" className="text-xs font-normal px-2.5 py-0.5">
              {v}
            </Badge>
          ))}
        </div>
      );
    }

    if (field.field_type === 'checkbox') {
      return (
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-5 w-5 rounded flex items-center justify-center',
            value ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
          )}>
            {value ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-xs">✕</span>}
          </div>
          <span className="text-sm">{value ? 'Yes' : 'No'}</span>
        </div>
      );
    }

    if (field.field_type === 'file') {
      if (!value) return <span className="text-sm text-muted-foreground italic">No file uploaded</span>;
      return (
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.open(value, '_blank')}>
          <FileText className="h-3.5 w-3.5" />
          View file
          <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
        </Button>
      );
    }

    if (field.field_type === 'email' && value) {
      return (
        <a href={`mailto:${value}`} className="text-sm text-primary hover:underline flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 opacity-50" />
          {value}
        </a>
      );
    }

    if (field.field_type === 'phone' && value) {
      return (
        <span className="text-sm flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 opacity-50" />
          {value}
        </span>
      );
    }

    if (!value && value !== 0 && value !== false) {
      return <span className="text-sm text-muted-foreground italic">Not provided</span>;
    }

    return <span className="text-sm">{String(value)}</span>;
  };

  const filledCount = fields.filter((f: any) => f.field_type !== 'heading' && submissionData[f.field_key]).length;
  const totalCount = fields.filter((f: any) => f.field_type !== 'heading').length;

  return (
    <div className="space-y-1">
      {/* Completion summary */}
      <div className="flex items-center justify-between pb-3">
        <span className="text-xs text-muted-foreground">
          {filledCount} of {totalCount} fields filled
        </span>
        <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (filledCount / totalCount * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.heading && (
            <div className="flex items-center gap-2 pt-4 pb-2">
              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">{sIdx + 1}</span>
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.heading}
              </h4>
              <Separator className="flex-1" />
            </div>
          )}

          <div className="space-y-0 divide-y divide-border/50">
            {section.fields.map((field: any) => {
              const Icon = FIELD_ICONS[field.field_type] || Type;
              const value = submissionData[field.field_key];
              const isEmpty = !value && value !== 0 && value !== false;

              return (
                <div key={field.id} className={cn(
                  'flex items-start gap-3 py-2.5',
                  isEmpty && 'opacity-60'
                )}>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      {field.label}
                      {field.is_required && <span className="text-destructive">*</span>}
                    </p>
                    {renderValue(field)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Extra fields not in form definition */}
      {(() => {
        const extraEntries = Object.entries(submissionData)
          .filter(([key]) => !fields.some((f: any) => f.field_key === key));
        if (extraEntries.length === 0) return null;
        return (
          <div>
            <div className="flex items-center gap-2 pt-4 pb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Additional Data
              </h4>
              <Separator className="flex-1" />
            </div>
            <div className="space-y-0 divide-y divide-border/50">
              {extraEntries.map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 py-2.5">
                  <Type className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <span className="text-sm">{String(value || '—')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
