import React from 'react';
import { StatCard } from './StatCard';
import { RecentActivity } from './RecentActivity';
import { TodayClasses } from './TodayClasses';
import { Users, GraduationCap, Calendar, DollarSign, TrendingUp } from 'lucide-react';

const mockStats = {
  teachers: 12,
  students: 48,
  classesToday: 24,
  monthlyRevenue: 4800,
};

const mockActivities = [
  { id: '1', type: 'attendance' as const, title: 'Attendance Marked', description: 'Sheikh Ahmad marked attendance for Muhammad Ali', time: '10 min ago' },
  { id: '2', type: 'lesson' as const, title: 'Lesson Completed', description: 'Surah Al-Fatiha revision completed by Sara', time: '25 min ago' },
  { id: '3', type: 'payment' as const, title: 'Payment Received', description: 'Monthly fee received from Ahmed Hassan', time: '1 hour ago' },
  { id: '4', type: 'schedule' as const, title: 'Schedule Updated', description: 'New class scheduled for Yusuf Khan', time: '2 hours ago' },
];

const mockTodayClasses = [
  { id: '1', studentName: 'Muhammad Ali', time: '09:00 AM', duration: 30, status: 'present' as const },
  { id: '2', studentName: 'Sara Ahmed', time: '10:00 AM', duration: 45, status: 'present' as const },
  { id: '3', studentName: 'Yusuf Khan', time: '11:30 AM', duration: 30, status: 'pending' as const },
  { id: '4', studentName: 'Fatima Hassan', time: '02:00 PM', duration: 30, status: 'pending' as const },
];

export function AdminDashboard() {
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
          value={mockStats.teachers}
          icon={Users}
          trend={{ value: 8, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Total Students"
          value={mockStats.students}
          icon={GraduationCap}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Classes Today"
          value={mockStats.classesToday}
          icon={Calendar}
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${mockStats.monthlyRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 5, isPositive: true }}
          variant="gold"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayClasses classes={mockTodayClasses} />
        <RecentActivity activities={mockActivities} />
      </div>

      {/* Quick Stats */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-serif text-xl font-bold text-foreground mb-6">Monthly Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-serif font-bold text-primary">96%</p>
            <p className="text-sm text-muted-foreground mt-1">Attendance Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-serif font-bold text-emerald-light">720</p>
            <p className="text-sm text-muted-foreground mt-1">Classes Delivered</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-serif font-bold text-teal">85%</p>
            <p className="text-sm text-muted-foreground mt-1">Fee Collection</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-serif font-bold text-accent">4.8</p>
            <p className="text-sm text-muted-foreground mt-1">Avg KPI Score</p>
          </div>
        </div>
      </div>
    </div>
  );
}
