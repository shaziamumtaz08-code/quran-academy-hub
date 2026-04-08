import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Check, Circle, ChevronRight, Sparkles, ArrowRight, Calendar as CalendarIcon,
  RotateCcw, Loader2, Plus, Clock, BookOpen, Users, CheckCircle2, Play,
  GripVertical, Pencil, Trash2, X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── Types ───
interface SyllabusRow {
  week: number;
  topic: string;
  objectives: string;
  contentTypes: string[];
}

interface Activity {
  phase: string;
  title: string;
  description: string;
  durationMinutes: number;
  activityType: string;
  materials?: string;
}

interface SessionPlan {
  id?: string;
  syllabus_id: string;
  week_number: number;
  session_number: number;
  session_date?: string;
  session_day?: string;
  session_title: string;
  session_objective: string;
  total_minutes: number;
  activities: Activity[];
  teacher_notes?: string;
  homework_suggestion?: string;
  status: string;
}

interface Syllabus {
  id: string;
  course_name: string;
  subject: string;
  level: string;
  duration_weeks: number;
  sessions_week: number;
  rows: SyllabusRow[];
}

const PHASE_STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
  Opening: { bg: 'bg-blue-100', icon: <Clock className="w-3 h-3 text-blue-600" /> },
  Input: { bg: 'bg-blue-100', icon: <BookOpen className="w-3 h-3 text-blue-600" /> },
  Practice: { bg: 'bg-green-100', icon: <Users className="w-3 h-3 text-green-600" /> },
  Production: { bg: 'bg-green-100', icon: <Users className="w-3 h-3 text-green-600" /> },
  'Wrap-up': { bg: 'bg-red-100', icon: <CheckCircle2 className="w-3 h-3 text-red-600" /> },
};

const ACTIVITY_TAG_COLORS: Record<string, string> = {
  'teacher-led': 'bg-blue-50 text-blue-700 border-blue-200',
  'pair-work': 'bg-purple-50 text-purple-700 border-purple-200',
  'group': 'bg-teal-50 text-teal-700 border-teal-200',
  'individual': 'bg-amber-50 text-amber-700 border-amber-200',
  'quiz': 'bg-red-50 text-red-700 border-red-200',
  'discussion': 'bg-green-50 text-green-700 border-green-200',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Streaming helper ───
async function streamResponse(
  url: string,
  body: Record<string, unknown>,
  onDelta: (text: string) => void,
  signal?: AbortSignal
) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err);
  }
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ') || line.trim() === '') continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') return fullText;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) { fullText += content; onDelta(content); }
      } catch { /* partial */ }
    }
  }
  return fullText;
}

function parseJsonFromStream(text: string): any {
  // Find first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// ─── Main Component ───
export default function TeachingOSPlanner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const syllabusId = searchParams.get('syllabus_id');

  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [sessionPlans, setSessionPlans] = useState<SessionPlan[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingWeekSession, setGeneratingWeekSession] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [planAllConfirm, setPlanAllConfirm] = useState(false);
  const [planAllProgress, setPlanAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingActivity, setEditingActivity] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load syllabus
  useEffect(() => {
    if (!syllabusId) return;
    (async () => {
      const { data, error } = await supabase
        .from('syllabi')
        .select('*')
        .eq('id', syllabusId)
        .single();
      if (error || !data) { toast.error('Could not load syllabus'); return; }
      const rows = (typeof data.rows === 'string' ? JSON.parse(data.rows) : data.rows) as SyllabusRow[];
      setSyllabus({
        id: data.id,
        course_name: data.course_name,
        subject: data.subject || '',
        level: data.level || '',
        duration_weeks: data.duration_weeks || rows.length,
        sessions_week: data.sessions_week || 2,
        rows,
      });
    })();
  }, [syllabusId]);

  // Load existing session plans
  useEffect(() => {
    if (!syllabusId) return;
    (async () => {
      const { data } = await supabase
        .from('session_plans')
        .select('*')
        .eq('syllabus_id', syllabusId)
        .order('week_number')
        .order('session_number');
      if (data) {
        setSessionPlans(data.map(d => ({
          ...d,
          activities: (typeof d.activities === 'string' ? JSON.parse(d.activities) : d.activities) as Activity[],
        })));
      }
    })();
  }, [syllabusId]);

  // Auto-save debounced
  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      for (const plan of sessionPlans) {
        if (plan.id) {
          await supabase.from('session_plans').update({
            session_title: plan.session_title,
            session_objective: plan.session_objective,
            activities: plan.activities as any,
            teacher_notes: plan.teacher_notes,
            homework_suggestion: plan.homework_suggestion,
            total_minutes: plan.total_minutes,
            status: plan.status,
          }).eq('id', plan.id);
        }
      }
      setSaving(false);
      setSavedAt('just now');
    }, 800);
  }, [sessionPlans]);

  const weekRows = syllabus?.rows || [];
  const currentWeekRow = weekRows.find(r => r.week === selectedWeek);
  const weekSessions = sessionPlans.filter(p => p.week_number === selectedWeek);
  const selectedPlan = selectedSession !== null
    ? weekSessions.find(p => p.session_number === selectedSession) : null;

  const getWeekStatus = (weekNum: number) => {
    const sessions = sessionPlans.filter(p => p.week_number === weekNum);
    const sessPerWeek = syllabus?.sessions_week || 2;
    if (sessions.length === 0) return 'not_started';
    if (sessions.length >= sessPerWeek && sessions.every(s => s.activities.length > 0)) return 'complete';
    return 'in_progress';
  };

  const generateSessionPlan = useCallback(async (weekNum: number, sessNum: number) => {
    if (!syllabus || !syllabusId) return;
    const weekRow = weekRows.find(r => r.week === weekNum);
    if (!weekRow) return;

    const key = `${weekNum}-${sessNum}`;
    setGeneratingWeekSession(key);
    setStreamText('');
    setSelectedWeek(weekNum);
    setSelectedSession(sessNum);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const prevSession = sessionPlans.find(p => p.week_number === weekNum && p.session_number === sessNum - 1);
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/generate-session-plan`;

      const fullText = await streamResponse(url, {
        courseName: syllabus.course_name,
        subject: syllabus.subject,
        level: syllabus.level,
        weekNumber: weekNum,
        weekTopic: weekRow.topic,
        weekObjectives: weekRow.objectives,
        sessionNumber: sessNum,
        sessionDay: DAYS[(sessNum - 1) % 7],
        previousSessionSummary: prevSession?.session_title || '',
        sessionsPerWeek: syllabus.sessions_week,
        sessionDurationMinutes: 45,
      }, (delta) => setStreamText(prev => prev + delta), controller.signal);

      const parsed = parseJsonFromStream(fullText);
      if (!parsed) { toast.error('Failed to parse AI response'); setGeneratingWeekSession(null); return; }

      const newPlan: SessionPlan = {
        syllabus_id: syllabusId,
        week_number: weekNum,
        session_number: sessNum,
        session_day: DAYS[(sessNum - 1) % 7],
        session_title: parsed.sessionTitle || `Session ${sessNum}`,
        session_objective: parsed.sessionObjective || '',
        total_minutes: parsed.totalMinutes || 45,
        activities: parsed.activities || [],
        teacher_notes: parsed.teacherNotes || '',
        homework_suggestion: parsed.homeworkSuggestion || '',
        status: 'draft',
      };

      // Upsert to DB
      const { data: saved, error } = await supabase
        .from('session_plans')
        .upsert({
          ...newPlan,
          activities: newPlan.activities as any,
        }, { onConflict: 'syllabus_id,week_number,session_number' })
        .select()
        .single();

      if (error) { console.error(error); toast.error('Failed to save plan'); }

      setSessionPlans(prev => {
        const filtered = prev.filter(p => !(p.week_number === weekNum && p.session_number === sessNum));
        return [...filtered, { ...newPlan, id: saved?.id }].sort((a, b) =>
          a.week_number - b.week_number || a.session_number - b.session_number
        );
      });

      toast.success(`Session ${sessNum} of Week ${weekNum} planned`);
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error('Generation failed');
    } finally {
      setGeneratingWeekSession(null);
      setStreamText('');
    }
  }, [syllabus, syllabusId, weekRows, sessionPlans]);

  const planAllWeeks = useCallback(async () => {
    if (!syllabus) return;
    setPlanAllConfirm(false);
    const sessPerWeek = syllabus.sessions_week;
    const unplannedWeeks = weekRows.filter(r => {
      const sessions = sessionPlans.filter(p => p.week_number === r.week);
      return sessions.length < sessPerWeek || sessions.some(s => s.activities.length === 0);
    });

    setPlanAllProgress({ current: 0, total: unplannedWeeks.length });

    for (let i = 0; i < unplannedWeeks.length; i++) {
      if (!planAllProgress) break; // stopped
      setPlanAllProgress({ current: i + 1, total: unplannedWeeks.length });
      const week = unplannedWeeks[i];
      for (let s = 1; s <= sessPerWeek; s++) {
        const existing = sessionPlans.find(p => p.week_number === week.week && p.session_number === s);
        if (!existing || existing.activities.length === 0) {
          await generateSessionPlan(week.week, s);
        }
      }
    }

    setPlanAllProgress(null);
    toast.success(`All ${unplannedWeeks.length} weeks planned!`);
  }, [syllabus, weekRows, sessionPlans, generateSessionPlan]);

  const updateActivity = (actIdx: number, field: string, value: string) => {
    if (!selectedPlan) return;
    setSessionPlans(prev => prev.map(p => {
      if (p.id !== selectedPlan.id) return p;
      const acts = [...p.activities];
      acts[actIdx] = { ...acts[actIdx], [field]: value };
      return { ...p, activities: acts };
    }));
    triggerSave();
  };

  if (!syllabusId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <BookOpen className="w-10 h-10 text-[#d0d4dc] mx-auto mb-3" />
            <p className="text-[14px] text-[#7a7f8a]">No syllabus selected</p>
            <button onClick={() => navigate('/teaching-os')} className="mt-3 text-[12px] text-[#1a56b0] hover:underline">
              Go to Syllabus Builder →
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!syllabus) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-[#1a56b0]" />
        </div>
      </DashboardLayout>
    );
  }

  const sessPerWeek = syllabus.sessions_week;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
        {/* ─── TOP BAR (Zone C) ─── */}
        <div className="h-[48px] bg-white border-b border-[#e8e9eb] px-4 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#7a7f8a]">
            Teaching OS <ChevronRight className="inline w-3 h-3 mx-1" />
            <span className="text-[#4a5264]">{syllabus.course_name}</span>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <span className="text-[#4a5264] font-medium">Planner</span>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3">
            {[
              { label: 'Syllabus', done: true, path: `/teaching-os` },
              { label: 'Planner', active: true },
              { label: 'Day board', future: true },
              { label: 'Content kit', future: true },
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                {i > 0 && <div className="w-4 h-px bg-[#d0d4dc]" />}
                <button
                  onClick={() => step.done && step.path ? navigate(step.path) : null}
                  className={`flex items-center gap-1.5 text-[11px] ${step.active ? 'text-[#0f2044] font-medium' : step.done ? 'text-green-600 cursor-pointer' : 'text-[#aab0bc]'}`}
                >
                  {step.done ? <Check className="w-3.5 h-3.5 text-green-600" /> :
                    step.active ? <div className="w-3 h-3 rounded-full bg-[#0f2044]" /> :
                      <Circle className="w-3 h-3 text-[#d0d4dc]" />}
                  {step.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#4a5264] bg-white border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Calendar
            </button>
            <button
              onClick={() => setPlanAllConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#4a5264] bg-white border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
            >
              <Sparkles className="w-3.5 h-3.5" /> Plan all weeks
            </button>
            <button
              onClick={() => navigate(`/teaching-os/dayboard?syllabus_id=${syllabusId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white bg-[#0f2044] rounded-md hover:bg-[#1a2d54]"
            >
              Next: Day board <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Plan all progress bar */}
        {planAllProgress && (
          <div className="bg-[#f0f4ff] border-b border-[#b5d0f8] px-4 py-2 flex items-center gap-3 text-[11px] shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1a56b0]" />
            <span className="text-[#1a56b0]">Planning week {planAllProgress.current} of {planAllProgress.total}…</span>
            <div className="flex-1 h-1.5 bg-[#e8e9eb] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a56b0] rounded-full transition-all"
                style={{ width: `${(planAllProgress.current / planAllProgress.total) * 100}%` }}
              />
            </div>
            <button onClick={() => setPlanAllProgress(null)} className="text-[#b42a2a] border border-[#f09595] rounded px-2 py-0.5 hover:bg-red-50">
              Stop
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* ─── ZONE A — Week Sidebar ─── */}
          <div className="w-[248px] bg-white border-r border-[#e8e9eb] flex flex-col shrink-0">
            <div className="px-4 pt-3.5 pb-2.5 border-b border-[#e8e9eb]">
              <div className="text-[13px] font-medium text-[#0f2044] truncate">{syllabus.course_name}</div>
              <div className="text-[11px] text-[#7a7f8a]">{weekRows.length} weeks · {weekRows.length * sessPerWeek} sessions</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {weekRows.map(row => {
                const status = getWeekStatus(row.week);
                const sessions = sessionPlans.filter(p => p.week_number === row.week);
                const progress = sessions.length / sessPerWeek;
                const isActive = row.week === selectedWeek;

                return (
                  <button
                    key={row.week}
                    onClick={() => { setSelectedWeek(row.week); setSelectedSession(null); }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#f0f1f3] text-left transition-colors ${isActive ? 'bg-[#eef2fa]' : 'hover:bg-[#f9f9fb]'}`}
                  >
                    <div className={`w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[10px] font-medium shrink-0 ${isActive ? 'bg-[#0f2044] text-white' : 'bg-[#f4f5f7] text-[#4a5264]'}`}>
                      W{row.week}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-medium text-[#0f2044] truncate leading-tight">{row.topic}</div>
                      <div className="text-[10px] text-[#7a7f8a] mt-0.5">{sessPerWeek} sessions</div>
                      <div className="h-[2px] bg-[#e8e9eb] rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-[#1a56b0] rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
                      </div>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${status === 'complete' ? 'bg-[#1a7340]' : status === 'in_progress' ? 'bg-[#1a56b0]' : 'bg-[#e8e9eb] border border-[#d0d4dc]'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── ZONE B — Main Content ─── */}
          <div className="flex-1 bg-[#f4f5f7] overflow-y-auto p-3.5">
            {/* Week Banner */}
            {currentWeekRow && (
              <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-3 mb-3 flex items-start justify-between">
                <div>
                  <div className="text-[13.5px] font-medium text-[#0f2044]">
                    Week {currentWeekRow.week} — {currentWeekRow.topic}
                  </div>
                  <div className="text-[11px] text-[#7a7f8a] mt-0.5">
                    {sessPerWeek} sessions · {syllabus.level}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {(() => {
                      const s = getWeekStatus(currentWeekRow.week);
                      return (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s === 'complete' ? 'bg-green-50 text-green-700' : s === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                          {s === 'complete' ? 'Complete' : s === 'in_progress' ? 'In progress' : 'Not started'}
                        </span>
                      );
                    })()}
                    {weekSessions.map(s => (
                      <span key={s.session_number} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f4f5f7] text-[#7a7f8a]">
                        Session {s.session_number} {s.activities.length > 0 ? 'done' : 'pending'}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => generateSessionPlan(currentWeekRow.week, 1)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-[#4a5264] border border-[#d0d4dc] rounded-md hover:bg-[#f9f9fb]"
                >
                  <RotateCcw className="w-3 h-3" /> Regenerate
                </button>
              </div>
            )}

            {/* Sessions Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {Array.from({ length: sessPerWeek }, (_, i) => i + 1).map(sessNum => {
                const plan = weekSessions.find(p => p.session_number === sessNum);
                const isGenerating = generatingWeekSession === `${selectedWeek}-${sessNum}`;
                const isSelected = selectedSession === sessNum;

                if (!plan || plan.activities.length === 0) {
                  return (
                    <div
                      key={sessNum}
                      className={`bg-white border ${isSelected ? 'border-[1.5px] border-[#1a56b0]' : 'border-dashed border-[#c8d4e8]'} rounded-[10px] p-4 text-center cursor-pointer hover:border-[#b0bcd4]`}
                      onClick={() => setSelectedSession(sessNum)}
                    >
                      {isGenerating ? (
                        <div className="py-3">
                          <Loader2 className="w-5 h-5 animate-spin text-[#1a56b0] mx-auto mb-2" />
                          <p className="text-[11px] text-[#1a56b0]">Generating…</p>
                        </div>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-[#aab0bc] mx-auto mb-2" />
                          <p className="text-[11px] text-[#7a7f8a] mb-2">Session {sessNum} — Not yet planned</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); generateSessionPlan(selectedWeek, sessNum); }}
                            className="w-full py-1.5 text-[11px] text-white bg-[#0f2044] rounded-md hover:bg-[#1a2d54]"
                          >
                            Generate with AI
                          </button>
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={sessNum}
                    onClick={() => setSelectedSession(sessNum)}
                    className={`bg-white border ${isSelected ? 'border-[1.5px] border-[#1a56b0]' : 'border-[#e8e9eb]'} rounded-[10px] cursor-pointer hover:border-[#b0bcd4] transition-colors`}
                  >
                    <div className="px-3 py-2 border-b border-[#f0f1f3] flex justify-between items-center">
                      <span className="text-[10px] font-medium text-[#7a7f8a] uppercase">Session {sessNum} — {plan.session_day || DAYS[(sessNum - 1) % 7]}</span>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[12px] font-medium text-[#0f2044] leading-tight line-clamp-2">{plan.session_title}</div>
                      <div className="text-[11px] text-[#7a7f8a] mt-1 line-clamp-2 leading-snug">{plan.session_objective}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {[...new Set(plan.activities.map(a => a.activityType))].map(type => (
                          <span key={type} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${ACTIVITY_TAG_COLORS[type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 border-t border-[#f0f1f3] bg-[#fafbfc] rounded-b-[10px] flex justify-between items-center">
                      <span className="text-[10px] text-[#aab0bc]">{plan.total_minutes} min</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/teaching-os/dayboard?session_id=${plan.id}`); }}
                        className="text-[10px] text-[#1a56b0] bg-[#eef2fa] border border-[#b5d0f8] rounded px-2 py-0.5 hover:bg-[#dde8f7]"
                      >
                        Open day board
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day Board (inline) */}
            {selectedPlan && selectedPlan.activities.length > 0 && (
              <div className="bg-white border-[1.5px] border-[#1a56b0] rounded-[10px] overflow-hidden">
                <div className="bg-[#eef2fa] border-b border-[#b5d0f8] px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-[#0f2044]">
                      Day board — Session {selectedPlan.session_number}, {selectedPlan.session_day || ''}
                    </div>
                    <div className="text-[11px] text-[#1a56b0]">
                      {selectedPlan.session_title} · {selectedPlan.total_minutes} min · {syllabus.course_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {saving && <span className="text-[10px] text-[#aab0bc]">Saving…</span>}
                    {!saving && savedAt && <span className="text-[10px] text-[#aab0bc]">Saved {savedAt}</span>}
                    <button
                      onClick={() => generateSessionPlan(selectedPlan.week_number, selectedPlan.session_number)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#4a5264] border border-[#d0d4dc] rounded-md hover:bg-white"
                    >
                      <RotateCcw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                </div>

                <div className="px-3.5 py-3">
                  {/* Group by phase */}
                  {['Opening', 'Input', 'Practice', 'Production', 'Wrap-up'].map(phase => {
                    const phaseActivities = selectedPlan.activities
                      .map((a, i) => ({ ...a, _idx: i }))
                      .filter(a => a.phase === phase);
                    if (phaseActivities.length === 0) return null;
                    const style = PHASE_STYLES[phase] || PHASE_STYLES.Opening;

                    return (
                      <div key={phase} className="mb-3">
                        <div className="text-[10px] uppercase text-[#aab0bc] tracking-wider font-medium mb-1.5">{phase}</div>
                        {phaseActivities.map(act => (
                          <div
                            key={act._idx}
                            className="flex items-start gap-2 py-1.5 px-1 border-b border-[#f0f1f3] group hover:bg-[#fafbfc] rounded"
                          >
                            <div className={`w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                              {style.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingActivity === act._idx ? (
                                <div>
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    rows={2}
                                    className="w-full text-[11.5px] border border-[#1a56b0] rounded-[5px] p-1.5 outline-none shadow-[0_0_0_3px_rgba(26,86,176,0.08)]"
                                  />
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      onClick={() => { updateActivity(act._idx, 'description', editDraft); setEditingActivity(null); }}
                                      className="text-[10px] text-white bg-[#0f2044] px-2 py-0.5 rounded"
                                    >Save</button>
                                    <button
                                      onClick={() => setEditingActivity(null)}
                                      className="text-[10px] text-[#7a7f8a] border border-[#d0d4dc] px-2 py-0.5 rounded"
                                    >Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => { setEditingActivity(act._idx); setEditDraft(act.description); }}
                                  className="text-[11.5px] text-[#0f2044] leading-snug cursor-text hover:bg-[#f4f5f7] rounded p-0.5"
                                >
                                  <span className="font-medium">{act.title}</span>
                                  {act.description && <span className="text-[#7a7f8a]"> — {act.description}</span>}
                                  {act.materials && <span className="text-[#aab0bc] text-[10px] block mt-0.5">📎 {act.materials}</span>}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-[#aab0bc] whitespace-nowrap shrink-0 mt-0.5">{act.durationMinutes} min</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {/* Add activity */}
                  <button className="w-full mt-1 flex items-center gap-2 text-[11px] text-[#aab0bc] border border-dashed border-[#c8d4e8] rounded-md px-3 py-2 hover:bg-[#f0f4ff] hover:border-[#b5d0f8] hover:text-[#1a56b0] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add activity
                  </button>

                  {/* Teacher notes & homework */}
                  {selectedPlan.teacher_notes && (
                    <div className="mt-3 bg-[#fffff0] border border-[#e0dc90] rounded-[7px] p-2.5">
                      <div className="text-[10px] font-medium text-[#8a5c00] mb-0.5">Teacher note</div>
                      <div className="text-[11px] text-[#7a7f8a] italic">{selectedPlan.teacher_notes}</div>
                    </div>
                  )}
                  {selectedPlan.homework_suggestion && (
                    <div className="mt-2 bg-[#fffff0] border border-[#e0dc90] rounded-[7px] p-2.5">
                      <div className="text-[10px] font-medium text-[#8a5c00] mb-0.5">Homework idea</div>
                      <div className="text-[11px] text-[#7a7f8a] italic">{selectedPlan.homework_suggestion}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Streaming preview when generating */}
            {generatingWeekSession && streamText && !selectedPlan?.activities.length && (
              <div className="bg-[#fffff0] border border-[#e0dc90] rounded-[10px] p-4 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1a56b0]" />
                  <span className="text-[11px] text-[#1a56b0] font-medium">Generating session plan…</span>
                </div>
                <pre className="text-[10px] text-[#4a5264] whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">{streamText.slice(-500)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan All Confirmation Modal */}
      <Dialog open={planAllConfirm} onOpenChange={setPlanAllConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plan all weeks with AI</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-[#4a5264]">
            This will generate session plans for all {weekRows.filter(r => getWeekStatus(r.week) !== 'complete').length} unplanned
            weeks. Estimated time: ~{weekRows.filter(r => getWeekStatus(r.week) !== 'complete').length * 8} seconds.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanAllConfirm(false)}>Cancel</Button>
            <Button onClick={planAllWeeks} className="bg-[#0f2044] hover:bg-[#1a2d54]">
              <Sparkles className="w-4 h-4 mr-1.5" /> Generate all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calendar View Modal */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Course Calendar — {syllabus.course_name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-medium text-[#aab0bc] uppercase py-1">{d.slice(0, 3)}</div>
            ))}
            {weekRows.flatMap(row =>
              Array.from({ length: sessPerWeek }, (_, i) => {
                const plan = sessionPlans.find(p => p.week_number === row.week && p.session_number === i + 1);
                return (
                  <button
                    key={`${row.week}-${i}`}
                    onClick={() => { setSelectedWeek(row.week); setSelectedSession(i + 1); setCalendarOpen(false); }}
                    className={`p-1.5 rounded-md text-[10px] border transition-colors ${plan?.activities.length ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-white border-[#e8e9eb] text-[#aab0bc] hover:bg-[#f9f9fb]'}`}
                  >
                    <div className="font-medium">W{row.week}S{i + 1}</div>
                    {plan?.session_title && <div className="truncate text-[9px] mt-0.5">{plan.session_title}</div>}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
