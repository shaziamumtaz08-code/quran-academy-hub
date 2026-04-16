import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  ChevronLeft, Mic, MicOff, Video, VideoOff, MonitorUp,
  MessageCircle, MousePointer2, Pencil, Eraser, Square,
  Type, StickyNote, Undo2, Redo2, X, Circle,
  FolderOpen, Play, Volume2, Globe, Plus,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import ClassroomTeachingPanel from '@/components/classroom/ClassroomTeachingPanel';
import { Tldraw, createTLStore, defaultShapeUtils } from 'tldraw';
import 'tldraw/tldraw.css';

/* ─── TYPES ─── */
type Mode = 'standard' | 'conversation' | 'whiteboard';
type Tool = 'select' | 'draw' | 'eraser' | 'shapes' | 'text' | 'sticky';

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];

const TOOLS: { key: Tool; icon: React.ElementType; label: string }[] = [
  { key: 'select', icon: MousePointer2, label: 'Select' },
  { key: 'draw', icon: Pencil, label: 'Draw' },
  { key: 'eraser', icon: Eraser, label: 'Eraser' },
  { key: 'shapes', icon: Square, label: 'Shapes' },
  { key: 'text', icon: Type, label: 'Text' },
  { key: 'sticky', icon: StickyNote, label: 'Sticky Note' },
];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── COMPONENT ─── */
export default function VirtualClassroom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>('standard');
  const [activeTool, setActiveTool] = useState<Tool>('draw');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [resOpen, setResOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeBoard, setActiveBoard] = useState(0);
  const [boards, setBoards] = useState(['Board 1', 'Board 2']);

  // Supabase data
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string; initials: string; color: string; isTeacher?: boolean }[]>([]);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());

  // Fetch session
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase
        .from('virtual_sessions' as any)
        .select('*, courses(name)')
        .eq('id', sessionId)
        .maybeSingle();
      if (data) setSession(data);
    })();
  }, [sessionId]);

  // Fetch participants
  useEffect(() => {
    if (!session?.course_id) return;
    (async () => {
      const { data } = await supabase
        .from('course_class_students')
        .select('student_id, student:profiles!course_class_students_student_id_fkey(id, full_name)')
        .eq('class_id', session.class_id || '')
        .eq('status', 'active');

      const students = (data || []).map((d: any, i: number) => ({
        id: d.student_id,
        name: d.student?.full_name || 'Student',
        initials: getInitials(d.student?.full_name || 'ST'),
        color: AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length],
      }));

      // Teacher tile first
      const teacherTile = {
        id: user?.id || 'teacher',
        name: 'You (Teacher)',
        initials: 'YT',
        color: '#3b82f6',
        isTeacher: true,
      };
      setParticipants([teacherTile, ...students.slice(0, 5)]);
    })();
  }, [session?.course_id, session?.class_id, user?.id]);

  // Timer: count from started_at or mount time
  useEffect(() => {
    const startTime = session?.started_at ? new Date(session.started_at).getTime() : Date.now();
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [session?.started_at]);

  // Realtime: raised hands via student_signals
  useEffect(() => {
    if (!sessionId) return;
    // Fetch existing
    (async () => {
      const { data } = await supabase
        .from('student_signals' as any)
        .select('student_id')
        .eq('session_log_id', sessionId)
        .eq('signal_type', 'raise_hand');
      if (data) setRaisedHands(new Set(data.map((d: any) => d.student_id)));
    })();

    const channel = supabase
      .channel(`signals-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'student_signals', filter: `session_log_id=eq.${sessionId}` }, (payload) => {
        const s = payload.new as any;
        if (s.signal_type === 'raise_hand') setRaisedHands(prev => new Set([...prev, s.student_id]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'student_signals', filter: `session_log_id=eq.${sessionId}` }, (payload) => {
        const s = payload.old as any;
        setRaisedHands(prev => { const n = new Set(prev); n.delete(s.student_id); return n; });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const fmt = (s: number) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${ss}`;
  };

  // Close resource panel on outside click
  const resRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!resOpen) return;
    const handler = (e: MouseEvent) => {
      if (resRef.current && !resRef.current.contains(e.target as Node)) setResOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [resOpen]);

  // End session
  const handleEndSession = async () => {
    if (sessionId) {
      await supabase
        .from('virtual_sessions' as any)
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);
      toast.success('Session ended');
    }
    navigate(-1);
  };

  // Toggle recording
  const handleToggleRecording = async () => {
    if (!sessionId) return;
    if (!recording) {
      const { data, error } = await supabase
        .from('session_recordings')
        .insert({ virtual_session_id: sessionId, status: 'recording', recording_start: new Date().toISOString(), recording_type: 'classroom' } as any)
        .select('id')
        .single();
      if (!error && data) {
        setRecordingId(data.id);
        setRecording(true);
        toast.success('Recording started');
      }
    } else if (recordingId) {
      await supabase
        .from('session_recordings')
        .update({ status: 'stopped', recording_end: new Date().toISOString() })
        .eq('id', recordingId);
      setRecording(false);
      setRecordingId(null);
      toast.success('Recording stopped');
    }
  };

  // Lower hand (teacher action)
  const lowerHand = async (studentId: string) => {
    await supabase
      .from('student_signals' as any)
      .delete()
      .eq('session_log_id', sessionId)
      .eq('student_id', studentId)
      .eq('signal_type', 'raise_hand');
    setRaisedHands(prev => { const n = new Set(prev); n.delete(studentId); return n; });
  };

  const showWhiteboard = mode !== 'conversation';
  const showVideoFull = mode === 'conversation';
  const videoFloating = mode === 'whiteboard';

  const sessionName = session?.courses?.name
    ? `${session.courses.name}${session.room_name ? ' · ' + session.room_name : ''}`
    : 'Virtual Classroom';

  const studentParticipants = participants.filter(p => !p.isTeacher);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f172a]" style={{ minWidth: 1024 }}>

        {/* ═══ TOP BAR ═══ */}
        <div className="h-[52px] shrink-0 flex items-center justify-between px-4" style={{ background: '#1a2744' }}>
          {/* Left */}
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-white text-[13px] font-medium truncate max-w-[260px]">
              {sessionName}
            </span>
          </div>

          {/* Center */}
          <div className="flex items-center gap-4">
            <span className="text-white font-mono text-sm tracking-wider">{fmt(elapsed)}</span>
            <div className="flex rounded-full overflow-hidden border border-white/20">
              {(['standard', 'conversation', 'whiteboard'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                    mode === m ? 'bg-white text-[#1a2744]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {m === 'standard' ? 'Standard' : m === 'conversation' ? 'Conversation' : 'Whiteboard'}
                </button>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleRecording}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-[12px] transition-colors"
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              {recording ? 'Recording' : 'Record'}
            </button>
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 rounded-md text-white text-[12px] font-medium"
              style={{ background: '#e53e3e' }}
            >
              End Session
            </button>
          </div>
        </div>

        {/* ═══ MAIN AREA ═══ */}
        <div className="flex-1 flex relative overflow-hidden">

          {/* — WHITEBOARD — */}
          {showWhiteboard && (
            <div
              className="relative transition-all duration-[250ms] ease-in-out"
              style={{ width: mode === 'whiteboard' ? '100%' : '65%' }}
            >
              {/* Tldraw boards — each preserved via display toggle */}
              {boards.map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{ display: activeBoard === i ? 'block' : 'none', zIndex: 1 }}
                >
                  <Tldraw hideUi inferDarkMode={false} />
                </div>
              ))}

              {/* Dot grid fallback behind tldraw */}
              <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }}>
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="1" fill="#e5e7eb" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#dotGrid)" />
                </svg>
              </div>

              {/* Floating Toolbar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white rounded-full px-3 py-1.5 shadow-lg border border-gray-200">
                {TOOLS.map(t => {
                  const Icon = t.icon;
                  const active = activeTool === t.key;
                  return (
                    <Tooltip key={t.key}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setActiveTool(t.key)}
                          className={`p-2 rounded-full transition-colors ${
                            active ? 'bg-[#eff6ff] text-[#3b82f6]' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{t.label}</TooltipContent>
                    </Tooltip>
                  );
                })}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2">
                      <Circle className="h-4 w-4 fill-[#3b82f6] text-[#3b82f6]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Color</TooltipContent>
                </Tooltip>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Undo</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                      <Redo2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Redo</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* — VIDEO PANEL + TEACHING PANEL — */}
          <div
            className={`transition-all duration-[250ms] ease-in-out flex flex-col ${
              videoFloating
                ? 'absolute bottom-4 right-4 z-30 rounded-xl overflow-hidden shadow-2xl'
                : ''
            }`}
            style={
              videoFloating
                ? { width: 200, height: 80, background: '#0f172a' }
                : showVideoFull
                  ? { width: '100%', background: '#0f172a' }
                  : { width: '35%', background: '#0f172a' }
            }
          >
            {videoFloating ? (
              <div className="flex items-center justify-center gap-1 h-full px-2">
                {participants.map(p => (
                  <div key={p.id} className="h-10 w-10 rounded-full flex items-center justify-center text-[9px] text-white font-medium shrink-0" style={{ background: p.color }}>
                    {p.initials}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className={`flex-1 p-3 grid gap-2 auto-rows-fr ${showVideoFull ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {participants.map(p => (
                    <div
                      key={p.id}
                      className="rounded-lg flex flex-col items-center justify-center gap-1 relative"
                      style={{
                        background: '#1e293b',
                        border: p.isTeacher ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {raisedHands.has(p.id) && (
                        <button
                          onClick={() => lowerHand(p.id)}
                          className="absolute top-1.5 left-1.5 text-sm leading-none cursor-pointer hover:scale-110 transition-transform"
                          title="Lower hand"
                        >
                          ✋
                        </button>
                      )}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ background: p.color }}
                      >
                        {p.initials}
                      </div>
                      <span className="text-white text-[10px]">{p.name}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom controls */}
                <div className="h-11 flex items-center justify-center gap-3 border-t border-white/10 shrink-0">
                  <button onClick={() => setMicOn(!micOn)} className="text-white/70 hover:text-white transition-colors">
                    {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-red-400" />}
                  </button>
                  <button onClick={() => setCamOn(!camOn)} className="text-white/70 hover:text-white transition-colors">
                    {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4 text-red-400" />}
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors">
                    <MonitorUp className="h-4 w-4" />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors relative">
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>

                {/* Teaching Panel */}
                {!videoFloating && session?.course_id && (
                  <ClassroomTeachingPanel
                    courseId={session.course_id}
                    classId={session.class_id}
                    sessionId={sessionId || ''}
                    participants={studentParticipants}
                  />
                )}
              </>
            )}
          </div>

          {/* — RESOURCE TAB — */}
          {mode !== 'conversation' && (
            <>
              <button
                onClick={() => setResOpen(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1 rounded-l-lg py-3 px-1 transition-opacity"
                style={{ width: 28, background: '#1a2744', opacity: resOpen ? 0 : 1, pointerEvents: resOpen ? 'none' : 'auto' }}
              >
                <span className="text-[12px]">📚</span>
                <span className="text-white text-[8px] font-bold tracking-widest" style={{ writingMode: 'vertical-lr' }}>RES</span>
              </button>

              <div
                ref={resRef}
                className="absolute top-0 right-0 bottom-0 z-50 flex flex-col transition-transform duration-[250ms] ease-in-out"
                style={{
                  width: 270,
                  background: '#1e2d4a',
                  transform: resOpen ? 'translateX(0)' : 'translateX(100%)',
                }}
              >
                <div className="h-11 flex items-center justify-between px-3 border-b border-white/10">
                  <span className="text-white text-sm font-medium">Resources</span>
                  <button onClick={() => setResOpen(false)} className="text-white/60 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 py-1">
                  {[
                    { icon: <FolderOpen className="h-4 w-4" />, label: 'My Files' },
                    { icon: <Play className="h-4 w-4" />, label: 'YouTube' },
                    { icon: <Volume2 className="h-4 w-4" />, label: 'Audio' },
                    { icon: <Globe className="h-4 w-4" />, label: 'Web Link' },
                  ].map(item => (
                    <button key={item.label} className="w-full h-12 flex items-center gap-3 px-4 text-white/80 hover:bg-[#2d3f5e] transition-colors text-sm">
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/10 px-3 py-3">
                  <span className="text-white/50 text-[10px] font-bold tracking-wider">WHITEBOARD TABS</span>
                  <div className="flex items-center gap-1.5 mt-2">
                    {boards.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveBoard(i)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          activeBoard === i ? 'bg-[#3b82f6] text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                    <button
                      onClick={() => { setBoards(bs => [...bs, `Board ${bs.length + 1}`]); setActiveBoard(boards.length); }}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
