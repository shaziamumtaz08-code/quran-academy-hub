import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';

const ACADEMIC_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'courses', icon: '📖', label: 'Courses', path: '/courses' },
  { id: 'teachers', icon: '👨‍🏫', label: 'Teachers', path: '/teachers' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

export function AcademicAdminDashboard() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['academic-admin-dashboard'],
    queryFn: async () => {
      // Active courses
      const { count: activeCourses } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Active assignments
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student_id, teacher_id')
        .eq('status', 'active');

      const totalAssignments = assignments?.length || 0;
      const teacherIds = [...new Set((assignments || []).map(a => a.teacher_id))];
      const studentIds = [...new Set((assignments || []).map(a => a.student_id))];

      // Attendance in last 7 days for lesson log rate + stalled students
      const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const { data: recentAttendance } = await supabase
        .from('attendance')
        .select('student_id, teacher_id, class_date')
        .gte('class_date', sevenDaysAgo);

      const attendanceRecords = recentAttendance || [];

      // Teacher lesson log rate = teachers with at least 1 attendance record in 7 days / total teachers
      const teachersWithLogs = new Set(attendanceRecords.map(a => a.teacher_id));
      const lessonLogRate = teacherIds.length > 0
        ? Math.round((teachersWithLogs.size / teacherIds.length) * 100)
        : 0;

      // Stalled students = students with assignment but no attendance in 7+ days
      const studentsWithAttendance = new Set(attendanceRecords.map(a => a.student_id));
      const stalledCount = studentIds.filter(id => !studentsWithAttendance.has(id)).length;

      // Attendance marking rate = assignments with at least 1 record / total assignments
      const attendanceRate = totalAssignments > 0
        ? Math.round((studentsWithAttendance.size / studentIds.length) * 100)
        : 0;

      return {
        activeCourses: activeCourses || 0,
        stalledCount,
        lessonLogRate,
        attendanceRate,
      };
    },
  });

  const quickActions = [
    { icon: '👨‍🏫', label: 'Assign Teacher', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/assignments') },
    { icon: '📖', label: 'Create Course', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/courses') },
    { icon: '📅', label: 'Upload Plan', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/monthly-planning') },
    { icon: '📊', label: 'View Reports', bg: 'bg-primary/10', textColor: 'text-primary', border: 'border-primary/15', onClick: () => navigate('/reports') },
  ];

  const leftContent = (
    <>
      {/* Stalled Students */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">⚠️ Stalled Students</p>
        <p className="text-[11px] text-muted-foreground">Students with no progress in 7+ days</p>
        <div className="text-center py-4">
          {(stats?.stalledCount || 0) > 0 ? (
            <p className="text-2xl font-black text-destructive">{stats!.stalledCount}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No stalled students detected</p>
          )}
        </div>
      </div>

      {/* Course Health */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📖 Course Health</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-teal/10 rounded-xl py-2.5">
            <p className="text-xl font-black text-teal">{stats?.activeCourses || 0}</p>
            <p className="text-[10px] text-muted-foreground">Active Courses</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-foreground">{stats?.attendanceRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">Active Students</p>
          </div>
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* Teacher Performance */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">👨‍🏫 Teacher Performance</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-sky">{stats?.lessonLogRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">Lesson Log Rate</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-gold">{stats?.attendanceRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">Attendance Rate</p>
          </div>
        </div>
      </div>

      <QuickActionsGrid actions={quickActions} />
    </>
  );

  return (
    <DashboardShell tabs={ACADEMIC_TABS} leftContent={leftContent} rightContent={rightContent} brandLabel="AQA" />
  );
}
