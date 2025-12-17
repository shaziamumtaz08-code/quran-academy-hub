import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Users, Calendar, CheckCircle, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeacherKPI {
  id: string;
  teacherName: string;
  studentsAssigned: number;
  totalClasses: number;
  classesDelivered: number;
  averageAttendance: number;
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
}

const mockKPIs: TeacherKPI[] = [
  { id: '1', teacherName: 'Sheikh Ahmad Hassan', studentsAssigned: 8, totalClasses: 96, classesDelivered: 94, averageAttendance: 96, overallScore: 4.9, trend: 'up' },
  { id: '2', teacherName: 'Ustadh Ibrahim Ali', studentsAssigned: 6, totalClasses: 72, classesDelivered: 68, averageAttendance: 88, overallScore: 4.2, trend: 'down' },
  { id: '3', teacherName: 'Sheikh Muhammad Omar', studentsAssigned: 10, totalClasses: 120, classesDelivered: 118, averageAttendance: 94, overallScore: 4.7, trend: 'stable' },
  { id: '4', teacherName: 'Ustadha Fatima Khan', studentsAssigned: 5, totalClasses: 60, classesDelivered: 59, averageAttendance: 97, overallScore: 4.8, trend: 'up' },
];

export default function KPI() {
  const [selectedMonth, setSelectedMonth] = React.useState('december-2024');

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-emerald-light';
    if (score >= 4.0) return 'text-accent';
    return 'text-destructive';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-emerald-light" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <div className="w-4 h-0.5 bg-muted-foreground rounded" />;
    }
  };

  // Calculate overall stats
  const avgScore = (mockKPIs.reduce((sum, k) => sum + k.overallScore, 0) / mockKPIs.length).toFixed(1);
  const totalClasses = mockKPIs.reduce((sum, k) => sum + k.classesDelivered, 0);
  const avgAttendance = Math.round(mockKPIs.reduce((sum, k) => sum + k.averageAttendance, 0) / mockKPIs.length);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Teacher KPI</h1>
            <p className="text-muted-foreground mt-1">Monitor teacher performance and metrics</p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="december-2024">December 2024</SelectItem>
              <SelectItem value="november-2024">November 2024</SelectItem>
              <SelectItem value="october-2024">October 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-primary text-primary-foreground rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
                <Star className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm opacity-80">Average Score</p>
                <p className="text-2xl font-serif font-bold">{avgScore}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <Users className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
                <p className="text-2xl font-serif font-bold text-foreground">{mockKPIs.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <Calendar className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Classes Delivered</p>
                <p className="text-2xl font-serif font-bold text-foreground">{totalClasses}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-2xl font-serif font-bold text-foreground">{avgAttendance}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mockKPIs.map((kpi) => {
            const deliveryRate = Math.round((kpi.classesDelivered / kpi.totalClasses) * 100);
            
            return (
              <div key={kpi.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-soft transition-shadow">
                {/* Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-serif font-bold text-primary">
                          {kpi.teacherName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold text-foreground">{kpi.teacherName}</h3>
                        <p className="text-sm text-muted-foreground">{kpi.studentsAssigned} students assigned</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(kpi.trend)}
                      <div className="text-right">
                        <p className={cn("text-2xl font-serif font-bold", getScoreColor(kpi.overallScore))}>
                          {kpi.overallScore}
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xl font-serif font-bold text-foreground">{kpi.totalClasses}</p>
                      <p className="text-xs text-muted-foreground">Scheduled</p>
                    </div>
                    <div>
                      <p className="text-xl font-serif font-bold text-primary">{kpi.classesDelivered}</p>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                    </div>
                    <div>
                      <p className="text-xl font-serif font-bold text-accent">{kpi.averageAttendance}%</p>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                    </div>
                  </div>

                  {/* Delivery Rate Progress */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Class Delivery Rate</span>
                      <span className="text-sm font-medium text-foreground">{deliveryRate}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${deliveryRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Attendance Progress */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Student Attendance</span>
                      <span className="text-sm font-medium text-foreground">{kpi.averageAttendance}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${kpi.averageAttendance}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
