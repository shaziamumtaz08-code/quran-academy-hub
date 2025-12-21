import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { RecentActivity } from './RecentActivity';
import { TodayClasses } from './TodayClasses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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

  const mockActivities = [
    { id: '1', type: 'attendance' as const, title: 'Attendance System', description: 'Ready for marking', time: 'Active' },
    { id: '2', type: 'lesson' as const, title: 'Lessons Module', description: 'Track student progress', time: 'Active' },
    { id: '3', type: 'payment' as const, title: 'Fee Management', description: 'Coming soon', time: 'Pending' },
  ];

  const mockTodayClasses = [
    { id: '1', studentName: 'No classes loaded', time: '-', duration: 0, status: 'pending' as const },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your academy's performance</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your academy's performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Teachers"
          value={stats?.teachers || 0}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Total Students"
          value={stats?.students || 0}
          icon={GraduationCap}
        />
        <StatCard
          title="Classes Today"
          value={stats?.classesToday || 0}
          icon={Calendar}
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats?.monthlyAttendanceRate || 0}%`}
          icon={TrendingUp}
          variant="gold"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayClasses classes={mockTodayClasses} />
        <RecentActivity activities={mockActivities} />
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-serif font-bold text-primary">{stats?.monthlyAttendanceRate || 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">Attendance Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-serif font-bold text-emerald-light">{stats?.totalMonthClasses || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Classes Recorded</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-serif font-bold text-teal">{stats?.presentToday || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Present Today</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-serif font-bold text-accent">{stats?.students || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Active Students</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
