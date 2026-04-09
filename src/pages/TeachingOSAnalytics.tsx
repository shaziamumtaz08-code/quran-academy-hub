import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseArabicTags } from '@/lib/languageUtils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { NavRail, buildRailNav } from '@/components/layout/NavRail';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, BookOpen, Activity, Target,
  Star, Download, FileText, ChevronRight, CheckCircle2, CircleDot, Eye,
  ExternalLink, Sparkles, MessageSquare, ClipboardList, ArrowRight,
  Calendar, Clock, Award, Lightbulb, Send, X, ChevronDown, ChevronUp
} from 'lucide-react';

type Section = 'dashboard' | 'ai-report' | 'growth' | 'at-risk' | 'teacher' | 'curriculum' | 'engagement' | 'outcomes';

const PHASE_STEPS = [
  { key: 'syllabus', label: 'Syllabus', num: 1 },
  { key: 'planner', label: 'Planner', num: 2 },
  { key: 'dayboard', label: 'Day Board', num: 3 },
  { key: 'contentkit', label: 'Content Kit', num: 4 },
  { key: 'assessment', label: 'Assessment', num: 5 },
  { key: 'video', label: 'Video', num: 6 },
  { key: 'speaking', label: 'Speaking', num: 7 },
  { key: 'analytics', label: 'Analytics', num: 8 },
];

// Mock data
const MOCK_STATS = { activeStudents: 47, studentDelta: 4, assessmentAvg: 74, assessmentDelta: 6, attendanceAvg: 92, atRisk: 3 };

const MOCK_COURSE_SCORES = [
  { name: 'Hifz', score: 88, color: '#1a7340', students: 12 },
  { name: 'Arabic', score: 72, color: '#1a56b0', students: 18 },
  { name: 'Tajweed', score: 65, color: '#8a5c00', students: 15 },
  { name: 'Islamic', score: 81, color: '#534AB7', students: 10 },
];

const MOCK_TREND = [
  { week: 'W1', actual: 68, target: 70 }, { week: 'W2', actual: 71, target: 72 },
  { week: 'W3', actual: 69, target: 73 }, { week: 'W4', actual: 75, target: 74 },
  { week: 'W5', actual: 73, target: 75 }, { week: 'W6', actual: 78, target: 76 },
  { week: 'W7', actual: 74, target: 77 }, { week: 'W8', actual: 80, target: 78 },
];

const MOCK_HEATMAP = [
  [90, 95, 85, 100, 92], [100, 92, 88, 95, 100],
  [83, 100, 92, 88, 75], [95, 88, 100, 92, 88],
];

const MOCK_SPEAKERS = [
  { name: 'Sara Ahmed', score: 92, color: '#1a7340' },
  { name: 'Maha Khan', score: 85, color: '#1a56b0' },
  { name: 'Zara Farooq', score: 78, color: '#1a56b0' },
  { name: 'Rania Aziz', score: 64, color: '#8a5c00' },
];

const MOCK_PHASES = [
  { name: 'Syllabus', pct: 100, color: '#534AB7' },
  { name: 'Planner', pct: 100, color: '#1a56b0' },
  { name: 'Day boards', pct: 83, color: '#0f2044' },
  { name: 'Content kit', pct: 67, color: '#1a7340' },
  { name: 'Assessment', pct: 50, color: '#b42a2a' },
  { name: 'Video', pct: 33, color: '#993556' },
  { name: 'Speaking', pct: 17, color: '#854F0B' },
  { name: 'Analytics', pct: 0, color: '#185FA5' },
];

const MOCK_STUDENTS = [
  { id: '1', name: 'Sara Ahmed', course: 'Arabic 101', assessment: 92, attendance: 98, speaking: 88, growth: 8, trend: 'Growing' },
  { id: '2', name: 'Maha Khan', course: 'Arabic 101', assessment: 85, attendance: 95, speaking: 82, growth: 5, trend: 'Growing' },
  { id: '3', name: 'Omar Yusuf', course: 'Hifz Program', assessment: 78, attendance: 90, speaking: 75, growth: 2, trend: 'Stable' },
  { id: '4', name: 'Zara Farooq', course: 'Arabic 101', assessment: 71, attendance: 88, speaking: 68, growth: -1, trend: 'Watch' },
  { id: '5', name: 'Ibrahim Ali', course: 'Tajweed', assessment: 62, attendance: 72, speaking: 55, growth: -8, trend: 'Declining' },
  { id: '6', name: 'Rania Aziz', course: 'Arabic 101', assessment: 58, attendance: 65, speaking: 50, growth: -12, trend: 'Declining' },
  { id: '7', name: 'Hamza Qureshi', course: 'Hifz Program', assessment: 88, attendance: 96, speaking: 90, growth: 3, trend: 'Stable' },
  { id: '8', name: 'Fatima Noor', course: 'Islamic Studies', assessment: 76, attendance: 82, speaking: 72, growth: 0, trend: 'Stable' },
];

const MOCK_AT_RISK = [
  { id: '1', name: 'Ibrahim Ali', course: 'Tajweed', score: 62, attendance: 72, delta: -8, reasons: ['Score < 60% for 2 sessions', 'Attendance dropped 15%'], summary: 'Ibrahim has shown declining performance in Tajweed with scores dropping from 70% to 62% over the last two sessions. His attendance has also decreased, suggesting possible disengagement.' },
  { id: '2', name: 'Rania Aziz', course: 'Arabic 101', score: 58, attendance: 65, delta: -12, reasons: ['Score < 60% for 3 sessions', 'Zero speaking practice in 10 days', 'Missing 2 assignments'], summary: 'Rania\'s Arabic performance has been declining steadily. She has not submitted any speaking practice assignments and is missing coursework, indicating she may need additional support or a parent conference.' },
  { id: '3', name: 'Zara Farooq', course: 'Arabic 101', score: 71, attendance: 88, delta: -1, reasons: ['Score dropped 15% session-on-session'], summary: 'Zara\'s score dropped sharply from 86% to 71% in the last session. This may be a one-time occurrence but warrants monitoring. Her attendance remains satisfactory.' },
];

const MOCK_TEACHERS = [
  { id: '1', name: 'Ustadh Ahmed', course: 'Arabic 101', composite: 87, growth: 88, delivery: 95, content: 80, speaking: 75, feedback: 85, attendance: 90, sessions: 24, avgScore: 78, kitRate: 83 },
  { id: '2', name: 'Ustadha Fatima', course: 'Hifz Program', composite: 82, growth: 85, delivery: 90, content: 70, speaking: 60, feedback: 90, attendance: 92, sessions: 28, avgScore: 82, kitRate: 71 },
  { id: '3', name: 'Sheikh Yusuf', course: 'Tajweed', composite: 74, growth: 70, delivery: 85, content: 65, speaking: 50, feedback: 80, attendance: 88, sessions: 20, avgScore: 68, kitRate: 55 },
];

const MOCK_CURRICULUM = [
  { week: 1, topic: 'Introduction to Arabic alphabet', status: 'delivered', coverage: 100 },
  { week: 2, topic: 'Basic greetings and introductions', status: 'delivered', coverage: 100 },
  { week: 3, topic: 'Numbers and counting', status: 'delivered', coverage: 100 },
  { week: 4, topic: 'Family vocabulary', status: 'delivered', coverage: 95 },
  { week: 5, topic: 'Daily routines', status: 'in-progress', coverage: 60 },
  { week: 6, topic: 'Food and drink', status: 'planned', coverage: 0 },
  { week: 7, topic: 'Places and directions', status: 'planned', coverage: 0 },
  { week: 8, topic: 'Review and final assessment', status: 'planned', coverage: 0 },
];

const MOCK_ENGAGEMENT = {
  videoCompletion: 78, flashcardUsage: 65, speakingPractice: 52, assignmentSubmit: 84,
  byHour: [0,0,0,0,0,0,2,5,12,18,25,30,28,22,15,20,35,42,38,25,15,8,3,1],
  byDay: [
    { day: 'Mon', val: 85 }, { day: 'Tue', val: 72 }, { day: 'Wed', val: 90 },
    { day: 'Thu', val: 68 }, { day: 'Fri', val: 45 }, { day: 'Sat', val: 95 },
    { day: 'Sun', val: 98 },
  ],
};

const MOCK_OUTCOMES = [
  { objective: 'Identify Arabic letters', mastered: 92, status: 'mastered' },
  { objective: 'Pronounce basic greetings', mastered: 85, status: 'mastered' },
  { objective: 'Count to 100 in Arabic', mastered: 78, status: 'mastered' },
  { objective: 'Introduce family members', mastered: 65, status: 'in-progress' },
  { objective: 'Describe daily routines', mastered: 40, status: 'in-progress' },
  { objective: 'Order food in Arabic', mastered: 0, status: 'not-assessed' },
  { objective: 'Give directions', mastered: 0, status: 'not-assessed' },
  { objective: 'Write short paragraphs', mastered: 0, status: 'not-assessed' },
];

// Helper components
function StatCard({ label, value, delta, sub, icon: Icon, color, onClick }: any) {
  const deltaColor = delta > 0 ? '#1a7340' : delta < 0 ? '#b42a2a' : '#7a7f8a';
  const deltaText = delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '→';
  return (
    <div className="bg-white border rounded-[9px] p-[12px_13px] cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: '#e8e9eb' }} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-medium" style={{ color: '#0f2044' }}>{value}</span>
            {delta !== undefined && (
              <span className="text-[11px] px-[5px] py-[1px] rounded-full font-medium" style={{ color: deltaColor, backgroundColor: delta > 0 ? '#e6f4ea' : delta < 0 ? '#fde8e8' : '#f4f5f7' }}>{deltaText}</span>
            )}
          </div>
          <div className="text-[11px] mt-[2px]" style={{ color: '#7a7f8a' }}>{label}</div>
          {sub && <div className="text-[10px]" style={{ color: '#aab0bc' }}>{sub}</div>}
        </div>
        {color && <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}12` }}><Icon className="w-4 h-4" style={{ color }} /></div>}
      </div>
    </div>
  );
}

function MiniBar({ pct, color, height = 4 }: { pct: number; color: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, backgroundColor: '#f4f5f7' }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ScoreColor(pct: number) {
  if (pct >= 80) return '#1a7340';
  if (pct >= 60) return '#8a5c00';
  return '#b42a2a';
}

function GrowthBadge({ trend }: { trend: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Growing: { bg: '#e6f4ea', color: '#1a7340' },
    Stable: { bg: '#eef2fa', color: '#1a56b0' },
    Watch: { bg: '#fff8e6', color: '#8a5c00' },
    Declining: { bg: '#fde8e8', color: '#b42a2a' },
  };
  const s = map[trend] || map.Stable;
  return <span className="text-[10px] px-[6px] py-[2px] rounded-full font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{trend}</span>;
}

// ─── DASHBOARD VIEW ───
function DashboardView({ setSection }: { setSection: (s: Section) => void }) {
  const maxScore = Math.max(...MOCK_COURSE_SCORES.map(c => c.score));
  // SVG line chart
  const trendW = 320, trendH = 120, padL = 25, padB = 20;
  const xStep = (trendW - padL - 10) / (MOCK_TREND.length - 1);
  const yScale = (v: number) => trendH - padB - ((v - 50) / 50) * (trendH - padB - 10);
  const actualPoints = MOCK_TREND.map((d, i) => `${padL + i * xStep},${yScale(d.actual)}`).join(' ');
  const targetPoints = MOCK_TREND.map((d, i) => `${padL + i * xStep},${yScale(d.target)}`).join(' ');
  const days = ['M', 'T', 'W', 'T', 'F'];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active students" value={MOCK_STATS.activeStudents} delta={MOCK_STATS.studentDelta} sub="vs last month" icon={Users} color="#1a56b0" onClick={() => setSection('growth')} />
        <StatCard label="Avg assessment score" value={`${MOCK_STATS.assessmentAvg}%`} delta={MOCK_STATS.assessmentDelta} sub="across all courses" icon={Target} color="#1a7340" />
        <StatCard label="Avg attendance" value={`${MOCK_STATS.attendanceAvg}%`} sub="last 30 days" icon={CheckCircle2} color="#1a56b0" />
        <StatCard label="At-risk students" value={MOCK_STATS.atRisk} sub="need attention" icon={AlertTriangle} color="#b42a2a" onClick={() => setSection('at-risk')} />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-2 gap-3">
        {/* Assessment scores bar chart */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Assessment scores — by course</span>
            <button className="text-[10px] underline" style={{ color: '#1a56b0' }}>Details</button>
          </div>
          <div className="flex items-end gap-4 h-[120px] px-2">
            {MOCK_COURSE_SCORES.map(c => (
              <div key={c.name} className="flex flex-col items-center flex-1 gap-1">
                <span className="text-[10px] font-medium" style={{ color: c.color }}>{c.score}%</span>
                <div className="w-full rounded-t-[3px]" style={{ height: `${(c.score / maxScore) * 90}%`, backgroundColor: c.color, minHeight: 4 }} />
                <span className="text-[9px]" style={{ color: '#7a7f8a' }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend line chart */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Monthly score trend</span>
            <button className="text-[10px]" style={{ color: '#1a56b0' }}>All courses</button>
          </div>
          <svg viewBox={`0 0 ${trendW} ${trendH}`} className="w-full h-[120px]">
            <polyline points={targetPoints} fill="none" stroke="#1a7340" strokeWidth="1.5" strokeDasharray="5,3" />
            <polyline points={actualPoints} fill="none" stroke="#1a56b0" strokeWidth="2" />
            {MOCK_TREND.map((d, i) => (
              <circle key={i} cx={padL + i * xStep} cy={yScale(d.actual)} r="3" fill="#1a56b0" />
            ))}
            {MOCK_TREND.map((d, i) => (
              <text key={`l${i}`} x={padL + i * xStep} y={trendH - 4} textAnchor="middle" fontSize="8" fill="#7a7f8a">{d.week}</text>
            ))}
          </svg>
          <div className="flex gap-4 mt-1">
            <div className="flex items-center gap-1"><div className="w-3 h-[2px]" style={{ backgroundColor: '#1a56b0' }} /><span className="text-[10px]" style={{ color: '#7a7f8a' }}>Actual</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-[2px] border-t border-dashed" style={{ borderColor: '#1a7340' }} /><span className="text-[10px]" style={{ color: '#7a7f8a' }}>Target</span></div>
          </div>
        </div>
      </div>

      {/* Row 3: Three cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Attendance heatmap */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Attendance heatmap</span>
          <div className="mt-3">
            <div className="flex gap-[3px] mb-1 ml-[28px]">
              {days.map(d => <div key={d} className="w-4 text-center text-[8px]" style={{ color: '#7a7f8a' }}>{d}</div>)}
            </div>
            {MOCK_HEATMAP.map((row, wi) => (
              <div key={wi} className="flex items-center gap-[3px] mb-[3px]">
                <span className="text-[8px] w-[25px] text-right pr-1" style={{ color: '#7a7f8a' }}>Wk{wi + 1}</span>
                {row.map((val, di) => {
                  const bg = val >= 95 ? '#1a7340' : val >= 85 ? '#5DCAA5' : val >= 75 ? '#FAC775' : '#F0997B';
                  return <div key={di} className="w-4 h-4 rounded-[2px] cursor-pointer" style={{ backgroundColor: bg }} title={`${val}%`} />;
                })}
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              {[{ l: '≥95%', c: '#1a7340' }, { l: '85-94%', c: '#5DCAA5' }, { l: '75-84%', c: '#FAC775' }, { l: '<75%', c: '#F0997B' }].map(x => (
                <div key={x.l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: x.c }} /><span className="text-[8px]" style={{ color: '#7a7f8a' }}>{x.l}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* Speaking scores */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Speaking scores</span>
          <div className="mt-3 space-y-[6px]">
            {MOCK_SPEAKERS.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium text-white" style={{ backgroundColor: '#1a56b0' }}>{s.name.split(' ').map(w => w[0]).join('')}</div>
                <span className="text-[10px] flex-1 truncate" style={{ color: '#0f2044' }}>{s.name}</span>
                <div className="w-[80px]"><MiniBar pct={s.score} color={s.color} /></div>
                <span className="text-[10px] font-medium w-[28px] text-right" style={{ color: s.color }}>{s.score}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Module completion */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Module completion</span>
          <div className="mt-3 space-y-[5px]">
            {MOCK_PHASES.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-[10px] w-[80px] truncate" style={{ color: '#4a5264' }}>{p.name}</span>
                <div className="flex-1"><MiniBar pct={p.pct} color={p.pct === 100 ? '#1a7340' : p.pct >= 50 ? '#1a56b0' : p.pct > 0 ? '#8a5c00' : '#d0d4dc'} /></div>
                <span className="text-[10px] font-medium w-[28px] text-right" style={{ color: p.pct === 100 ? '#1a7340' : '#4a5264' }}>{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI REPORT VIEW ───
function AIReportView() {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generateReport = () => {
    setGenerating(true);
    setTimeout(() => {
      setReport({
        title: 'Monthly Performance Report — April 2026',
        period: 'April 1-30, 2026',
        sections: [
          { id: 'summary', heading: 'Overall Performance Summary', type: 'summary', content: 'The academy has shown strong overall performance this month with 47 active students across 4 courses. Assessment scores averaged 74%, representing a 6% improvement from last month. Attendance remains high at 92%, demonstrating strong student commitment.\n\nThe Arabic program saw the most significant growth with an 8% increase in average scores, driven largely by the introduction of AI-powered speaking practice in Phase 7. The Tajweed program, while showing lower scores at 65%, has identified specific areas for targeted intervention.\n\nThree students have been flagged as at-risk, down from five last month, suggesting that the early intervention strategies implemented are beginning to take effect.' },
          { id: 'students', heading: 'Student Highlights', type: 'students', content: 'Top Improvers:\n• Sara Ahmed (+8%) — Arabic 101: Consistently practicing speaking drills; highest engagement across all phases.\n• Maha Khan (+5%) — Arabic 101: Strong assessment performance with 85% average.\n• Hamza Qureshi (+3%) — Hifz: Steady progress with excellent attendance at 96%.\n\nAt-Risk Students:\n• Ibrahim Ali (-8%) — Tajweed: Declining scores and attendance. Recommend parent conference and targeted drills.\n• Rania Aziz (-12%) — Arabic 101: Missing assignments and zero speaking practice. Immediate intervention needed.\n• Zara Farooq (-1%) — Arabic 101: Sharp single-session drop; monitoring recommended.' },
          { id: 'teaching', heading: 'Teaching Effectiveness', type: 'teaching', content: 'Ustadh Ahmed leads in effectiveness at 87%, with strong session delivery (95%) and student score growth (88%). His high Content Kit usage (83%) correlates with better student outcomes.\n\nUstadha Fatima scores well at 82% with the highest student attendance in her sessions (92%). She could benefit from increased Speaking Tutor assignments (currently at 60%).\n\nSheikh Yusuf at 74% would benefit from using more Content Kit features (currently 55%) and assigning speaking practice more regularly.' },
          { id: 'recommendations', heading: 'Recommendations for Next Month', type: 'recommendations', content: '1. Schedule a parent conference for Ibrahim Ali and Rania Aziz to discuss support strategies.\n2. Encourage Sheikh Yusuf to use the Content Kit for slide generation — correlated with 15% higher student scores.\n3. Increase Speaking Tutor assignments for all courses — students who practice speaking score 12% higher on assessments.\n4. Add remedial Tajweed drills targeting specific pronunciation weaknesses identified by AI.\n5. Schedule assessment for unassessed syllabus objectives (3 of 8 not yet covered).' },
        ],
      });
      setGenerating(false);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] p-[14px] flex items-center justify-between" style={{ backgroundColor: '#eef2fa', border: '1px solid #b5d0f8' }}>
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5" style={{ color: '#1a56b0' }} />
          <div>
            <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>AI monthly performance report — April 2026</div>
            <div className="text-[11px]" style={{ color: '#7a7f8a' }}>Generated from all 8 phases · 47 students · 4 courses · 72 sessions delivered</div>
          </div>
        </div>
        <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#1a56b0', color: '#fff' }} onClick={generateReport} disabled={generating}>
          {generating ? <><span className="animate-spin mr-1">⏳</span> Generating...</> : <><Sparkles className="w-3 h-3 mr-1" /> Generate ↗</>}
        </Button>
      </div>

      {report && (
        <div className="space-y-3">
          {report.sections.map((s: any) => {
            const iconMap: Record<string, any> = { summary: BarChart3, students: Users, teaching: Award, recommendations: Lightbulb };
            const colorMap: Record<string, string> = { summary: '#1a56b0', students: '#1a7340', teaching: '#534AB7', recommendations: '#8a5c00' };
            const Icon = iconMap[s.type] || BarChart3;
            return (
              <div key={s.id} className="bg-white border rounded-[10px] p-[14px]" style={{ borderColor: '#e8e9eb' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${colorMap[s.type]}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: colorMap[s.type] }} />
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: '#0f2044' }}>{s.heading}</span>
                  <div className="flex-1" />
                  <button className="text-[10px]" style={{ color: '#1a56b0' }}>Share</button>
                  <button className="text-[10px]" style={{ color: '#1a56b0' }}>Export PDF</button>
                </div>
                <div className={`text-[12px] leading-[1.6] whitespace-pre-line ${langClass}`} style={{ color: '#4a5264' }} dangerouslySetInnerHTML={{ __html: parseArabicTags(s.content) }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AT-RISK VIEW ───
function AtRiskView() {
  return (
    <div className="space-y-4">
      <div className="rounded-[10px] p-[12px_14px] flex items-center gap-3" style={{ backgroundColor: '#fde8e8', border: '1px solid #f5c6c6' }}>
        <AlertTriangle className="w-5 h-5" style={{ color: '#b42a2a' }} />
        <span className="text-[12px] font-medium" style={{ color: '#b42a2a' }}>{MOCK_AT_RISK.length} students flagged as at-risk — AI detected declining performance over 2+ sessions</span>
      </div>
      {MOCK_AT_RISK.map(s => (
        <div key={s.id} className="bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: '#e8e9eb' }}>
          <div className="p-[12px_14px] flex items-center gap-3 border-b" style={{ borderColor: '#e8e9eb' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium text-white" style={{ backgroundColor: '#b42a2a' }}>{s.name.split(' ').map(w => w[0]).join('')}</div>
            <div className="flex-1">
              <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{s.name}</div>
              <div className="text-[10px]" style={{ color: '#7a7f8a' }}>{s.course}</div>
            </div>
            <span className="text-[11px] px-2 py-[2px] rounded-full font-medium" style={{ backgroundColor: '#fde8e8', color: '#b42a2a' }}>{s.score}%</span>
            <span className="text-[10px]" style={{ color: '#b42a2a' }}>↓{Math.abs(s.delta)}%</span>
          </div>
          <div className="p-[12px_14px]">
            <div className="flex flex-wrap gap-1 mb-2">
              {s.reasons.map((r, i) => (
                <span key={i} className="text-[9px] px-[6px] py-[2px] rounded-full" style={{ backgroundColor: '#fde8e8', color: '#b42a2a' }}>{r}</span>
              ))}
            </div>
            <div className="text-[11px] leading-[1.5]" style={{ color: '#4a5264' }}>{s.summary}</div>
          </div>
          <div className="p-[8px_14px] flex gap-2 border-t" style={{ borderColor: '#e8e9eb', backgroundColor: '#fafbfc' }}>
            <Button variant="outline" size="sm" className="text-[10px] h-6"><Sparkles className="w-3 h-3 mr-1" /> AI: generate support plan</Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6"><MessageSquare className="w-3 h-3 mr-1" /> Message parent</Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6"><ClipboardList className="w-3 h-3 mr-1" /> Assign remedial drills</Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6"><Calendar className="w-3 h-3 mr-1" /> Schedule 1-to-1</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── TEACHER EFFECTIVENESS VIEW ───
function TeacherEffectivenessView() {
  const [selected, setSelected] = useState<string | null>(null);
  const teacher = MOCK_TEACHERS.find(t => t.id === selected);
  const components = [
    { label: 'Student score growth', weight: '35%', key: 'growth' },
    { label: 'Session delivery rate', weight: '20%', key: 'delivery' },
    { label: 'Content kit usage', weight: '15%', key: 'content' },
    { label: 'Speaking assignments', weight: '10%', key: 'speaking' },
    { label: 'Assessment feedback', weight: '10%', key: 'feedback' },
    { label: 'Student attendance', weight: '10%', key: 'attendance' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Teacher effectiveness scores</span>
          <div className="mt-3 space-y-[6px]">
            {MOCK_TEACHERS.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-[6px_8px] rounded-[7px] cursor-pointer transition-colors" style={{ backgroundColor: selected === t.id ? '#eef2fa' : 'transparent' }} onClick={() => setSelected(t.id)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-medium text-white" style={{ backgroundColor: '#0f2044' }}>{t.name.split(' ').pop()?.[0]}</div>
                <div className="flex-1">
                  <div className="text-[11px] font-medium" style={{ color: '#0f2044' }}>{t.name}</div>
                  <div className="text-[9px]" style={{ color: '#7a7f8a' }}>{t.course}</div>
                </div>
                <div className="w-[60px]"><MiniBar pct={t.composite} color={ScoreColor(t.composite)} /></div>
                <span className="text-[11px] font-medium w-[28px] text-right" style={{ color: ScoreColor(t.composite) }}>{t.composite}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Effectiveness components {teacher ? `— ${teacher.name}` : ''}</span>
          {teacher ? (
            <div className="mt-3 space-y-[8px]">
              {components.map(c => {
                const val = (teacher as any)[c.key] as number;
                return (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px]" style={{ color: '#4a5264' }}>{c.label} ({c.weight})</span>
                      <span className="text-[10px] font-medium" style={{ color: ScoreColor(val) }}>{val}%</span>
                    </div>
                    <MiniBar pct={val} color={ScoreColor(val)} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 text-center text-[11px]" style={{ color: '#7a7f8a' }}>Select a teacher to see breakdown</div>
          )}
        </div>
      </div>
      {teacher && (
        <div className="bg-white border rounded-[10px] p-[14px]" style={{ borderColor: '#e8e9eb' }}>
          <div className="grid grid-cols-4 gap-4">
            <div><div className="text-[18px] font-medium" style={{ color: '#0f2044' }}>{teacher.sessions}</div><div className="text-[10px]" style={{ color: '#7a7f8a' }}>Sessions delivered</div></div>
            <div><div className="text-[18px] font-medium" style={{ color: '#0f2044' }}>{teacher.avgScore}%</div><div className="text-[10px]" style={{ color: '#7a7f8a' }}>Avg student score</div></div>
            <div><div className="text-[18px] font-medium" style={{ color: '#0f2044' }}>{teacher.kitRate}%</div><div className="text-[10px]" style={{ color: '#7a7f8a' }}>Content kit usage</div></div>
            <div className="rounded-[8px] p-[8px]" style={{ backgroundColor: '#eef2fa' }}>
              <div className="flex items-center gap-1 mb-1"><Sparkles className="w-3 h-3" style={{ color: '#1a56b0' }} /><span className="text-[10px] font-medium" style={{ color: '#1a56b0' }}>AI recommendation</span></div>
              <div className="text-[10px]" style={{ color: '#4a5264' }}>{teacher.content < 70 ? 'Increase Content Kit usage — correlated with 15% higher student scores.' : teacher.speaking < 70 ? 'Assign more Speaking Tutor drills — students who practice score 12% higher.' : 'Maintain current approach — strong performance across all areas.'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GROWTH TRACKING VIEW ───
function GrowthTrackingView() {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = [...MOCK_STUDENTS].sort((a, b) => {
    const v = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'name') return a.name.localeCompare(b.name) * v;
    return (((a as any)[sortBy] ?? 0) - ((b as any)[sortBy] ?? 0)) * v;
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) => sortBy === col ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null;

  return (
    <div className="bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: '#e8e9eb' }}>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid #e8e9eb' }}>
            {[{ k: 'name', l: 'Student' }, { k: 'assessment', l: 'Assessment %' }, { k: 'attendance', l: 'Attendance %' }, { k: 'speaking', l: 'Speaking %' }, { k: 'growth', l: 'Growth' }, { k: 'trend', l: 'Trend' }].map(h => (
              <th key={h.k} className="p-[8px_12px] text-[10px] font-medium cursor-pointer select-none" style={{ color: '#7a7f8a' }} onClick={() => toggleSort(h.k)}>
                <div className="flex items-center gap-1">{h.l}<SortIcon col={h.k} /></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr key={s.id} className="hover:bg-[#fafbfc] cursor-pointer" style={{ borderBottom: '1px solid #f4f5f7' }}>
              <td className="p-[8px_12px]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-medium text-white" style={{ backgroundColor: '#1a56b0' }}>{s.name.split(' ').map(w => w[0]).join('')}</div>
                  <div>
                    <div className="text-[11px] font-medium" style={{ color: '#0f2044' }}>{s.name}</div>
                    <div className="text-[9px]" style={{ color: '#7a7f8a' }}>{s.course}</div>
                  </div>
                </div>
              </td>
              <td className="p-[8px_12px] text-[11px] font-medium" style={{ color: ScoreColor(s.assessment) }}>{s.assessment}%</td>
              <td className="p-[8px_12px] text-[11px] font-medium" style={{ color: ScoreColor(s.attendance) }}>{s.attendance}%</td>
              <td className="p-[8px_12px] text-[11px] font-medium" style={{ color: ScoreColor(s.speaking) }}>{s.speaking}%</td>
              <td className="p-[8px_12px] text-[11px] font-medium" style={{ color: s.growth >= 5 ? '#1a7340' : s.growth >= 0 ? '#1a56b0' : s.growth >= -4 ? '#8a5c00' : '#b42a2a' }}>{s.growth > 0 ? '+' : ''}{s.growth}%</td>
              <td className="p-[8px_12px]"><GrowthBadge trend={s.trend} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CURRICULUM COVERAGE VIEW ───
function CurriculumCoverageView() {
  const delivered = MOCK_CURRICULUM.filter(w => w.status === 'delivered').length;
  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-[10px] p-[14px]" style={{ borderColor: '#e8e9eb' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Curriculum coverage</span>
          <span className="text-[11px]" style={{ color: '#7a7f8a' }}>{delivered} of {MOCK_CURRICULUM.length} weeks delivered · {Math.round(delivered / MOCK_CURRICULUM.length * 100)}% covered</span>
        </div>
        <div className="mt-3 space-y-[4px]">
          {MOCK_CURRICULUM.map(w => {
            const statusMap: Record<string, { icon: any; color: string; label: string }> = {
              delivered: { icon: CheckCircle2, color: '#1a7340', label: '✓ Delivered' },
              'in-progress': { icon: CircleDot, color: '#1a56b0', label: '● In progress' },
              planned: { icon: Clock, color: '#7a7f8a', label: '○ Planned' },
              skipped: { icon: X, color: '#b42a2a', label: '✗ Skipped' },
            };
            const s = statusMap[w.status];
            return (
              <div key={w.week} className="flex items-center gap-3 p-[6px_8px] rounded-[6px]" style={{ backgroundColor: w.status === 'in-progress' ? '#eef2fa' : 'transparent' }}>
                <span className="text-[10px] font-medium w-[32px]" style={{ color: '#7a7f8a' }}>W{w.week}</span>
                <span className="text-[11px] flex-1" style={{ color: '#0f2044' }}>{w.topic}</span>
                <div className="w-[80px]"><MiniBar pct={w.coverage} color={s.color} /></div>
                <span className="text-[10px] font-medium w-[80px]" style={{ color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {MOCK_CURRICULUM.filter(w => w.status === 'planned').length > 0 && (
        <div className="rounded-[10px] p-[12px_14px] flex items-center gap-3" style={{ backgroundColor: '#eef2fa', border: '1px solid #b5d0f8' }}>
          <Sparkles className="w-4 h-4" style={{ color: '#1a56b0' }} />
          <span className="text-[11px]" style={{ color: '#4a5264' }}>
            {MOCK_CURRICULUM.filter(w => w.status === 'planned').length} weeks remain. At current pace you will complete by May 15. To stay on track: complete Week 5 this session and begin Week 6.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── ENGAGEMENT VIEW ───
function EngagementView() {
  const maxHour = Math.max(...MOCK_ENGAGEMENT.byHour);
  const maxDay = Math.max(...MOCK_ENGAGEMENT.byDay.map(d => d.val));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Video completion', v: `${MOCK_ENGAGEMENT.videoCompletion}%`, c: '#1a56b0' },
          { l: 'Flashcard usage', v: `${MOCK_ENGAGEMENT.flashcardUsage}%`, c: '#534AB7' },
          { l: 'Speaking practice', v: `${MOCK_ENGAGEMENT.speakingPractice}%`, c: '#854F0B' },
          { l: 'Assignment submit', v: `${MOCK_ENGAGEMENT.assignmentSubmit}%`, c: '#1a7340' },
        ].map(s => (
          <div key={s.l} className="bg-white border rounded-[9px] p-[12px_13px]" style={{ borderColor: '#e8e9eb' }}>
            <div className="text-[20px] font-medium" style={{ color: '#0f2044' }}>{s.v}</div>
            <div className="text-[10px]" style={{ color: '#7a7f8a' }}>{s.l}</div>
            <MiniBar pct={parseInt(s.v)} color={s.c} height={3} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* By hour */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Engagement by time of day</span>
          <div className="flex items-end gap-[2px] h-[80px] mt-3">
            {MOCK_ENGAGEMENT.byHour.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-[1px] cursor-pointer" style={{ height: `${maxHour > 0 ? (v / maxHour) * 100 : 0}%`, backgroundColor: v > 30 ? '#1a56b0' : v > 15 ? '#5DCAA5' : '#d0d4dc', minHeight: v > 0 ? 2 : 0 }} title={`${i}:00 — ${v} activities`} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px]" style={{ color: '#7a7f8a' }}>0h</span>
            <span className="text-[8px]" style={{ color: '#7a7f8a' }}>6h</span>
            <span className="text-[8px]" style={{ color: '#7a7f8a' }}>12h</span>
            <span className="text-[8px]" style={{ color: '#7a7f8a' }}>18h</span>
            <span className="text-[8px]" style={{ color: '#7a7f8a' }}>23h</span>
          </div>
        </div>
        {/* By day */}
        <div className="bg-white border rounded-[10px] p-[13px]" style={{ borderColor: '#e8e9eb' }}>
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Engagement by day of week</span>
          <div className="flex items-end gap-3 h-[80px] mt-3 px-2">
            {MOCK_ENGAGEMENT.byDay.map(d => (
              <div key={d.day} className="flex flex-col items-center flex-1 gap-1">
                <span className="text-[9px] font-medium" style={{ color: '#1a56b0' }}>{d.val}%</span>
                <div className="w-full rounded-t-[3px]" style={{ height: `${(d.val / maxDay) * 70}px`, backgroundColor: d.val >= 90 ? '#1a7340' : d.val >= 70 ? '#1a56b0' : '#8a5c00' }} />
                <span className="text-[9px]" style={{ color: '#7a7f8a' }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[10px] p-[12px_14px] flex items-center gap-3" style={{ backgroundColor: '#eef2fa', border: '1px solid #b5d0f8' }}>
        <Sparkles className="w-4 h-4" style={{ color: '#1a56b0' }} />
        <span className="text-[11px]" style={{ color: '#4a5264' }}>Students are 34% more engaged on Sundays. Scheduling high-stakes assessments on Tuesdays correlates with 12% lower scores. Consider moving assessments to Saturday or Sunday.</span>
      </div>
    </div>
  );
}

// ─── LEARNING OUTCOMES VIEW ───
function LearningOutcomesView() {
  const assessed = MOCK_OUTCOMES.filter(o => o.status !== 'not-assessed').length;
  const mastered = MOCK_OUTCOMES.filter(o => o.mastered >= 70).length;
  const notAssessed = MOCK_OUTCOMES.filter(o => o.status === 'not-assessed');

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-[10px] p-[14px]" style={{ borderColor: '#e8e9eb' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>Outcome achievement</span>
          <span className="text-[11px]" style={{ color: '#7a7f8a' }}>{Math.round(assessed / MOCK_OUTCOMES.length * 100)}% assessed · {mastered} of {assessed} mastered</span>
        </div>
        <div className="mt-3 space-y-[4px]">
          {MOCK_OUTCOMES.map((o, i) => {
            const statusMap: Record<string, { color: string; label: string }> = {
              mastered: { color: '#1a7340', label: '✓ Mastered' },
              'in-progress': { color: '#8a5c00', label: '● In progress' },
              'not-assessed': { color: '#7a7f8a', label: '○ Not assessed' },
            };
            const s = statusMap[o.status];
            const barColor = o.mastered >= 70 ? '#1a7340' : o.mastered >= 40 ? '#8a5c00' : o.mastered > 0 ? '#b42a2a' : '#d0d4dc';
            return (
              <div key={i} className="flex items-center gap-3 p-[6px_8px] rounded-[6px]">
                <span className="text-[11px] flex-1" style={{ color: '#0f2044' }}>{o.objective}</span>
                {o.status !== 'not-assessed' && (
                  <>
                    <div className="w-[80px]"><MiniBar pct={o.mastered} color={barColor} /></div>
                    <span className="text-[10px] font-medium w-[32px] text-right" style={{ color: barColor }}>{o.mastered}%</span>
                  </>
                )}
                <span className="text-[10px] font-medium w-[90px] text-right" style={{ color: s.color }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {notAssessed.length > 0 && (
        <div className="rounded-[10px] p-[12px_14px] flex items-center justify-between" style={{ backgroundColor: '#fff8e6', border: '1px solid #f0d78c' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4" style={{ color: '#8a5c00' }} />
            <span className="text-[11px]" style={{ color: '#8a5c00' }}>{notAssessed.length} of {MOCK_OUTCOMES.length} objectives have no assessment data</span>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] h-6" style={{ borderColor: '#f0d78c', color: '#8a5c00' }}>Auto-generate quiz</Button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───
export default function TeachingOSAnalytics() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRole } = useAuth();
  const { langClass } = useLanguage();
  const courseId = params.get('course_id');
  const [section, setSection] = useState<Section>('dashboard');
  const [period, setPeriod] = useState('month');

  const courseName = 'Arabic 101';

  const sidebarItems: { group: string; items: { key: Section; label: string; badge?: string; badgeColor?: string }[] }[] = [
    { group: 'OVERVIEW', items: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'ai-report', label: 'AI report', badge: 'New', badgeColor: '#534AB7' },
    ]},
    { group: 'STUDENTS', items: [
      { key: 'growth', label: 'Growth tracking' },
      { key: 'at-risk', label: 'At-risk alerts', badge: '3', badgeColor: '#b42a2a' },
    ]},
    { group: 'TEACHING', items: [
      { key: 'teacher', label: 'Teacher effectiveness' },
      { key: 'curriculum', label: 'Curriculum coverage' },
    ]},
    { group: 'SYSTEM', items: [
      { key: 'engagement', label: 'Engagement' },
      { key: 'outcomes', label: 'Learning outcomes' },
    ]},
  ];

  const sectionTitles: Record<Section, string> = {
    dashboard: 'Analytics dashboard',
    'ai-report': 'AI report',
    growth: 'Student growth tracking',
    'at-risk': 'At-risk alerts',
    teacher: 'Teacher effectiveness',
    curriculum: 'Curriculum coverage',
    engagement: 'Engagement analytics',
    outcomes: 'Learning outcomes',
  };

  const railNav = buildRailNav(activeRole);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f4f5f7' }}>
      <NavRail items={railNav} />

      {/* Sidebar */}
      <div className="w-[210px] bg-white flex flex-col shrink-0" style={{ borderRight: '0.5px solid #e8e9eb' }}>
        <div className="p-[14px_14px_10px]">
          <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Analytics</div>
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>Teaching OS · Phase 8</div>
        </div>

        {/* Phase stepper */}
        <div className="px-[14px] pb-2 flex gap-[3px]">
          {PHASE_STEPS.map(p => (
            <div key={p.key} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium" style={{
              backgroundColor: p.num < 8 ? '#1a7340' : '#185FA5',
              color: '#fff',
            }}>
              {p.num < 8 ? '✓' : p.num}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-[6px] py-1">
          {sidebarItems.map(g => (
            <div key={g.group} className="mb-2">
              <div className="text-[9px] font-medium px-[8px] py-[4px] tracking-wider" style={{ color: '#aab0bc' }}>{g.group}</div>
              {g.items.map(item => (
                <button key={item.key} className="w-full flex items-center gap-2 px-[8px] py-[5px] rounded-[6px] text-left transition-colors" style={{ backgroundColor: section === item.key ? '#eef2fa' : 'transparent' }} onClick={() => setSection(item.key)}>
                  <span className="text-[11px] flex-1" style={{ color: section === item.key ? '#1a56b0' : '#4a5264', fontWeight: section === item.key ? 500 : 400 }}>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] px-[5px] py-[1px] rounded-full font-medium text-white" style={{ backgroundColor: item.badgeColor }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-[10px] border-t" style={{ borderColor: '#e8e9eb' }}>
          <Button className="w-full text-[12px] h-8" style={{ backgroundColor: '#0f2044', color: '#fff' }} onClick={() => toast.info('Phase 9: Parent dashboard coming soon')}>
            Phase 9: Parent dashboard <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '0.5px solid #e8e9eb' }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: '#7a7f8a' }}>Teaching OS</span>
            <span className="text-[11px]" style={{ color: '#aab0bc' }}>›</span>
            <span className="text-[11px]" style={{ color: '#7a7f8a' }}>{courseName}</span>
            <span className="text-[11px]" style={{ color: '#aab0bc' }}>›</span>
            <span className="text-[11px] font-medium" style={{ color: '#0f2044' }}>{sectionTitles[section]}</span>

            {/* Period selector */}
            <div className="flex gap-1 ml-4">
              {['week', 'month', 'term', 'custom'].map(p => (
                <button key={p} className="text-[10px] px-[8px] py-[3px] rounded-full transition-colors" style={{
                  backgroundColor: period === p ? '#0f2044' : '#f4f5f7',
                  color: period === p ? '#fff' : '#7a7f8a',
                }} onClick={() => setPeriod(p)}>
                  {p === 'week' ? 'This week' : p === 'month' ? 'This month' : p === 'term' ? 'This term' : 'Custom'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-[11px] h-7"><Download className="w-3 h-3 mr-1" /> Export report</Button>
            <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#1a56b0', color: '#fff' }} onClick={() => setSection('ai-report')}>
              <Sparkles className="w-3 h-3 mr-1" /> Generate AI report
            </Button>
            <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#0f2044', color: '#fff' }} onClick={() => toast.info('Phase 9: Parent dashboard coming soon')}>
              Phase 9 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {section === 'dashboard' && <DashboardView setSection={setSection} />}
          {section === 'ai-report' && <AIReportView />}
          {section === 'at-risk' && <AtRiskView />}
          {section === 'teacher' && <TeacherEffectivenessView />}
          {section === 'growth' && <GrowthTrackingView />}
          {section === 'curriculum' && <CurriculumCoverageView />}
          {section === 'engagement' && <EngagementView />}
          {section === 'outcomes' && <LearningOutcomesView />}
        </div>
      </div>
    </div>
  );
}
