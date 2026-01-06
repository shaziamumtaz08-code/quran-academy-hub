import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { RecentActivity } from './RecentActivity';
import { TodayClasses } from './TodayClasses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, Calendar, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AdminLiveMonitor } from './AdminLiveMonitor';
import { LiveClassQueue } from './LiveClassQueue';
import { AccountabilityReport } from './AccountabilityReport';
import { AccountabilityTrends } from './AccountabilityTrends';
import { IntegrityEngine } from './IntegrityEngine';
import { BehaviorAlerts } from './BehaviorAlerts';

export function AdminDashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch stats from database
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [rolesRes, attendanceRes] = await Promise.all([
        supabase.from('user_roles').select('role'),
        supabase.from('attendance').select('status, class_date'),
      ]);

      const roleCounts = (rolesRes.data || []).reduce((acc, r) => {
        acc[r.role] = (acc[r.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const todayAttendance = (attendanceRes.data || []).filter(a => a.class_date === today);
      const monthAttendance = attendanceRes.data || [];

      return {
        teachers: roleCounts['teacher'] || 0,
        students: roleCounts['student'] || 0,
        classesToday: todayAttendance.length,
        presentToday: todayAttendance.filter(a => a.status === 'present').length,
        totalMonthClasses: monthAttendance.length,
        monthlyAttendanceRate: monthAttendance.length > 0 
          ? Math.round((monthAttendance.filter(a => a.status === 'present').length / monthAttendance.length) * 100)
          : 0,
      };
    },
  });

  // Real activities - empty for now, would come from database
  const activities: { id: string; type: 'attendance' | 'lesson' | 'schedule' | 'payment'; title: string; description: string; time: string }[] = [];

  // Real today classes - empty for now, would come from database
  const todayClasses: { id: string; studentId: string; studentName: string; time: string; duration: number; status: 'pending' | 'present' | 'absent' | 'late' }[] = [];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your academy's performance</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your academy's performance</p>
      </div>

      {/* Stats Grid - Mobile optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Teachers"
          value={stats?.teachers || 0}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Students"
          value={stats?.students || 0}
          icon={GraduationCap}
        />
        <StatCard
          title="Classes Today"
          value={stats?.classesToday || 0}
          icon={Calendar}
        />
        <StatCard
          title="Attendance"
          value={`${stats?.monthlyAttendanceRate || 0}%`}
          icon={TrendingUp}
          variant="gold"
        />
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TodayClasses classes={todayClasses} />
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
              <p className="text-2xl sm:text-3xl font-serif font-bold text-emerald-600 dark:text-emerald-400">{stats?.totalMonthClasses || 0}</p>
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
