import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, parseISO } from 'date-fns';
import { BarChart3 } from 'lucide-react';

interface WeeklyProgressChartProps {
  studentId: string;
  dailyTarget: number;
  markerLabel?: string;
}

export function WeeklyProgressChart({ studentId, dailyTarget, markerLabel = 'Lines' }: WeeklyProgressChartProps) {
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['weekly-progress', studentId],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = subDays(today, 6);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('class_date, lines_completed, raw_input_amount, input_unit, progress_marker')
        .eq('student_id', studentId)
        .eq('status', 'present')
        .gte('class_date', format(weekAgo, 'yyyy-MM-dd'))
        .lte('class_date', format(today, 'yyyy-MM-dd'))
        .order('class_date', { ascending: true });

      if (error) throw error;

      // Create a map for each day of the week
      const dayMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        dayMap[date] = 0;
      }

      // Fill in actual values
      (data || []).forEach(record => {
        const date = record.class_date;
        if (dayMap.hasOwnProperty(date)) {
          // Use raw_input_amount if available, otherwise lines_completed
          const amount = record.raw_input_amount || record.lines_completed || 0;
          dayMap[date] = Number(amount);
        }
      });

      return Object.entries(dayMap).map(([date, achieved]) => ({
        date,
        day: format(parseISO(date), 'EEE'),
        achieved,
        target: dailyTarget,
      }));
    },
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Weekly Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!weeklyData || weeklyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Weekly Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No attendance data for this week</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Weekly Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <XAxis 
                dataKey="day" 
                axisLine={false}
                tickLine={false}
                fontSize={12}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                fontSize={12}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="font-medium">{format(parseISO(data.date), 'MMM dd')}</p>
                        <p className="text-sm text-primary">
                          Achieved: {data.achieved} {markerLabel}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Target: {data.target} {markerLabel}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine 
                y={dailyTarget} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5" 
                label={{ value: 'Target', position: 'right', fontSize: 10 }}
              />
              <Bar 
                dataKey="achieved" 
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Daily Achievement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-primary border-dashed border-t-2 border-primary" />
            <span className="text-muted-foreground">Target ({dailyTarget} {markerLabel})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
