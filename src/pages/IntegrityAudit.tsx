import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  Clock, 
  Eye, 
  Timer, 
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Filter,
  Calendar,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { DualStatusIndicator } from '@/components/attendance/DualStatusIndicator';

interface MismatchRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  manualStatus: string;
  zoomDetected: boolean | null;
  zoomDuration: number | null;
  scheduledDuration: number;
  isLate: boolean;
  lateMinutes: number;
  teacherName: string;
  issueType: 'ghosting' | 'time_thief' | 'mismatch' | 'late';
}

export default function IntegrityAudit() {
  const [dateRange, setDateRange] = useState('week');
  const [issueFilter, setIssueFilter] = useState('all');

  const dateRangeStart = useMemo(() => {
    switch (dateRange) {
      case 'today':
        return format(new Date(), 'yyyy-MM-dd');
      case 'week':
        return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      case 'month':
        return format(subDays(new Date(), 30), 'yyyy-MM-dd');
      default:
        return format(subDays(new Date(), 7), 'yyyy-MM-dd');
    }
  }, [dateRange]);

  // Fetch all attendance with zoom log comparison
  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['integrity-audit', dateRangeStart],
    queryFn: async () => {
      // Get attendance records
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select(`
          id,
          student_id,
          teacher_id,
          class_date,
          class_time,
          duration_minutes,
          status,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name)
        `)
        .gte('class_date', dateRangeStart)
        .order('class_date', { ascending: false });

      if (attError) throw attError;

      // Get zoom logs for the same period
      const { data: zoomLogs, error: zoomError } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, session_id, action, join_time, leave_time, total_duration_minutes, timestamp')
        .gte('timestamp', dateRangeStart);

      if (zoomError) throw zoomError;

      // Get session info for late calculation
      const sessionIds = [...new Set(zoomLogs?.map(l => l.session_id) || [])];
      const { data: sessions } = await supabase
        .from('live_sessions')
        .select('id, actual_start, scheduled_start')
        .in('id', sessionIds);

      const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);

      // Build zoom logs by user+date
      const zoomByUserDate = new Map<string, {
        detected: boolean;
        duration: number | null;
        isLate: boolean;
        lateMinutes: number;
      }>();

      zoomLogs?.forEach(log => {
        if (log.action === 'join_intent' || log.action === 'leave') {
          const dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
          const key = `${log.user_id}_${dateKey}`;
          
          const existing = zoomByUserDate.get(key) || {
            detected: false,
            duration: null,
            isLate: false,
            lateMinutes: 0,
          };

          if (log.action === 'join_intent') {
            existing.detected = true;
            
            // Calculate late entry
            const session = sessionMap.get(log.session_id);
            if (session && log.join_time) {
              const sessionStart = new Date(session.actual_start || session.scheduled_start || log.timestamp);
              const joinTime = new Date(log.join_time);
              const lateMinutes = Math.floor((joinTime.getTime() - sessionStart.getTime()) / 60000);
              if (lateMinutes > 10) {
                existing.isLate = true;
                existing.lateMinutes = lateMinutes;
              }
            }
          }

          if (log.action === 'leave' && log.total_duration_minutes) {
            existing.duration = (existing.duration || 0) + log.total_duration_minutes;
          }

          zoomByUserDate.set(key, existing);
        }
      });

      // Build mismatch records
      const records: MismatchRecord[] = [];

      attendance?.forEach(att => {
        const key = `${att.student_id}_${att.class_date}`;
        const zoomData = zoomByUserDate.get(key);

        let issueType: MismatchRecord['issueType'] | null = null;

        // Ghosting: Marked present but no zoom
        if (att.status === 'present' && (!zoomData || !zoomData.detected)) {
          issueType = 'ghosting';
        }
        // Time thief: <80% of scheduled duration
        else if (zoomData?.duration && att.duration_minutes) {
          const percentage = (zoomData.duration / att.duration_minutes) * 100;
          if (percentage < 80) {
            issueType = 'time_thief';
          }
        }
        // Late entry
        else if (zoomData?.isLate) {
          issueType = 'late';
        }
        // General mismatch
        else if (att.status !== 'present' && zoomData?.detected) {
          issueType = 'mismatch';
        }

        // Only add if there's an issue
        if (issueType) {
          records.push({
            id: att.id,
            studentId: att.student_id,
            studentName: att.student?.full_name || 'Unknown',
            date: att.class_date,
            manualStatus: att.status,
            zoomDetected: zoomData?.detected ?? null,
            zoomDuration: zoomData?.duration ?? null,
            scheduledDuration: att.duration_minutes,
            isLate: zoomData?.isLate || false,
            lateMinutes: zoomData?.lateMinutes || 0,
            teacherName: att.teacher?.full_name || 'Unknown',
            issueType,
          });
        }
      });

      return records;
    },
  });

  const filteredData = useMemo(() => {
    if (!auditData) return [];
    if (issueFilter === 'all') return auditData;
    return auditData.filter(r => r.issueType === issueFilter);
  }, [auditData, issueFilter]);

  const stats = useMemo(() => {
    const data = auditData || [];
    return {
      total: data.length,
      ghosting: data.filter(r => r.issueType === 'ghosting').length,
      timeThief: data.filter(r => r.issueType === 'time_thief').length,
      late: data.filter(r => r.issueType === 'late').length,
      mismatch: data.filter(r => r.issueType === 'mismatch').length,
    };
  }, [auditData]);

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'ghosting':
        return <Eye className="h-4 w-4 text-destructive" />;
      case 'time_thief':
        return <Timer className="h-4 w-4 text-orange-500" />;
      case 'late':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'mismatch':
        return <AlertTriangle className="h-4 w-4 text-primary" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getIssueBadge = (type: string) => {
    switch (type) {
      case 'ghosting':
        return <Badge variant="destructive" className="gap-1"><Eye className="h-3 w-3" />Ghosting</Badge>;
      case 'time_thief':
        return <Badge className="gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 border-orange-200"><Timer className="h-3 w-3" />Time Thief</Badge>;
      case 'late':
        return <Badge className="gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 border-amber-200"><Clock className="h-3 w-3" />Late Entry</Badge>;
      case 'mismatch':
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Mismatch</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Integrity Audit</h1>
            <p className="text-muted-foreground mt-1">
              Compare manual attendance with Zoom system evidence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-destructive">{stats.ghosting}</p>
              <p className="text-sm text-destructive/80">Ghosting</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-orange-600">{stats.timeThief}</p>
              <p className="text-sm text-orange-600/80">Time Thieves</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-amber-600">{stats.late}</p>
              <p className="text-sm text-amber-600/80">Late Entries</p>
            </CardContent>
          </Card>
          <Card className="bg-muted text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.mismatch}</p>
              <p className="text-sm text-muted-foreground">Other Mismatches</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={issueFilter} onValueChange={setIssueFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Issue type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Issues</SelectItem>
              <SelectItem value="ghosting">Ghosting</SelectItem>
              <SelectItem value="time_thief">Time Thieves</SelectItem>
              <SelectItem value="late">Late Entries</SelectItem>
              <SelectItem value="mismatch">Mismatches</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audit Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Mismatch Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                <p className="text-lg font-medium">No Issues Found</p>
                <p className="text-sm mt-1">All attendance records match system evidence</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Status Comparison</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(record.date), 'MMM dd, yyyy')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{record.studentName}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.teacherName}
                      </TableCell>
                      <TableCell>
                        <DualStatusIndicator
                          manualStatus={record.manualStatus}
                          zoomDetected={record.zoomDetected}
                          zoomDurationMinutes={record.zoomDuration}
                          scheduledDurationMinutes={record.scheduledDuration}
                          isLateEntry={record.isLate}
                          lateMinutes={record.lateMinutes}
                        />
                      </TableCell>
                      <TableCell>
                        {getIssueBadge(record.issueType)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.issueType === 'ghosting' && 'Marked present but no Zoom log'}
                        {record.issueType === 'time_thief' && `${record.zoomDuration}/${record.scheduledDuration} mins`}
                        {record.issueType === 'late' && `+${record.lateMinutes} mins late`}
                        {record.issueType === 'mismatch' && 'Status doesn\'t match evidence'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
