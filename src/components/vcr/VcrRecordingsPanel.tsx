import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Download, Loader2, Pause, Play, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
}

const BUCKET = 'vcr-call-recordings';

const fmt = (sec: number | null) => {
  if (sec === null || sec === undefined) return '—';
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
};

interface Props {
  /** Only this class's recordings. */
  roomId: string;
  /** Staff can download the file, not just play it. */
  canDownload: boolean;
  onClose: () => void;
}

/**
 * Class call recordings shown *inside* the classroom, so nobody is thrown out
 * of the lesson to listen to one.
 */
export function VcrRecordingsPanel({ roomId, canDownload, onClose }: Props) {
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vcr_call_recordings' as any)
      .select('id, room_id, student_id, teacher_id, storage_path, started_at, ended_at, duration_seconds, status')
      .eq('room_id', roomId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) toast({ title: 'Could not load recordings', description: error.message, variant: 'destructive' });
    setRows(((data as any[]) ?? []) as RecordingRow[]);
    setLoading(false);
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  const signed = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  const togglePlay = async (r: RecordingRow) => {
    if (!r.storage_path) return;
    if (playingId === r.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    try {
      setBusyId(r.id);
      setAudioUrl(await signed(r.storage_path));
      setPlayingId(r.id);
      window.setTimeout(() => audioRef.current?.play().catch(() => {}), 60);
    } catch (e: any) {
      toast({ title: 'Playback unavailable', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const download = async (r: RecordingRow) => {
    if (!r.storage_path) return;
    try {
      setBusyId(r.id);
      const a = document.createElement('a');
      a.href = await signed(r.storage_path);
      a.download = `class-recording-${r.started_at.slice(0, 10)}.webm`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          Recordings of calls in this class. They stay here — you do not leave the lesson.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-900/15 px-3 text-xs text-slate-700 hover:bg-slate-900/5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close recordings"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} controls className="w-full"
          onEnded={() => setPlayingId(null)} onPause={() => setPlayingId(null)} />
      )}

      {loading && <p className="text-sm text-slate-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading recordings…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-500">No recordings for this class yet.</p>
      )}

      <ul className="space-y-1.5">
        {rows.map((r) => {
          const ready = (r.status === 'completed' || r.status === 'saved') && !!r.storage_path;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-900/8 bg-slate-900/[0.03] px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800">{new Date(r.started_at).toLocaleString()}</span>
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock className="h-3 w-3" /> {fmt(r.duration_seconds)}
                  <ShieldCheck className="h-3 w-3" /> {ready ? 'Ready' : r.status}
                </span>
              </span>
              <button
                type="button"
                disabled={!ready || busyId === r.id}
                onClick={() => void togglePlay(r)}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-900/15 px-2.5 text-[11px] text-slate-700 disabled:opacity-50"
              >
                {playingId === r.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {playingId === r.id ? 'Pause' : 'Play'}
              </button>
              {canDownload && (
                <button
                  type="button"
                  disabled={!ready || busyId === r.id}
                  onClick={() => void download(r)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-900/15 px-2.5 text-[11px] text-slate-700 disabled:opacity-50"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default VcrRecordingsPanel;
