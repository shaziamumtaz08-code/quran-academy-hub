import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseArabicTags } from '@/lib/languageUtils';
import { detectScriptClass } from '@/lib/scriptFont';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTeachingSession } from '@/hooks/useTeachingSession';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Check, Circle, ChevronRight, Sparkles, ArrowRight, Clock, BookOpen,
  Users, CheckCircle2, Loader2, Play, Pause, RotateCcw, X, Send,
  Mic, ListChecks, PenTool, MessageSquare, Hand, Lightbulb, Zap,
  Square, Eye, Save, Download
} from 'lucide-react';
import { PhaseStepperCompact, NextPhaseButton, PhaseBreadcrumb } from '@/components/teaching/PhaseNavBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ─── Types ───
interface Activity {
  phase: string;
  title: string;
  description: string;
  durationMinutes: number;
  activityType: string;
  materials?: string;
}

interface SessionPlan {
  id: string;
  syllabus_id: string;
  week_number: number;
  session_number: number;
  session_day?: string;
  session_title: string;
  session_objective: string;
  total_minutes: number;
  activities: Activity[];
  teacher_notes?: string;
  homework_suggestion?: string;
  status: string;
}

const PHASE_CONFIG: Record<string, { bg: string; iconBg: string; icon: React.ReactNode; color: string }> = {
  Opening:    { bg: 'bg-blue-50', iconBg: 'bg-[#eef2fa]', icon: <Clock className="w-3 h-3 text-[#1a56b0]" />, color: 'text-[#1a56b0]' },
  Input:      { bg: 'bg-green-50', iconBg: 'bg-[#e6f4ea]', icon: <BookOpen className="w-3 h-3 text-[#1a7340]" />, color: 'text-[#1a7340]' },
  Practice:   { bg: 'bg-amber-50', iconBg: 'bg-[#fff8e6]', icon: <Users className="w-3 h-3 text-[#8a5c00]" />, color: 'text-[#8a5c00]' },
  Production: { bg: 'bg-violet-50', iconBg: 'bg-[#f3eefe]', icon: <Mic className="w-3 h-3 text-[#534AB7]" />, color: 'text-[#534AB7]' },
  'Wrap-up':  { bg: 'bg-red-50', iconBg: 'bg-[#fde8e8]', icon: <CheckCircle2 className="w-3 h-3 text-[#b42a2a]" />, color: 'text-[#b42a2a]' },
  Quiz:       { bg: 'bg-red-50', iconBg: 'bg-[#fde8e8]', icon: <ListChecks className="w-3 h-3 text-[#b42a2a]" />, color: 'text-[#b42a2a]' },
};

// ─── Streaming helper ───
async function streamAI(
  url: string, body: Record<string, unknown>,
  onDelta: (t: string) => void, signal?: AbortSignal
): Promise<string> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body), signal,
  });
  if (!resp.ok) throw new Error(await resp.text());
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '', full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const j = line.slice(6).trim();
      if (j === '[DONE]') return full;
      try {
        const p = JSON.parse(j);
        const c = p.choices?.[0]?.delta?.content;
        if (c) { full += c; onDelta(c); }
      } catch {}
    }
  }
  return full;
}

// ─── Mock students for demo ───
const MOCK_STUDENTS = [
  { id: '1', name: 'Sara Ahmed', initials: 'SA', color: 'bg-blue-600' },
  { id: '2', name: 'Maha Khan', initials: 'MK', color: 'bg-green-600' },
  { id: '3', name: 'Zara Farooq', initials: 'ZF', color: 'bg-purple-600' },
  { id: '4', name: 'Rania Aziz', initials: 'RA', color: 'bg-teal-600' },
  { id: '5', name: 'Hana Baig', initials: 'HB', color: 'bg-amber-700' },
  { id: '6', name: 'Nadia Ali', initials: 'NA', color: 'bg-red-600' },
  { id: '7', name: 'Layla Malik', initials: 'LM', color: 'bg-indigo-600' },
  { id: '8', name: 'Sana Iqbal', initials: 'SI', color: 'bg-pink-600' },
  { id: '9', name: 'Fatima Awan', initials: 'FA', color: 'bg-cyan-700' },
  { id: '10', name: 'Ayesha Mir', initials: 'AM', color: 'bg-orange-600' },
];

export default function TeachingOSDayBoard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { language, langClass } = useLanguage();

  const { sessionId, syllabusId: syllabusIdFromUrl } = useTeachingSession();
  const isLiveRoute = location.pathname.includes('/live');

  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [courseName, setCourseName] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [isLive, setIsLive] = useState(isLiveRoute);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, string>>({});
  const [liveStartTime, setLiveStartTime] = useState<Date | null>(null);
  const [boardSaving, setBoardSaving] = useState(false);
  const [editingActivity, setEditingActivity] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Load session plan
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data, error } = await supabase
        .from('session_plans')
        .select('*, syllabi(course_name, subject, level)')
        .eq('id', sessionId)
        .single();
      if (error || !data) { toast.error('Could not load session'); return; }
      const activities = (typeof data.activities === 'string'
        ? JSON.parse(data.activities) : data.activities) as Activity[];
      setPlan({ ...data, activities } as any);
      setCourseName((data as any).syllabi?.course_name || '');
      if (activities.length > 0) {
        setTimerSeconds(activities[0].durationMinutes * 60);
      }
    })();
  }, [sessionId]);

  // Timer tick
  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setTimerRunning(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); setTimerRunning(p => !p); }
      if (e.key === 'ArrowRight') nextActivity();
      if (e.key === 'ArrowLeft' && activeIdx > 0) selectActivity(activeIdx - 1);
      if (e.key === 'Escape') { setAiResponse(''); setAiChatOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { markDone(activeIdx); nextActivity(); }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setAiChatOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIdx, plan]);

  // Initialize student statuses for live mode
  useEffect(() => {
    if (isLive) {
      const statuses: Record<string, string> = {};
      MOCK_STUDENTS.forEach(s => { statuses[s.id] = Math.random() > 0.15 ? 'Active' : 'Away'; });
      setStudentStatuses(statuses);
    }
  }, [isLive]);

  const activities = plan?.activities || [];
  const currentActivity = activities[activeIdx];
  const totalDuration = activities.reduce((s, a) => s + a.durationMinutes, 0);
  const progress = activities.length > 0 ? (completed.size / activities.length) * 100 : 0;

  const selectActivity = (idx: number) => {
    setActiveIdx(idx);
    if (activities[idx]) {
      setTimerSeconds(activities[idx].durationMinutes * 60);
      if (!isLive) setTimerRunning(false);
    }
    setAiResponse('');
    setEditingDesc(false);
  };

  const markDone = (idx: number) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const nextActivity = () => {
    if (activeIdx < activities.length - 1) {
      markDone(activeIdx);
      selectActivity(activeIdx + 1);
      if (isLive) setTimerRunning(true);
    } else {
      markDone(activeIdx);
      if (isLive) setEndModalOpen(true);
    }
  };

  const goLive = async () => {
    if (!plan) return;
    setIsLive(true);
    setLiveStartTime(new Date());
    setTimerRunning(true);
    // Create session log
    const { data } = await supabase.from('session_logs').insert({
      session_plan_id: plan.id,
      activities_total: activities.length,
      status: 'live',
    } as any).select('id').single();
    if (data) setSessionLogId(data.id);
    // Update plan status
    await supabase.from('session_plans').update({ status: 'ready' } as any).eq('id', plan.id);
    toast.success('Session is now live!');
  };

  const endSession = async () => {
    if (sessionLogId) {
      const duration = liveStartTime
        ? Math.round((Date.now() - liveStartTime.getTime()) / 60000) : 0;
      await supabase.from('session_logs').update({
        ended_at: new Date().toISOString(),
        actual_duration: duration,
        activities_done: completed.size,
        session_notes: sessionNotes,
        status: 'delivered',
      } as any).eq('id', sessionLogId);
    }
    if (plan) {
      await supabase.from('session_plans').update({ status: 'delivered' } as any).eq('id', plan.id);
    }
    setIsLive(false);
    setTimerRunning(false);
    setEndModalOpen(false);
    toast.success('Session ended and saved');
  };

  const handleSaveBoard = async () => {
    if (!plan) return;
    setBoardSaving(true);
    const { error } = await supabase.from('session_plans')
      .update({ activities: plan.activities as any, updated_at: new Date().toISOString() } as any)
      .eq('id', plan.id);
    if (error) toast.error(error.message);
    else toast.success('Board saved');
    setBoardSaving(false);
  };

  const handleExportPDF = () => {
    if (!plan) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${plan.session_title || 'Day Board'}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; }
        .activity { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .phase { font-weight: bold; color: #1e3a5f; text-transform: uppercase; font-size: 12px; }
        .title { font-size: 16px; margin: 8px 0; }
        .duration { color: #666; font-size: 12px; }
        .description { margin-top: 8px; font-size: 14px; line-height: 1.6; }
      </style></head><body>
      <h1>${plan.session_title}</h1>
      <p>Week ${plan.week_number} · Session ${plan.session_number} · ${plan.total_minutes} min</p>
      <hr/>
      ${plan.activities.map(a => `
        <div class="activity">
          <div class="phase">${a.phase}</div>
          <div class="title">${a.title}</div>
          <div class="duration">${a.durationMinutes} minutes</div>
          <div class="description">${a.description || ''}</div>
        </div>
      `).join('')}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const updateActivity = (idx: number, field: keyof Activity, value: any) => {
    if (!plan) return;
    const newActs = [...plan.activities];
    newActs[idx] = { ...newActs[idx], [field]: value };
    setPlan({ ...plan, activities: newActs });
  };

  const callAI = async (type: string, userMsg?: string) => {
    if (!currentActivity || !plan) return;
    setAiLoading(true);
    setAiResponse('');
    const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/ai-teaching-assist`;
    try {
      const full = await streamAI(url, {
        assistType: type,
        activityTitle: currentActivity.title,
        activityDesc: currentActivity.description,
        subject: (plan as any).syllabi?.subject || '',
        level: (plan as any).syllabi?.level || '',
        courseName,
        userMessage: userMsg,
        language,
      }, (delta) => setAiResponse(prev => prev + delta));
      // Save to DB
      await supabase.from('ai_assists').insert({
        session_plan_id: plan.id,
        activity_index: activeIdx,
        assist_type: type,
        prompt: userMsg || type,
        response: full,
      } as any);
    } catch (e: any) {
      toast.error('AI request failed');
    } finally {
      setAiLoading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const isWarning = timerSeconds <= 60 && timerSeconds > 0;
  const allDone = completed.size === activities.length && activities.length > 0;
  const onlineCount = Object.values(studentStatuses).filter(s => s === 'Active' || s === 'Question').length;
  const phaseOf = (a: Activity) => PHASE_CONFIG[a.phase] || PHASE_CONFIG.Opening;

  if (!sessionId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <BookOpen className="w-10 h-10 text-[#d0d4dc] mx-auto mb-3" />
            <p className="text-[14px] text-[#7a7f8a]">No session selected</p>
            <button
              onClick={() => navigate(syllabusIdFromUrl ? `/teaching-os/planner?syllabus_id=${syllabusIdFromUrl}` : '/teaching-os')}
              className="mt-3 text-[12px] text-[#1a56b0] hover:underline"
            >
              Go to Teaching OS →
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-[#1a56b0]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        {/* Live banner */}
        {isLive && (
          <div className="bg-[#fde8e8] border-b border-[#f09595] px-4 py-1.5 flex items-center gap-2 text-[11px] text-[#b42a2a] shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#b42a2a] animate-pulse" />
            Session live · Started {liveStartTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {onlineCount} students online
          </div>
        )}

        {/* Top bar */}
        <div className="h-[50px] bg-white border-b border-[#e8e9eb] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {searchParams.get('course_id') && (
              <button
                onClick={() => navigate(`/courses/${searchParams.get('course_id')}`)}
                className="text-[11px] text-[#1a56b0] hover:underline mr-2"
              >
                ← Back to Course
              </button>
            )}
            <PhaseBreadcrumb courseName={courseName} sectionLabel={`Session ${plan.session_number} · Day Board`} />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#4a5264] bg-white border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]">
              <Eye className="w-3.5 h-3.5" /> Student view
            </button>
            <div className="relative">
              <button
                onClick={() => setNotifyOpen(!notifyOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#4a5264] bg-white border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Notify class
              </button>
              {notifyOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-[#e8e9eb] rounded-lg shadow-lg p-3 z-50">
                  <Textarea
                    value={notifyMsg}
                    onChange={e => setNotifyMsg(e.target.value)}
                    placeholder="Message to students…"
                    rows={2}
                    className="text-[12px] mb-2"
                  />
                  <Button
                    size="sm"
                    onClick={() => { toast.success('Notification sent'); setNotifyOpen(false); setNotifyMsg(''); }}
                    className="w-full bg-[#0f2044] hover:bg-[#1a2d54] text-[11px]"
                  >
                    <Send className="w-3 h-3 mr-1" /> Send
                  </Button>
                </div>
              )}
            </div>
            {!isLive ? (
              <button
                onClick={goLive}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white bg-[#0f2044] rounded-md hover:bg-[#1a2d54]"
              >
                <Play className="w-3.5 h-3.5" /> Go live
              </button>
            ) : (
              <button
                onClick={() => setEndModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white bg-[#b42a2a] rounded-md animate-[livepulse_2s_ease-in-out_infinite]"
                style={{ animation: 'livepulse 2s ease-in-out infinite' }}
              >
                <span className="w-2 h-2 rounded-full bg-white" /> Live
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Activity Sidebar */}
          <div className="w-[256px] bg-white border-r border-[#e8e9eb] flex flex-col shrink-0">
            <div className="px-4 pt-3.5 pb-2.5 border-b border-[#e8e9eb]">
              <div className="text-[13px] font-medium text-[#0f2044]">Session {plan.session_number} — {plan.session_day || ''}</div>
              <div className="text-[11px] text-[#7a7f8a]">{plan.session_title} · {plan.total_minutes} min</div>
              {/* Mini stepper */}
              <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                {['Syllabus', 'Planner', 'Board', 'Kit'].map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && <div className="w-2 h-px bg-[#d0d4dc]" />}
                    <span className={`flex items-center gap-0.5 ${i < 2 ? 'text-green-600' : i === 2 ? 'text-[#0f2044] font-medium' : 'text-[#aab0bc]'}`}>
                      {i < 2 ? <Check className="w-2.5 h-2.5" /> : i === 2 ? <div className="w-2 h-2 rounded-full bg-[#0f2044]" /> : <Circle className="w-2 h-2" />}
                      {s}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="px-3.5 pt-2 pb-1">
              <span className="text-[10px] uppercase text-[#aab0bc] tracking-wider font-medium">Activities · {activities.length} total</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activities.map((act, idx) => {
                const pc = phaseOf(act);
                const isActive = idx === activeIdx;
                const isDone = completed.has(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => selectActivity(idx)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-l-[3px] ${isActive ? 'bg-[#eef2fa] border-l-[#1a56b0]' : 'border-l-transparent hover:bg-[#f9f9fb]'} ${isDone ? 'opacity-55' : ''}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); markDone(idx); }}
                      className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-[#1a7340] border-[#1a7340]' : 'border-[#d0d4dc]'}`}
                    >
                      {isDone && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <div className={`w-[26px] h-[26px] rounded-[7px] flex items-center justify-center shrink-0 ${pc.iconBg}`}>
                      {pc.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[#0f2044] truncate">{act.title}</div>
                      <div className="text-[10px] text-[#7a7f8a]">{act.phase}</div>
                    </div>
                    <span className="text-[10px] text-[#aab0bc] shrink-0">{act.durationMinutes}m</span>
                  </button>
                );
              })}
            </div>

            <div className="px-3.5 py-2.5 border-t border-[#e8e9eb]">
              <div className="flex justify-between text-[10px] text-[#7a7f8a] mb-1">
                <span>Session progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1 bg-[#e8e9eb] rounded-full overflow-hidden">
                <div className="h-full bg-[#1a56b0] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3">
                <NextPhaseButton currentPhase={3} syllabusId={plan?.syllabus_id || syllabusIdFromUrl} sessionId={plan?.id || sessionId} />
              </div>
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Center panel */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {/* Timer Card */}
              <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-medium uppercase text-[#7a7f8a] tracking-wider">Activity timer</span>
                  {currentActivity && (
                    <span className="text-[10px] font-medium bg-[#eef2fa] text-[#1a56b0] rounded-full px-2 py-0.5">
                      {currentActivity.phase} — {currentActivity.durationMinutes} min
                    </span>
                  )}
                </div>
                <div className={`text-[36px] font-medium tabular-nums tracking-tight ${isWarning ? 'text-[#b42a2a]' : 'text-[#0f2044]'}`}>
                  {formatTime(timerSeconds)}
                </div>
                {currentActivity && (
                  <div className="h-1 bg-[#e8e9eb] rounded-full overflow-hidden my-2">
                    <div
                      className={`h-full rounded-full transition-[width] duration-1000 linear ${isWarning ? 'bg-[#b42a2a]' : 'bg-[#1a56b0]'}`}
                      style={{ width: `${(timerSeconds / (currentActivity.durationMinutes * 60)) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => currentActivity && setTimerSeconds(currentActivity.durationMinutes * 60)}
                    className="px-3 py-1.5 text-[11px] text-[#4a5264] border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setTimerRunning(p => !p)}
                    className="px-3 py-1.5 text-[11px] text-[#4a5264] border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
                  >
                    {timerRunning ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={nextActivity}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white bg-[#0f2044] rounded-md hover:bg-[#1a2d54]"
                  >
                    {allDone ? 'End session' : 'Next activity'} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Active Activity Card */}
              {currentActivity && (
                <div className="bg-white border-[1.5px] border-[#1a56b0] rounded-[10px] overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-[#e8e9eb] flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${phaseOf(currentActivity).bg} ${phaseOf(currentActivity).color}`}>
                      {currentActivity.phase} · {currentActivity.durationMinutes} min
                    </span>
                    <span className="text-[13px] font-medium text-[#0f2044] flex-1">{currentActivity.title}</span>
                    <span className="text-[11px] text-[#aab0bc]">Activity {activeIdx + 1} of {activities.length}</span>
                  </div>

                  <div className="px-3.5 py-3">
                    {editingDesc ? (
                      <div>
                        <textarea
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          rows={4}
                          className="w-full text-[12.5px] border border-[#1a56b0] rounded-[5px] p-2 outline-none shadow-[0_0_0_3px_rgba(26,86,176,0.08)] leading-relaxed"
                        />
                        <div className="flex gap-1.5 mt-1.5">
                          <button onClick={() => {
                            const newActs = [...activities];
                            newActs[activeIdx] = { ...newActs[activeIdx], description: editDraft };
                            setPlan({ ...plan, activities: newActs });
                            supabase.from('session_plans').update({ activities: newActs as any } as any).eq('id', plan.id);
                            setEditingDesc(false);
                          }} className="text-[10px] text-white bg-[#0f2044] px-2.5 py-1 rounded">Save</button>
                          <button onClick={() => setEditingDesc(false)} className="text-[10px] text-[#7a7f8a] border border-[#d0d4dc] px-2.5 py-1 rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditDraft(currentActivity.description); setEditingDesc(true); }}
                        className={`text-[12.5px] text-[#0f2044] leading-relaxed cursor-text hover:bg-[#f9f9fb] rounded p-1 -m-1 mb-2 ${langClass}`}
                        dangerouslySetInnerHTML={{ __html: parseArabicTags(currentActivity.description) }}
                      />
                    )}

                    {currentActivity.materials && (
                      <div className="text-[10px] text-[#aab0bc] mt-1 mb-2">📎 {currentActivity.materials}</div>
                    )}

                    {/* Teacher note */}
                    {plan.teacher_notes && activeIdx === 0 && (
                      <div className="bg-[#f9f9fb] border-l-[3px] border-[#d0d4dc] rounded-r-[7px] p-2.5 mb-3">
                        <div className="text-[11px] text-[#7a7f8a] leading-snug">{plan.teacher_notes}</div>
                      </div>
                    )}

                    {/* AI Tools */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {[
                        { label: 'Suggest drill', icon: <Zap className="w-3 h-3" />, type: 'drill' },
                        { label: 'Explain differently', icon: <Lightbulb className="w-3 h-3" />, type: 'rephrase' },
                        { label: 'Comprehension check', icon: <ListChecks className="w-3 h-3" />, type: 'comprehension' },
                      ].map(tool => (
                        <button
                          key={tool.type}
                          onClick={() => callAI(tool.type)}
                          disabled={aiLoading}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#4a5264] border border-[#e8e9eb] rounded-md hover:bg-[#f9f9fb] disabled:opacity-50"
                        >
                          {tool.icon} AI: {tool.label}
                        </button>
                      ))}
                    </div>

                    {/* AI Response */}
                    {(aiResponse || aiLoading) && (
                      <div className="mt-3 bg-[#f0f4ff] border border-[#b5d0f8] rounded-lg p-3 relative">
                        {!aiLoading && (
                          <button onClick={() => setAiResponse('')} className="absolute top-2 right-2 text-[#aab0bc] hover:text-[#4a5264]">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {aiLoading && !aiResponse && (
                          <div className="flex items-center gap-2 text-[11px] text-[#1a56b0]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                          </div>
                        )}
                        <div className={`text-[12px] text-[#0f2044] leading-relaxed whitespace-pre-wrap ${langClass}`} dangerouslySetInnerHTML={{ __html: parseArabicTags(aiResponse) }} />
                      </div>
                    )}
                  </div>

                  <div className="px-3.5 py-2 border-t border-[#e8e9eb] bg-[#fafbfc] flex items-center justify-between">
                    <button
                      onClick={() => { markDone(activeIdx); }}
                      className="flex items-center gap-1 text-[11px] text-[#1a7340] hover:underline"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> {completed.has(activeIdx) ? 'Undo' : 'Mark done'}
                    </button>
                    {activeIdx < activities.length - 1 && (
                      <button
                        onClick={nextActivity}
                        className="flex items-center gap-1 text-[11px] text-[#1a56b0] bg-[#eef2fa] border border-[#b5d0f8] rounded px-2 py-0.5 hover:bg-[#dde8f7]"
                      >
                        Next: {activities[activeIdx + 1]?.title} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* AI Teaching Assistant Bar */}
              <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[9px] p-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#1a56b0] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-medium text-[#0f2044]">AI teaching assistant</div>
                  <div className="text-[11px] text-[#7a7f8a]">Ask for a quick activity, alternative explanation, or comprehension check</div>
                </div>
                {!aiChatOpen ? (
                  <button
                    onClick={() => setAiChatOpen(true)}
                    className="text-[11.5px] text-[#1a56b0] border border-[#b5d0f8] rounded-md bg-white px-3 py-1 hover:bg-[#eef2fa] shrink-0"
                  >
                    Ask AI ↗
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      value={aiChatInput}
                      onChange={e => setAiChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && aiChatInput.trim()) {
                          callAI('assistant', aiChatInput);
                          setAiChatInput('');
                          setAiChatOpen(false);
                        }
                      }}
                      placeholder="Ask anything…"
                      className="w-48 text-[11px] border border-[#d0d4dc] rounded px-2 py-1 outline-none focus:border-[#1a56b0]"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (aiChatInput.trim()) { callAI('assistant', aiChatInput); setAiChatInput(''); setAiChatOpen(false); }
                      }}
                      className="p-1 bg-[#0f2044] rounded text-white"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel — Students */}
            <div className="w-[220px] bg-white border-l border-[#e8e9eb] flex flex-col shrink-0">
              <div className="px-3.5 py-3 border-b border-[#e8e9eb] flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#0f2044]">Students</span>
                <span className="text-[11px] bg-[#eef2fa] text-[#1a56b0] rounded-full px-2 py-0.5">
                  {isLive ? `${onlineCount} online` : `${MOCK_STUDENTS.length} enrolled`}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {MOCK_STUDENTS
                  .sort((a, b) => {
                    const sa = studentStatuses[a.id] || 'Active';
                    const sb = studentStatuses[b.id] || 'Active';
                    if (sa === 'Question' && sb !== 'Question') return -1;
                    if (sb === 'Question' && sa !== 'Question') return 1;
                    return 0;
                  })
                  .map(student => {
                    const status = isLive ? (studentStatuses[student.id] || 'Active') : '';
                    const statusColors: Record<string, string> = {
                      Active: 'bg-[#e6f4ea] text-[#1a7340]',
                      Away: 'bg-[#f4f5f7] text-[#aab0bc]',
                      Question: 'bg-[#fff8e6] text-[#8a5c00]',
                    };
                    return (
                      <div key={student.id} className="flex items-center gap-2 px-3.5 py-2 hover:bg-[#f9f9fb]">
                        <div className={`w-[26px] h-[26px] rounded-full ${student.color} flex items-center justify-center text-[10px] font-medium text-white shrink-0`}>
                          {student.initials}
                        </div>
                        <span className="text-[12px] text-[#0f2044] flex-1 truncate">{student.name}</span>
                        {isLive && status && (
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${statusColors[status] || ''}`}>
                            {status === 'Question' && '✋ '}{status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                {!isLive && (
                  <p className="text-[11px] text-[#aab0bc] italic text-center px-4 mt-4">
                    Students will appear as online during live class
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pulse animation style */}
        <style>{`
          @keyframes livepulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
        `}</style>

        {/* End Session Modal */}
        <Dialog open={endModalOpen} onOpenChange={setEndModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Session complete</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#f4f5f7] rounded-lg p-2">
                  <div className="text-[18px] font-medium text-[#0f2044]">
                    {liveStartTime ? Math.round((Date.now() - liveStartTime.getTime()) / 60000) : 0}
                  </div>
                  <div className="text-[10px] text-[#7a7f8a]">min actual</div>
                </div>
                <div className="bg-[#f4f5f7] rounded-lg p-2">
                  <div className="text-[18px] font-medium text-[#0f2044]">{completed.size}/{activities.length}</div>
                  <div className="text-[10px] text-[#7a7f8a]">activities</div>
                </div>
                <div className="bg-[#f4f5f7] rounded-lg p-2">
                  <div className="text-[18px] font-medium text-[#0f2044]">{onlineCount}</div>
                  <div className="text-[10px] text-[#7a7f8a]">students</div>
                </div>
              </div>
              <Textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="Session notes (optional)…"
                rows={3}
                className="text-[12px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEndModalOpen(false)}>Cancel</Button>
              <Button onClick={endSession} className="bg-[#0f2044] hover:bg-[#1a2d54]">Save & close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
