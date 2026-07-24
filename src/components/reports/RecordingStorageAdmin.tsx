import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HardDrive, Loader2, AlertTriangle, RefreshCw, Trash2, Clock } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function RecordingStorageAdmin() {
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recording-storage-admin'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('live_sessions')
        .select('id, recording_status, stored_file_size_mb, original_file_size_mb, compression_status, zoom_deleted_at, retention_expires_at, download_last_error, download_attempts, scheduled_start')
        .not('recording_status', 'is', null);
      if (error) throw error;
      const list = rows || [];
      const now = Date.now();
      const in7d = now + 7 * 24 * 60 * 60 * 1000;
      const expiringSoon = list.filter((r: any) =>
        r.recording_status === 'ready' &&
        r.retention_expires_at &&
        new Date(r.retention_expires_at).getTime() <= in7d &&
        new Date(r.retention_expires_at).getTime() >= now
      ).sort((a: any, b: any) => new Date(a.retention_expires_at).getTime() - new Date(b.retention_expires_at).getTime());
      return {
        totalMb: list.reduce((sum, r: any) => sum + (r.stored_file_size_mb || 0), 0),
        ready: list.filter((r: any) => r.recording_status === 'ready').length,
        pending: list.filter((r: any) => r.recording_status === 'pending').length,
        failed: list.filter((r: any) => r.recording_status === 'failed').length,
        expired: list.filter((r: any) => r.recording_status === 'expired').length,
        awaitingCleanup: list.filter((r: any) => r.recording_status === 'ready' && !r.zoom_deleted_at).length,
        cleanedUp: list.filter((r: any) => r.zoom_deleted_at).length,
        failures: list.filter((r: any) => r.recording_status === 'failed').slice(0, 20),
        expiringSoon: expiringSoon.slice(0, 25),
        expiringSoonCount: expiringSoon.length,
      };
    },
  });

  const runFn = async (fn: 'zoom-download-recording' | 'zoom-cleanup-recordings' | 'zoom-expire-recordings') => {
    setBusy(fn);
    try {
      const { error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      toast({ title: 'Done', description: fn === 'zoom-download-recording' ? 'Retried pending downloads.' : fn === 'zoom-cleanup-recordings' ? 'Ran Zoom cleanup pass.' : 'Ran retention expiry pass.' });
      refetch();
    } catch (e: any) {
      toast({ title: 'Failed', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Card><CardContent className="p-6"><Loader2 className="h-4 w-4 animate-spin" /></CardContent></Card>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<HardDrive className="h-4 w-4" />} label="Storage used" value={`${(data.totalMb / 1024).toFixed(2)} GB`} />
        <StatCard label="Ready" value={data.ready} />
        <StatCard label="Pending" value={data.pending} tone={data.pending > 0 ? 'warn' : undefined} />
        <StatCard label="Failed" value={data.failed} tone={data.failed > 0 ? 'error' : undefined} />
        <StatCard label="Awaiting Zoom cleanup" value={data.awaitingCleanup} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => runFn('zoom-download-recording')} disabled={!!busy}>
          {busy === 'zoom-download-recording' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Retry pending downloads
        </Button>
        <Button size="sm" variant="outline" onClick={() => runFn('zoom-cleanup-recordings')} disabled={!!busy}>
          {busy === 'zoom-cleanup-recordings' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
          Run Zoom cleanup now
        </Button>
      </div>

      {data.failures.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Failed downloads ({data.failures.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.failures.map((f: any) => (
              <div key={f.id} className="p-2 rounded bg-muted/50">
                <div className="font-mono truncate">{f.id}</div>
                <div className="text-muted-foreground">Attempts: {f.download_attempts} — {f.download_last_error || 'unknown error'}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, icon }: { label: string; value: string | number; tone?: 'warn' | 'error'; icon?: React.ReactNode }) {
  const toneClass = tone === 'error' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
