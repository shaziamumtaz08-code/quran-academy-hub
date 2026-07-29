import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

export function NeedsReviewQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['remarks-needs-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id, exam_date, percentage, public_remarks, remarks_flag_reason,
          student:profiles!exams_student_id_fkey(full_name),
          template:exam_templates!exams_template_id_fkey(name, subject:subjects(name))
        `)
        .eq('remarks_status', 'needs_review')
        .is('deleted_at', null)
        .order('exam_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const approve = async (id: string) => {
    setSaving(id);
    try {
      const update: Record<string, unknown> = { remarks_status: 'published', remarks_flag_reason: null };
      if (edits[id] !== undefined) update.public_remarks = edits[id];
      const { error } = await supabase.from('exams').update(update).eq('id', id);
      if (error) throw error;
      toast({ title: 'Remark published' });
      qc.invalidateQueries({ queryKey: ['remarks-needs-review'] });
      qc.invalidateQueries({ queryKey: ['student-reports'] });
    } catch (e: any) {
      toast({ title: 'Could not publish', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  if (isLoading || rows.length === 0) return null;

  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Needs review
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Auto-written parent remarks held back because marks were low or the wording was sensitive.
          Edit if needed, then publish.
        </p>
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{r.student?.full_name}</span>
              <span className="text-muted-foreground">
                {r.template?.subject?.name || r.template?.name} · {r.exam_date}
              </span>
              <Badge variant="outline" className="tabular-nums">{r.percentage}%</Badge>
              <Badge variant="destructive" className="ml-auto text-xs">{r.remarks_flag_reason}</Badge>
            </div>
            <Textarea
              rows={3}
              value={edits[r.id] ?? r.public_remarks ?? ''}
              onChange={(e) => setEdits((p) => ({ ...p, [r.id]: e.target.value }))}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => approve(r.id)} disabled={saving === r.id}>
                {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Publish
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
