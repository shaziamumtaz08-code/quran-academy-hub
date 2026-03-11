import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';
import { StatsRowCompact } from './shared/StatsRowCompact';

const PARENT_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'children', icon: '👩‍🎓', label: 'Children', path: '/students' },
  { id: 'fees', icon: '💰', label: 'Fees', path: '/payments' },
  { id: 'schedule', icon: '📅', label: 'Schedule', path: '/schedules' },
];

interface ChildData {
  id: string;
  full_name: string;
  teacher: string | null;
  totalClasses: number;
  attended: number;
  attendanceRate: number;
  currentLesson: string;
  homework: string;
  recentLessons: Array<{ date: string; lesson: string; homework: string; status: string }>;
}

export function ParentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [activeChildIdx, setActiveChildIdx] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard-v2', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: links } = await supabase
        .from('student_parent_links')
        .select('student_id, student:profiles!student_parent_links_student_id_fkey(id, full_name)')
        .eq('parent_id', user.id);

      if (!links?.length) return { children: [] };

      const childrenData: ChildData[] = await Promise.all(
        links.map(async (link) => {
          const studentId = link.student_id;
          const studentName = (link.student as any)?.full_name || 'Unknown';

          const { data: attendance } = await supabase
            .from('attendance')
            .select('status, class_date, lesson_covered, homework, surah_name, ayah_from')
            .eq('student_id', studentId)
            .order('class_date', { ascending: false });

          const { data: teacherAssignment } = await supabase
            .from('student_teacher_assignments')
            .select('teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();

          const records = attendance || [];
          const present = records.filter(a => a.status === 'present').length;
          const latestPresent = records.find(a => a.status === 'present');
          const currentLesson = latestPresent
            ? `${latestPresent.surah_name || latestPresent.lesson_covered || 'N/A'}${latestPresent.ayah_from ? ` Ayah ${latestPresent.ayah_from}` : ''}`
            : 'No lessons yet';

          return {
            id: studentId,
            full_name: studentName,
            teacher: (teacherAssignment?.teacher as any)?.full_name || null,
            totalClasses: records.length,
            attended: present,
            attendanceRate: records.length > 0 ? Math.round((present / records.length) * 100) : 0,
            currentLesson,
            homework: latestPresent?.homework || 'No homework',
            recentLessons: records.slice(0, 3).map(a => ({
              date: format(new Date(a.class_date), 'MMM dd'),
              lesson: a.lesson_covered || 'No lesson recorded',
              homework: a.homework || 'No homework',
              status: a.status,
            })),
          };
        })
      );

      return { children: childrenData };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const children = data?.children || [];
  if (!children.length) {
    return (
      <DashboardShell tabs={PARENT_TABS} brandLabel="AQA"
        leftContent={
          <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground">
            <p className="text-lg font-bold">No children linked</p>
            <p className="text-xs mt-1">Contact an administrator to link your children.</p>
          </div>
        }
        rightContent={null}
      />
    );
  }

  const child = children[activeChildIdx] || children[0];

  const leftContent = (
    <>
      {/* Child toggle tabs */}
      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setActiveChildIdx(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${idx === activeChildIdx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-secondary'}`}
            >
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Current Lesson */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-1.5">📖 Current Lesson</p>
        <p className="text-[15px] font-extrabold text-foreground">{child.currentLesson}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">📝 {child.homework}</p>
      </div>

      {/* Recent Lessons */}
      <div>
        <p className="text-[13px] font-extrabold text-foreground mb-2">📋 Recent Lessons</p>
        {(!child.recentLessons.length) ? (
          <div className="bg-card rounded-xl border border-border p-4 text-center text-muted-foreground">
            <p className="text-xs">No lessons recorded yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {child.recentLessons.map((lesson, idx) => (
              <div key={idx} className="px-3 py-2.5 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${lesson.status === 'present' ? 'bg-teal/10 text-teal' : 'bg-destructive/10 text-destructive'}`}>
                  {lesson.status === 'present' ? '✅' : '❌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">{lesson.lesson}</p>
                  <p className="text-[11px] text-muted-foreground truncate">📝 {lesson.homework}</p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{lesson.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* Attendance Badge */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📊 Attendance</p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black ${child.attendanceRate >= 85 ? 'text-teal' : child.attendanceRate >= 60 ? 'text-gold' : 'text-destructive'}`}>
            {child.attendanceRate}%
          </span>
          <p className="text-xs text-muted-foreground">{child.attended} of {child.totalClasses} classes</p>
        </div>
      </div>

      {/* Teacher Card */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2">👨‍🏫 Teacher</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {(child.teacher || 'N')[0]}
          </div>
          <p className="font-bold text-[15px] text-foreground">{child.teacher || 'Not assigned'}</p>
        </div>
      </div>

      {/* Fee Status */}
      <div className="bg-card rounded-2xl border border-gold/20 p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2">💰 Fee Status</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-black text-gold">Pending</p>
            <p className="text-[11px] text-muted-foreground">Check fee details</p>
          </div>
          <button
            onClick={() => navigate('/payments')}
            className="bg-gold/10 text-gold border border-gold/15 rounded-xl px-3 py-1.5 font-bold text-xs hover:opacity-90 transition-opacity"
          >
            View Fees →
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsRowCompact
        title={`📈 ${child.full_name}'s Stats`}
        stats={[
          { value: child.totalClasses, label: 'Total', sub: 'Classes', color: 'text-teal' },
          { value: child.attended, label: 'Attended', sub: 'Present', color: 'text-sky' },
          { value: `${child.attendanceRate}%`, label: 'Rate', sub: 'Attendance', color: 'text-gold' },
        ]}
      />
    </>
  );

  return (
    <DashboardShell
      tabs={PARENT_TABS}
      leftContent={leftContent}
      rightContent={rightContent}
      brandLabel="AQA"
    />
  );
}
