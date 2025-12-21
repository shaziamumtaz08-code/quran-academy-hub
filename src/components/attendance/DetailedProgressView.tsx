import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Target, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

interface DetailedProgressViewProps {
  studentId: string;
  studentName?: string;
  isTeacher?: boolean;
}

interface AttendanceRecord {
  id: string;
  class_date: string;
  lines_completed: number | null;
  variance_reason: string | null;
  status: string;
}

interface StudentProfile {
  id: string;
  full_name: string;
  mushaf_type: string;
  daily_target_lines: number;
}

const MUSHAF_OPTIONS = [
  { value: '15-line', label: '15-Line Mushaf' },
  { value: '13-line', label: '13-Line Mushaf' },
  { value: '16-line', label: '16-Line Mushaf (Indo-Pak)' },
];

const VARIANCE_LABELS: Record<string, string> = {
  slow_pace: 'Slow Pace',
  lack_of_revision: 'Lack of Revision',
  technical_issues: 'Technical Issues',
  student_late: 'Student Late',
  short_verses: 'Short Verses',
};

export function DetailedProgressView({ studentId, studentName, isTeacher = false }: DetailedProgressViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showMushafWarning, setShowMushafWarning] = useState(false);
  const [pendingMushafType, setPendingMushafType] = useState<string | null>(null);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  // Fetch student profile
  const { data: studentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, mushaf_type, daily_target_lines')
        .eq('id', studentId)
        .single();

      if (error) throw error;
      return data as StudentProfile;
    },
    enabled: !!studentId,
  });

  // Fetch attendance records for current month
  const { data: attendanceRecords, isLoading: attendanceLoading } = useQuery({
    queryKey: ['student-attendance', studentId, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, class_date, lines_completed, variance_reason, status')
        .eq('student_id', studentId)
        .gte('class_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('class_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('class_date', { ascending: true });

      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    enabled: !!studentId,
  });

  // Update mushaf type mutation
  const updateMushafMutation = useMutation({
    mutationFn: async (newMushafType: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ mushaf_type: newMushafType })
        .eq('id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Mushaf type has been updated.' });
      queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      setShowMushafWarning(false);
      setPendingMushafType(null);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to update mushaf type',
        variant: 'destructive',
      });
    },
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!attendanceRecords || !studentProfile) {
      return {
        totalLinesCompleted: 0,
        totalMonthlyTarget: 0,
        classesTaken: 0,
        percentage: 0,
        chartData: [],
        varianceSummary: {},
      };
    }

    const presentClasses = attendanceRecords.filter(r => r.status === 'present');
    const classesTaken = presentClasses.length;
    const totalLinesCompleted = presentClasses.reduce((sum, r) => sum + (r.lines_completed || 0), 0);
    const totalMonthlyTarget = classesTaken * (studentProfile.daily_target_lines || 10);
    const percentage = totalMonthlyTarget > 0 ? Math.round((totalLinesCompleted / totalMonthlyTarget) * 100) : 0;

    // Build chart data for all days with classes
    const chartData = presentClasses.map(record => ({
      date: format(parseISO(record.class_date), 'MMM dd'),
      actual: record.lines_completed || 0,
      target: studentProfile.daily_target_lines || 10,
    }));

    // Count variance reasons
    const varianceSummary: Record<string, number> = {};
    presentClasses.forEach(record => {
      if (record.variance_reason) {
        varianceSummary[record.variance_reason] = (varianceSummary[record.variance_reason] || 0) + 1;
      }
    });

    return {
      totalLinesCompleted,
      totalMonthlyTarget,
      classesTaken,
      percentage,
      chartData,
      varianceSummary,
    };
  }, [attendanceRecords, studentProfile]);

  const handleMushafChange = (value: string) => {
    setPendingMushafType(value);
    setShowMushafWarning(true);
  };

  const confirmMushafChange = () => {
    if (pendingMushafType) {
      updateMushafMutation.mutate(pendingMushafType);
    }
  };

  const cancelMushafChange = () => {
    setShowMushafWarning(false);
    setPendingMushafType(null);
  };

  const isLoading = profileLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isOnTarget = stats.percentage >= 100;
  const displayName = studentName || studentProfile?.full_name || 'Student';

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-serif font-bold text-foreground">{stats.totalLinesCompleted}</p>
            <p className="text-sm text-muted-foreground">Lines Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-8 w-8 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-serif font-bold text-foreground">{stats.totalMonthlyTarget}</p>
            <p className="text-sm text-muted-foreground">Monthly Target</p>
          </CardContent>
        </Card>
        <Card className={isOnTarget ? "bg-emerald-light/10 border-emerald-light/20" : "bg-destructive/10 border-destructive/20"}>
          <CardContent className="pt-6 text-center">
            {isOnTarget ? (
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-emerald-light" />
            ) : (
              <TrendingDown className="h-8 w-8 mx-auto mb-2 text-destructive" />
            )}
            <p className={`text-2xl font-serif font-bold ${isOnTarget ? 'text-emerald-light' : 'text-destructive'}`}>
              {stats.percentage}%
            </p>
            <p className={`text-sm ${isOnTarget ? 'text-emerald-light/80' : 'text-destructive/80'}`}>Achievement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-serif font-bold text-foreground">{stats.classesTaken}</p>
            <p className="text-sm text-muted-foreground">Classes This Month</p>
          </CardContent>
        </Card>
      </div>

      {/* Mushaf Settings (Teacher Only) */}
      {isTeacher && studentProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Mushaf Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="space-y-2 flex-1">
                <Label>Mushaf Type</Label>
                <Select 
                  value={pendingMushafType || studentProfile.mushaf_type || '15-line'} 
                  onValueChange={handleMushafChange}
                >
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSHAF_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Daily Target: <span className="font-medium text-foreground">{studentProfile.daily_target_lines} lines</span>
              </div>
            </div>

            {showMushafWarning && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Changing Mushaf Type</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Changing the mushaf type will affect how progress is calculated. 
                    Different mushaf formats have different line counts per page, which 
                    may impact the student's historical progress metrics.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmMushafChange}
                      className="px-3 py-1.5 bg-destructive text-destructive-foreground text-sm rounded-md hover:bg-destructive/90"
                      disabled={updateMushafMutation.isPending}
                    >
                      {updateMushafMutation.isPending ? 'Updating...' : 'Confirm Change'}
                    </button>
                    <button
                      onClick={cancelMushafChange}
                      className="px-3 py-1.5 bg-muted text-muted-foreground text-sm rounded-md hover:bg-muted/80"
                    >
                      Cancel
                    </button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Daily Progress - {format(new Date(), 'MMMM yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.chartData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No attendance data for this month</p>
              <p className="text-sm mt-1">Progress will appear here once classes are recorded</p>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    label={{ value: 'Lines', angle: -90, position: 'insideLeft', className: 'fill-muted-foreground' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="actual" 
                    name="Actual Lines" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="target" 
                    name="Target Lines" 
                    fill="hsl(var(--muted-foreground))" 
                    radius={[4, 4, 0, 0]}
                    opacity={0.4}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Variance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.varianceSummary).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-emerald-light opacity-50" />
              <p className="font-medium">No variance recorded</p>
              <p className="text-sm mt-1">All classes met the daily target</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.varianceSummary)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div 
                    key={reason} 
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <span className="font-medium text-foreground">
                      {VARIANCE_LABELS[reason] || reason}
                    </span>
                    <span className="text-lg font-serif font-bold text-primary">
                      {count} {count === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
