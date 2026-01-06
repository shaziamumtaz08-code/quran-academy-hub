import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Award } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface AccountabilityTrendsProps {
  className?: string;
}

export function AccountabilityTrends({ className }: AccountabilityTrendsProps) {
  const { data: trendsData, isLoading } = useQuery({
    queryKey: ['accountability-trends'],
    queryFn: async () => {
      const days = 30;
      const dailyLateMinutes: { date: string; avgLateMinutes: number }[] = [];
      const teacherPunctuality: Map<string, { onTime: number; total: number; name: string }> = new Map();

      // Fetch attendance logs for last 30 days
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();

      const { data: logs, error } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, session_id, join_time, total_duration_minutes, timestamp')
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (error) throw error;
      if (!logs || logs.length === 0) {
        return { dailyTrend: [], topTeachers: [] };
      }

      // Get session details for actual_start times
      const sessionIds = [...new Set(logs.map(l => l.session_id))];
      const { data: sessions } = await supabase
        .from('live_sessions')
        .select('id, teacher_id, actual_start')
        .in('id', sessionIds);

      const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);

      // Get all teacher IDs and fetch their profiles
      const teacherIds = [...new Set(sessions?.map(s => s.teacher_id) || [])];
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      const teacherMap = new Map(teachers?.map(t => [t.id, t.full_name]) || []);

      // Get user roles to identify teachers in logs
      const userIds = [...new Set(logs.map(l => l.user_id))];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Calculate daily late minutes
      const dailyData: Map<string, { totalLateMinutes: number; count: number }> = new Map();

      logs.forEach(log => {
        const session = sessionMap.get(log.session_id);
        if (!session?.actual_start || !log.join_time) return;

        const sessionStart = new Date(session.actual_start);
        const joinTime = new Date(log.join_time);
        const lateMinutes = Math.max(0, Math.floor((joinTime.getTime() - sessionStart.getTime()) / 60000));

        const dateKey = format(new Date(log.timestamp), 'MMM dd');
        
        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, { totalLateMinutes: 0, count: 0 });
        }
        const day = dailyData.get(dateKey)!;
        day.totalLateMinutes += lateMinutes;
        day.count += 1;

        // Track teacher punctuality
        const isTeacher = roleMap.get(log.user_id) === 'teacher' || session.teacher_id === log.user_id;
        if (isTeacher) {
          const teacherId = log.user_id;
          const teacherName = teacherMap.get(teacherId) || 'Unknown';
          
          if (!teacherPunctuality.has(teacherId)) {
            teacherPunctuality.set(teacherId, { onTime: 0, total: 0, name: teacherName });
          }
          const record = teacherPunctuality.get(teacherId)!;
          record.total += 1;
          if (lateMinutes <= 5) {
            record.onTime += 1;
          }
        }
      });

      // Build daily trend (last 14 days for display)
      for (let i = 13; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateKey = format(date, 'MMM dd');
        const data = dailyData.get(dateKey);
        
        dailyLateMinutes.push({
          date: dateKey,
          avgLateMinutes: data && data.count > 0 
            ? Math.round((data.totalLateMinutes / data.count) * 10) / 10 
            : 0,
        });
      }

      // Get top 5 punctual teachers
      const topTeachers = Array.from(teacherPunctuality.entries())
        .filter(([_, record]) => record.total >= 3) // At least 3 sessions
        .map(([id, record]) => ({
          id,
          name: record.name,
          punctualityRate: Math.round((record.onTime / record.total) * 100),
          sessions: record.total,
        }))
        .sort((a, b) => b.punctualityRate - a.punctualityRate)
        .slice(0, 5);

      return { dailyTrend: dailyLateMinutes, topTeachers };
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const chartColors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(142, 76%, 36%)',
    'hsl(221, 83%, 53%)',
    'hsl(271, 91%, 65%)',
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${className}`}>
      {/* Average Late Minutes Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Average Late Minutes (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendsData?.dailyTrend && trendsData.dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendsData.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }} 
                  interval="preserveStartEnd"
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }} 
                  className="text-muted-foreground"
                  label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [`${value} mins`, 'Avg Late']}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgLateMinutes" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--accent))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Punctual Teachers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-500" />
            Top 5 Punctual Teachers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendsData?.topTeachers && trendsData.topTeachers.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart 
                data={trendsData.topTeachers} 
                layout="vertical"
                margin={{ left: 60, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  width={55}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value}% (${props.payload.sessions} sessions)`, 
                    'On-Time Rate'
                  ]}
                />
                <Bar dataKey="punctualityRate" radius={[0, 4, 4, 0]}>
                  {trendsData.topTeachers.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              Not enough data to show top teachers yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
