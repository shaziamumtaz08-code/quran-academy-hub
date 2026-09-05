import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Pause, Download, ShieldCheck, Clock, CloudUpload, RefreshCw } from 'lucide-react';

interface RecordingRow {
  id: string;
  room_id: string;
  student_id: string | null;
  teacher_id: string | null;
  storage_path: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  created_by: string | null;
}

const STAFF_ROLES = ['teacher', 'admin', 'super_admin', 'admin_academic', 'admin_division'];
const BUCKET = 'vcr-call-recordings';

function fmtDuration(sec: number | null) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VcrRecordings() {
  const { user, profile, activeRole } = useAuth();
  const { toast } = useToast();
  const roles: string[] = (profile as any)?.roles || (activeRole ? [activeRole] : []);
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('vcr_call_recordings' as any)
      .select('id, room_id, student_id, teacher_id, storage_path, started_at, ended_at, duration_seconds, status, created_by')
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: 'Could not load recordings', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const list = (data as unknown as RecordingRow[]) || [];
    setRows(list);
    const ids = Array.from(new Set(list.flatMap((r) => [r.student_id, r.teacher_id]).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p.full_name; });
      setNames(map);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  const signedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  const togglePlay = async (r: RecordingRow) => {
    if (!r.storage_path) return;
    try {
      if (playingId === r.id) {
        audioRef.current?.pause();
        setPlayingId(null);
        return;
      }
      setBusyId(r.id);
      const url = await signedUrl(r.storage_path);
      setAudioUrl(url);
      setPlayingId(r.id);
      // let the <audio> element mount, then play
      setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    } catch (e: any) {
      toast({ title: 'Playback unavailable', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const download = async (r: RecordingRow) => {
    if (!r.storage_path) return;
    try {
      setBusyId(r.id);
      const url = await signedUrl(r.storage_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = `class-recording-${r.started_at.slice(0, 10)}-${r.id.slice(0, 8)}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const backupToDrive = async () => {
    setBackingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('vcr-drive-backup', { body: {} });
      if (error) throw error;
      const res = data as any;
      toast({
        title: 'Backup complete',
        description: `Copied ${res?.uploaded ?? 0} new recording(s) to Google Drive${res?.skipped ? `, ${res.skipped} already backed up` : ''}.`,
      });
    } catch (e: any) {
      toast({ title: 'Drive backup failed', description: e.message, variant: 'destructive' });
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">In-App Class Call Recordings</h1>
          <p className="text-sm text-muted-foreground">
            Saved VCR audio calls appear here after recording stops and finishes saving. Only people on the call (and admins) can see them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh recordings
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={backupToDrive} disabled={backingUp}>
              {backingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CloudUpload className="h-4 w-4 mr-2" />}
              Backup to Google Drive
            </Button>
          )}
        </div>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setPlayingId(null)}
          onPause={() => setPlayingId(null)}
          className="w-full"
          controls
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No recordings yet. Recordings appear here after a class call is recorded with student consent.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            // 'saved' is the legacy success status kept for older rows.
            const ready = (r.status === 'completed' || r.status === 'saved') && !!r.storage_path;
            return (
              <Card key={r.id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-foreground truncate">
                    {names[r.teacher_id ?? ''] ?? 'Teacher'} ↔ {names[r.student_id ?? ''] ?? 'Student'}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    <span>{new Date(r.started_at).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(r.duration_seconds)}</span>
                    <Badge variant={ready ? 'secondary' : 'outline'} className="text-[10px]">
                      {ready ? 'Ready' : r.status}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" /> Consented
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!ready || busyId === r.id} onClick={() => togglePlay(r)}>
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : playingId === r.id ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {playingId === r.id ? 'Pause recording' : 'Play recording'}
                  </Button>
                  {(isStaff || isAdmin) && (
                    <Button size="sm" variant="ghost" disabled={!ready || busyId === r.id} onClick={() => download(r)}>
                      <Download className="h-4 w-4 mr-2" /> Download recording
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
