import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { RecentActivity } from './RecentActivity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, Calendar, TrendingUp, Layers, BookOpen, UserCheck, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AdminLiveMonitor } from './AdminLiveMonitor';
import { LiveClassQueue } from './LiveClassQueue';
import { AccountabilityReport } from './AccountabilityReport';
import { AccountabilityTrends } from './AccountabilityTrends';
import { IntegrityEngine } from './IntegrityEngine';
import { BehaviorAlerts } from './BehaviorAlerts';
import { HybridTodayTimeline, useActiveBatchesCount } from './HybridTodayTimeline';
import { useDivision } from '@/contexts/DivisionContext';

export function AdminDashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { activeDivision, activeBranch, activeModelType } = useDivision();
  const isOneToOne = activeModelType === 'one_to_one';
  const isGroup = activeModelType === 'group';
  const divisionId = activeDivision?.id;

  // Fetch stats from database filtered by division
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', divisionId],
    queryFn: async () => {
      let assignmentsQuery = supabase.from('student_teacher_assignments').select('student_id, teacher_id').eq('status', 'active');
      let attendanceQuery = supabase.from('attendance').select('status, class_date');
      let coursesQuery = supabase.from('courses').select('id, status').eq('status', 'active');
      let enrollmentsQuery = supabase.from('course_enrollments').select('id').eq('status', 'active');

      if (divisionId) {
        assignmentsQuery = assignmentsQuery.eq('division_id', divisionId);
        attendanceQuery = attendanceQuery.eq('division_id', divisionId);
        coursesQuery = coursesQuery.eq('division_id', divisionId);
      }

      const [assignmentsRes, attendanceRes, coursesResult, enrollmentsRes] = await Promise.all([
        assignmentsQuery,
        attendanceQuery,
        coursesQuery,
        enrollmentsQuery,
      ]);

      const assignments = assignmentsRes.data || [];
      const todayAttendance = (attendanceRes.data || []).filter(a => a.class_date === today);
      const allAttendance = attendanceRes.data || [];
      const courses = coursesResult.data || [];
      const enrollments = enrollmentsRes.data || [];

      return {
        teachers: new Set(assignments.map(a => a.teacher_id)).size,
        students: new Set(assignments.map(a => a.student_id)).size,
        activeAssignments: assignments.length,
        classesToday: todayAttendance.length,
        presentToday: todayAttendance.filter(a => a.status === 'present').length,
        totalMonthClasses: allAttendance.length,
        monthlyAttendanceRate: allAttendance.length > 0
          ? Math.round((allAttendance.filter(a => a.status === 'present').length / allAttendance.length) * 100)
          : 0,
        activeCourses: courses.length,
        totalEnrollments: enrollments.length,
      };
    },
  });

  const activities: { id: string; type: 'attendance' | 'lesson' | 'schedule' | 'payment'; title: string; description: string; time: string }[] = [];
  const { data: activeBatches } = useActiveBatchesCount();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const contextLabel = activeBranch && activeDivision
    ? `${activeBranch.name} — ${activeDivision.name}`
    : 'Dashboard';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
          {isOneToOne ? 'Mentorship Dashboard' : isGroup ? 'Academy Dashboard' : 'Admin Dashboard'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{contextLabel}</p>
      </div>

      {/* Stats Grid - Context-dependent */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {isOneToOne ? (
          <>
            <StatCard title="Students" value={stats?.students || 0} icon={GraduationCap} />
            <StatCard title="Teachers" value={stats?.teachers || 0} icon={Users} variant="primary" />
            <StatCard title="Assignments" value={stats?.activeAssignments || 0} icon={UserCheck} />
            <StatCard title="Sessions Today" value={stats?.classesToday || 0} icon={Calendar} />
            <StatCard title="Attendance" value={`${stats?.monthlyAttendanceRate || 0}%`} icon={TrendingUp} variant="gold" />
          </>
        ) : (
          <>
            <StatCard title="Active Batches" value={stats?.activeCourses || activeBatches || 0} icon={Layers} variant="primary" />
            <StatCard title="Enrollments" value={stats?.totalEnrollments || 0} icon={ClipboardList} />
            <StatCard title="Teachers" value={stats?.teachers || 0} icon={Users} />
            <StatCard title="Classes Today" value={stats?.classesToday || 0} icon={Calendar} />
            <StatCard title="Attendance" value={`${stats?.monthlyAttendanceRate || 0}%`} icon={TrendingUp} variant="gold" />
          </>
        )}
      </div>

      {/* Live Monitor Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveClassQueue />
        <AdminLiveMonitor />
      </div>

      {/* Integrity Engine + Behavior Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IntegrityEngine />
        <BehaviorAlerts />
      </div>

      {/* Hybrid Today Timeline */}
      <HybridTodayTimeline />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AccountabilityReport />
        <RecentActivity activities={activities} />
      </div>

      {/* Accountability Trends Charts */}
      <AccountabilityTrends />

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-serif font-bold text-primary">{stats?.monthlyAttendanceRate || 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">Attendance Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-serif font-bold text-accent">{stats?.totalMonthClasses || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Classes Recorded</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-serif font-bold text-accent">{stats?.presentToday || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Present Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-serif font-bold text-foreground">{stats?.students || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Active Students</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
