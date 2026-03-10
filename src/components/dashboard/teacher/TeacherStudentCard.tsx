import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudentData {
  id: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  course: string;
  currentPosition: string;
  lastLesson: string | null;
  pace: string | null;
  attendanceRate: number;
  missedSessions: number;
  initials: string;
  avatarColor: string;
}

interface TeacherStudentCardProps {
  student: StudentData;
  onMarkAttendance: (student: StudentData) => void;
}

const AVATAR_COLORS = [
  'hsl(250 60% 65%)', 'hsl(340 60% 60%)', 'hsl(200 70% 55%)',
  'hsl(160 60% 45%)', 'hsl(30 70% 55%)', 'hsl(280 55% 60%)',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function TeacherStudentCard({ student, onMarkAttendance }: TeacherStudentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const attended = student.attendanceRate;
  const missed = student.missedSessions;

  return (
    <div
      className={`bg-card rounded-2xl border overflow-hidden shadow-card ${
        missed > 0 ? 'border-gold-light/60' : 'border-border'
      }`}
    >
      {/* Header row */}
      <div
        className="p-3.5 flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-primary-foreground font-extrabold text-sm flex-shrink-0"
          style={{ background: student.avatarColor }}
        >
          {student.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-[15px] text-foreground truncate">{student.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {student.course} · {student.currentPosition}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {missed > 0 && (
            <span className="bg-gold-light/25 text-gold text-[11px] font-bold rounded-md px-1.5 py-0.5 block mb-1">
              {missed} missed
            </span>
          )}
          <span className={`text-xs font-bold ${attended >= 85 ? 'text-teal' : 'text-gold'}`}>
            {attended}% att.
          </span>
        </div>
        <div className="text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-border mx-4">
        <div
          className={`h-full rounded-sm transition-all duration-500 ${
            attended >= 85 ? 'bg-teal' : 'bg-gold'
          }`}
          style={{ width: `${attended}%` }}
        />
      </div>

      {/* Quick actions (always visible) */}
      <div className="p-3 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onMarkAttendance(student); }}
          className="flex-1 bg-teal text-primary-foreground border-none rounded-xl py-2.5 font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 hover:bg-teal-light transition-colors"
        >
          ✓ Mark Attendance
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate('/attendance?tab=1on1'); }}
          className="flex-1 bg-background text-foreground border border-border rounded-xl py-2.5 font-bold text-sm cursor-pointer flex items-center justify-center gap-1.5 hover:bg-secondary transition-colors"
        >
          📖 Lesson Log
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-3 bg-secondary/30">
          <div className="flex gap-2.5 mb-2.5">
            <div className="flex-1 bg-card rounded-xl p-2 border border-border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Last Lesson</p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {student.lastLesson || 'Not recorded yet'}
              </p>
            </div>
            <div className="flex-1 bg-card rounded-xl p-2 border border-border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pace</p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {student.pace || 'Not set'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/schedules')}
              className="flex-1 bg-card text-sky border border-sky rounded-lg py-1.5 text-xs font-bold cursor-pointer hover:bg-sky/10 transition-colors"
            >
              📅 Schedule
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="flex-1 bg-card text-foreground border border-border rounded-lg py-1.5 text-xs font-bold cursor-pointer hover:bg-secondary transition-colors"
            >
              📊 Reports
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { StudentData };
