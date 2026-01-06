import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { TrendingUp, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface QuickStatusWidgetsProps {
  className?: string;
}

export function QuickStatusWidgets({ className }: QuickStatusWidgetsProps) {
  const { user, activeRole } = useAuth();
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';
  const currentMonth = new Date();

  const { data: statusData } = useQuery({
    queryKey: ['quick-status', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return null;

      let studentIds: string[] = [];

      if (isStudent) {
        studentIds = [user.id];
      } else if (isParent) {
        const { data: links } = await supabase
          .from('student_parent_links')
          .select('student_id')
          .eq('parent_id', user.id);
        studentIds = (links || []).map(l => l.student_id);
      }

      if (studentIds.length === 0) return null;

      // Get attendance for current month
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, student_id')
        .in('student_id', studentIds)
        .gte('class_date', startDate)
        .lte('class_date', endDate);

      const totalClasses = attendance?.length || 0;
      const presentClasses = attendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
      const attendanceRate = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

      // Get fee status for current month
      const { data: fees } = await supabase
        .from('student_fees')
        .select('status, amount_paid, monthly_fee')
        .in('student_id', studentIds)
        .eq('month', format(currentMonth, 'MM'))
        .eq('year', format(currentMonth, 'yyyy'));

      const feeStatus = fees && fees.length > 0 
        ? fees.every(f => f.status === 'paid') ? 'paid' : 'pending'
        : 'pending';

      return {
        attendanceRate,
        feeStatus,
        totalClasses,
        presentClasses,
      };
    },
    enabled: !!user?.id && (isStudent || isParent),
  });

  if (!statusData) return null;

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {/* Attendance Gauge */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 shadow-sm">
        <div className="relative w-8 h-8">
          <svg className="w-8 h-8 transform -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="12"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-secondary"
            />
            <circle
              cx="16"
              cy="16"
              r="12"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${statusData.attendanceRate * 0.754} 75.4`}
              className={cn(
                statusData.attendanceRate >= 80 ? 'text-emerald-500' :
                statusData.attendanceRate >= 60 ? 'text-accent' : 'text-destructive'
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground leading-tight">Attendance</span>
          <span className={cn(
            'text-sm font-bold leading-tight',
            statusData.attendanceRate >= 80 ? 'text-emerald-500' :
            statusData.attendanceRate >= 60 ? 'text-accent' : 'text-destructive'
          )}>
            {statusData.attendanceRate}%
          </span>
        </div>
      </div>

      {/* Fee Status Badge */}
      <div className={cn(
        'flex items-center gap-2 rounded-full px-4 py-2 shadow-sm border',
        statusData.feeStatus === 'paid' 
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      )}>
        {statusData.feeStatus === 'paid' ? (
          <>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 leading-tight">Fee Status</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-tight">Paid</span>
            </div>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-red-500" />
            <div className="flex flex-col">
              <span className="text-xs text-red-600 dark:text-red-400 leading-tight">Fee Status</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400 leading-tight">Pending</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
