import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { StatCard } from './StatCard';
import { RecentActivity } from './RecentActivity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, GraduationCap, Calendar, Shield, UserCheck, BookOpen, Settings, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export function SuperAdminDashboard() {
  // Fetch counts from database
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const [profilesRes, rolesRes, attendanceRes, examsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
        supabase.from('attendance').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
      ]);

      const roleCounts = (rolesRes.data || []).reduce((acc, r) => {
        acc[r.role] = (acc[r.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalUsers: profilesRes.count || 0,
        teachers: roleCounts['teacher'] || 0,
        students: roleCounts['student'] || 0,
        admins: (roleCounts['admin'] || 0) + (roleCounts['super_admin'] || 0) + 
                (roleCounts['admin_admissions'] || 0) + (roleCounts['admin_fees'] || 0) + 
                (roleCounts['admin_academic'] || 0),
        attendanceRecords: attendanceRes.count || 0,
        examsCompleted: examsRes.count || 0,
      };
    },
  });

  // Real activity would come from database - showing empty for now
  const activities: { id: string; type: 'attendance' | 'lesson' | 'schedule' | 'payment'; title: string; description: string; time: string }[] = [];

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Complete system overview and management</p>
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete system overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Teachers"
          value={stats?.teachers || 0}
          icon={UserCheck}
        />
        <StatCard
          title="Students"
          value={stats?.students || 0}
          icon={GraduationCap}
        />
        <StatCard
          title="Admins"
          value={stats?.admins || 0}
          icon={Shield}
          variant="gold"
        />
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-base sm:text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              <div className="text-center p-3 sm:p-4 bg-secondary/50 rounded-lg">
                <p className="text-xl sm:text-3xl font-serif font-bold text-primary">{stats?.attendanceRecords || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Attendance Records</p>
              </div>
              <div className="text-center p-3 sm:p-4 bg-secondary/50 rounded-lg">
                <p className="text-xl sm:text-3xl font-serif font-bold text-accent">{stats?.examsCompleted || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Exams Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <RecentActivity activities={activities} />
      </div>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Link to="/user-management" className="p-4 bg-secondary/50 rounded-lg text-center hover:bg-secondary transition-colors">
              <Users className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">User Management</p>
            </Link>
            <Link to="/attendance" className="p-4 bg-secondary/50 rounded-lg text-center hover:bg-secondary transition-colors">
              <Calendar className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">Attendance</p>
            </Link>
            <Link to="/exam-results" className="p-4 bg-secondary/50 rounded-lg text-center hover:bg-secondary transition-colors">
              <BookOpen className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">Exam Results</p>
            </Link>
            <Link to="/teachers" className="p-4 bg-secondary/50 rounded-lg text-center hover:bg-secondary transition-colors">
              <UserCheck className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium text-foreground">Teachers</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
