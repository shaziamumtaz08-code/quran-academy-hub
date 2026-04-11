import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

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

  return (
    <div className="space-y-4">
      {fields.map((field: any) => {
        const value = submissionData[field.field_key];
        return (
          <div key={field.id} className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {field.label} {field.is_required && <span className="text-destructive">*</span>}
            </Label>
            {field.field_type === 'heading' ? (
              <div className="pt-2 pb-1 border-b">
                <p className="font-medium text-sm">{field.label}</p>
              </div>
            ) : field.field_type === 'multi_select' ? (
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(value) ? value : []).map((v: string) => (
                  <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                ))}
                {(!value || (Array.isArray(value) && value.length === 0)) && <span className="text-sm text-muted-foreground">—</span>}
              </div>
            ) : field.field_type === 'checkbox' ? (
              <div className="flex items-center gap-2">
                <Checkbox checked={!!value} disabled />
                <span className="text-sm">{value ? 'Yes' : 'No'}</span>
              </div>
            ) : field.field_type === 'file' ? (
              value ? (
                <Button variant="outline" size="sm" onClick={() => window.open(value, '_blank')}>
                  <FileText className="h-4 w-4 mr-1" /> View uploaded file
                </Button>
              ) : <span className="text-sm text-muted-foreground">No file uploaded</span>
            ) : (
              <div className="px-3 py-2 bg-muted/50 rounded-md text-sm">{String(value || '—')}</div>
            )}
          </div>
        );
      })}

      {/* Extra fields not in form definition */}
      {Object.entries(submissionData)
        .filter(([key]) => !fields.some((f: any) => f.field_key === key))
        .map(([key, value]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</Label>
            <div className="px-3 py-2 bg-muted/50 rounded-md text-sm">{String(value || '—')}</div>
          </div>
        ))
      }
    </div>
  );
}
