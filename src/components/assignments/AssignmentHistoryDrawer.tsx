import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Loader2, History as HistoryIcon } from 'lucide-react';
import { formatDisplayDate } from '@/lib/dateFormat';

interface Props {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  reason: string | null;
  teacher_id: string;
  subject_id: string | null;
  teacher?: { full_name: string } | null;
  subject?: { name: string } | null;
}

const reasonColor = (reason: string | null) => {
  const r = (reason || '').toLowerCase();
  if (r.includes('payout')) return 'bg-amber-500';
  if (r.includes('info')) return 'bg-blue-500';
  if (r.includes('close')) return 'bg-rose-500';
  if (r.includes('reassign')) return 'bg-violet-500';
  if (r.includes('created') || r.includes('initial')) return 'bg-emerald-500';
  return 'bg-muted-foreground';
};

export function AssignmentHistoryDrawer({ assignmentId, open, onOpenChange }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['assignment-history', assignmentId],
    enabled: !!assignmentId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_history')
        .select('id, started_at, ended_at, reason, teacher_id, subject_id, teacher:profiles!assignment_history_teacher_id_fkey(full_name), subject:subjects(name)')
        .eq('assignment_id', assignmentId!)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as HistoryRow[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            Assignment History
          </SheetTitle>
          <SheetDescription>
            Every change recorded for this assignment, newest first.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No history yet.</p>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
              <div className="space-y-5">
                {rows.map((row) => (
                  <div key={row.id} className="relative">
                    <div className={`absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${reasonColor(row.reason)}`} />
                    <div className="rounded-md border border-border bg-card p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{row.reason || 'Update'}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDisplayDate(row.started_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDisplayDate(row.started_at)} → {row.ended_at ? formatDisplayDate(row.ended_at) : <span className="text-emerald-600 font-medium">Ongoing</span>}
                      </p>
                      <div className="text-xs text-foreground/80">
                        Teacher: <span className="font-medium">{row.teacher?.full_name || '—'}</span>
                        {row.subject?.name && <> · Subject: <span className="font-medium">{row.subject.name}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
