import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { PageShell } from '@/components/layout/PageShell';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Video, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { resolveFileUrl } from '@/lib/signedUrl';

export default function Recordings() {
  const { user } = useAuth();
  const { activeKidId } = useKidContext();
  const studentId = activeKidId || user?.id || null;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['recordings-list', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          scheduled_start,
          actual_start,
          recording_link,
          recording_status,
          student_id,
          teacher:profiles!live_sessions_teacher_id_fkey(id, full_name),
          session_recordings(id, play_url, download_url, recording_start, status, file_size_mb)
        `)
        .eq('student_id', studentId)
        .order('scheduled_start', { ascending: false })
        .limit(200);

      if (error) throw error;
      return sessions || [];
    },
  });

  const handleWatch = async (rawUrl: string) => {
    const signed = await resolveFileUrl(rawUrl);
    if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
  };

  return (
    <DashboardLayout>
      <PageShell title="Recordings" description="Your past class recordings, most recent first.">
        <div className="space-y-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : rows.length === 0 ? (
            <div className="border border-border rounded-xl p-10 text-center bg-card">
              <Video className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No recordings yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your class recordings will appear here once processing completes.</p>
            </div>
          ) : (
            rows.map((s: any) => {
              const rec = (s.session_recordings || []).find((r: any) => r.status === 'available');
              const url = rec?.play_url || (s.recording_status === 'ready' ? s.recording_link : null);
              const when = s.actual_start || s.scheduled_start;
              const status = s.recording_status || 'pending';
              return (
                <div key={s.id} className="border border-border rounded-xl p-4 bg-card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium truncate">
                      <Video className="h-4 w-4 text-rose-600 shrink-0" />
                      <span className="truncate">{s.teacher?.full_name || 'Class recording'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {when ? format(new Date(when), 'PP p') : '—'}
                    </div>
                  </div>
                  {url && status !== 'expired' ? (
                    <Button size="sm" variant="default" onClick={() => handleWatch(url)}>
                      Watch <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  ) : status === 'expired' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" /> Recording expired (60-day limit)
                    </span>
                  ) : status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Recording unavailable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording processing…
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PageShell>
    </DashboardLayout>
  );
}
