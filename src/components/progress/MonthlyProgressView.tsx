import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { CalendarDays, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlyProgressViewProps {
  studentId: string;
  dailyTarget: number;
  month?: Date;
}

interface DayStatus {
  date: Date;
  achieved: number;
  metTarget: boolean;
  hasVariance: boolean;
  varianceReason: string | null;
  status: 'met' | 'variance' | 'no-class' | 'future';
}

export function MonthlyProgressView({ studentId, dailyTarget, month = new Date() }: MonthlyProgressViewProps) {
  const startDate = startOfMonth(month);
  const endDate = endOfMonth(month);
  const today = new Date();

  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['monthly-attendance', studentId, format(month, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('class_date, lines_completed, raw_input_amount, variance_reason, status')
        .eq('student_id', studentId)
        .eq('status', 'present')
        .gte('class_date', format(startDate, 'yyyy-MM-dd'))
        .lte('class_date', format(endDate, 'yyyy-MM-dd'));

      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });

  const dayStatuses: DayStatus[] = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(date => {
      const isFuture = date > today;
      const attendance = attendanceData?.find(a => 
        isSameDay(parseISO(a.class_date), date)
      );

      if (isFuture) {
        return {
          date,
          achieved: 0,
          metTarget: false,
          hasVariance: false,
          varianceReason: null,
          status: 'future' as const,
        };
      }

      if (!attendance) {
        return {
          date,
          achieved: 0,
          metTarget: false,
          hasVariance: false,
          varianceReason: null,
          status: 'no-class' as const,
        };
      }

      const achieved = attendance.raw_input_amount || attendance.lines_completed || 0;
      const metTarget = achieved >= dailyTarget;
      const hasVariance = !!attendance.variance_reason;

      return {
        date,
        achieved: Number(achieved),
        metTarget,
        hasVariance,
        varianceReason: attendance.variance_reason,
        status: metTarget ? 'met' as const : 'variance' as const,
      };
    });
  }, [attendanceData, dailyTarget, startDate, endDate, today]);

  const stats = useMemo(() => {
    const classHeld = dayStatuses.filter(d => d.status === 'met' || d.status === 'variance');
    const metCount = dayStatuses.filter(d => d.status === 'met').length;
    const varianceCount = dayStatuses.filter(d => d.status === 'variance').length;
    
    return {
      totalClasses: classHeld.length,
      metTarget: metCount,
      withVariance: varianceCount,
      percentage: classHeld.length > 0 ? Math.round((metCount / classHeld.length) * 100) : 0,
    };
  }, [dayStatuses]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Monthly Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Monthly Progress - {format(month, 'MMMM yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/30 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-light">{stats.metTarget}</p>
            <p className="text-xs text-muted-foreground">Target Met</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{stats.withVariance}</p>
            <p className="text-xs text-muted-foreground">Below Target</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.percentage}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before start of month */}
          {Array.from({ length: startDate.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          
          {/* Day cells */}
          {dayStatuses.map((day, i) => (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors",
                day.status === 'met' && "bg-emerald-light/20 text-emerald-light",
                day.status === 'variance' && "bg-destructive/20 text-destructive",
                day.status === 'no-class' && "bg-secondary/50 text-muted-foreground",
                day.status === 'future' && "bg-muted/30 text-muted-foreground/50"
              )}
              title={
                day.status === 'met' 
                  ? `Target met: ${day.achieved}` 
                  : day.status === 'variance' 
                  ? `Below target: ${day.achieved} (${day.varianceReason || 'No reason'})` 
                  : day.status === 'no-class'
                  ? 'No class'
                  : 'Upcoming'
              }
            >
              <span className="font-medium">{format(day.date, 'd')}</span>
              {day.status === 'met' && <CheckCircle className="h-3 w-3 mt-0.5" />}
              {day.status === 'variance' && <AlertTriangle className="h-3 w-3 mt-0.5" />}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-light/20 border border-emerald-light" />
            <span className="text-muted-foreground">Target Met</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive" />
            <span className="text-muted-foreground">Below Target</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-secondary/50 border border-border" />
            <span className="text-muted-foreground">No Class</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
