import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, User, ChevronDown, ChevronRight, Loader2, AlertCircle, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAYS_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const TIMEZONES = [
  { value: 'America/Toronto', label: 'Canada (Toronto) EST/EDT', offset: -5 },
  { value: 'America/New_York', label: 'USA (New York) EST/EDT', offset: -5 },
  { value: 'America/Los_Angeles', label: 'USA (Los Angeles) PST/PDT', offset: -8 },
  { value: 'Europe/London', label: 'UK (London) GMT/BST', offset: 0 },
  { value: 'Asia/Karachi', label: 'Pakistan (Karachi) PKT', offset: 5 },
  { value: 'Asia/Dubai', label: 'UAE (Dubai) GST', offset: 4 },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh) AST', offset: 3 },
  { value: 'Asia/Kolkata', label: 'India (Mumbai) IST', offset: 5.5 },
  { value: 'Australia/Sydney', label: 'Australia (Sydney) AEST', offset: 10 },
];

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string;
  student_name: string;
  subject_name: string | null;
  student_timezone: string | null;
  teacher_timezone: string | null;
}

interface Schedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

// Helper to calculate teacher time from student time based on timezone offsets
function calculateTeacherTime(studentTime: string, studentTz: string, teacherTz: string): string {
  const studentOffset = TIMEZONES.find(tz => tz.value === studentTz)?.offset ?? 0;
  const teacherOffset = TIMEZONES.find(tz => tz.value === teacherTz)?.offset ?? 0;
  
  const [hours, minutes] = studentTime.split(':').map(Number);
  const studentMinutesFromMidnight = hours * 60 + minutes;
  
  // Convert student time to UTC, then to teacher time
  const offsetDiffMinutes = (teacherOffset - studentOffset) * 60;
  let teacherMinutesFromMidnight = studentMinutesFromMidnight + offsetDiffMinutes;
  
  // Handle day wrap
  if (teacherMinutesFromMidnight < 0) teacherMinutesFromMidnight += 24 * 60;
  if (teacherMinutesFromMidnight >= 24 * 60) teacherMinutesFromMidnight -= 24 * 60;
  
  const teacherHours = Math.floor(teacherMinutesFromMidnight / 60);
  const teacherMins = teacherMinutesFromMidnight % 60;
  
  return `${teacherHours.toString().padStart(2, '0')}:${teacherMins.toString().padStart(2, '0')}`;
}

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [newSchedule, setNewSchedule] = useState({
    assignmentId: '',
    day: '',
    studentTime: '',
    studentTimezone: 'America/Toronto',
    teacherTimezone: 'Asia/Karachi',
    duration: '30',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current day of week
  const todayDayName = format(new Date(), 'EEEE').toLowerCase();

  // Fetch assignments with timezone info
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['assignments-with-tz'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          student_timezone,
          teacher_timezone,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name),
          subject:subjects(name)
        `);

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
        subject_name: row.subject?.name || null,
        student_timezone: row.student_timezone,
        teacher_timezone: row.teacher_timezone,
      })) as Assignment[];
    },
  });

  // Fetch schedules
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['class-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as Schedule[];
    },
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: {
      assignment_id: string;
      day_of_week: string;
      student_local_time: string;
      teacher_local_time: string;
      duration_minutes: number;
    }) => {
      const { error } = await supabase
        .from('schedules')
        .insert(scheduleData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({ title: 'Success', description: 'Schedule created successfully' });
      setIsDialogOpen(false);
      setNewSchedule({
        assignmentId: '',
        day: '',
        studentTime: '',
        studentTimezone: 'America/Toronto',
        teacherTimezone: 'Asia/Karachi',
        duration: '30',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Get schedules for an assignment
  const getSchedulesForAssignment = (assignmentId: string) => {
    return schedules.filter(s => s.assignment_id === assignmentId);
  };

  // Check if student has class today
  const hasClassToday = (assignmentId: string) => {
    return schedules.some(s => s.assignment_id === assignmentId && s.day_of_week === todayDayName);
  };

  // Get today's class time for assignment
  const getTodaysClass = (assignmentId: string) => {
    return schedules.find(s => s.assignment_id === assignmentId && s.day_of_week === todayDayName);
  };

  // Toggle expanded row
  const toggleExpanded = (assignmentId: string) => {
    setExpandedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
      }
      return newSet;
    });
  };

  // Calculate teacher time when student time changes
  const calculatedTeacherTime = useMemo(() => {
    if (!newSchedule.studentTime) return '';
    return calculateTeacherTime(
      newSchedule.studentTime,
      newSchedule.studentTimezone,
      newSchedule.teacherTimezone
    );
  }, [newSchedule.studentTime, newSchedule.studentTimezone, newSchedule.teacherTimezone]);

  // When assignment is selected, pre-fill timezones
  const handleAssignmentSelect = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setNewSchedule(prev => ({
      ...prev,
      assignmentId,
      studentTimezone: assignment?.student_timezone || 'America/Toronto',
      teacherTimezone: assignment?.teacher_timezone || 'Asia/Karachi',
    }));
  };

  const handleAddSchedule = () => {
    if (!newSchedule.assignmentId || !newSchedule.day || !newSchedule.studentTime) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    createScheduleMutation.mutate({
      assignment_id: newSchedule.assignmentId,
      day_of_week: newSchedule.day,
      student_local_time: newSchedule.studentTime,
      teacher_local_time: calculatedTeacherTime,
      duration_minutes: parseInt(newSchedule.duration),
    });
  };

  const isLoading = loadingAssignments || loadingSchedules;
  const hasAssignments = assignments.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Class Schedules</h1>
            <p className="text-muted-foreground mt-1">Manage class schedules with timezone support</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" disabled={!hasAssignments}>
                <Plus className="h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif">Add New Schedule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Assignment Selection */}
                <div className="space-y-2">
                  <Label>Student–Teacher Assignment *</Label>
                  <Select value={newSchedule.assignmentId} onValueChange={handleAssignmentSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((assignment) => (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          {assignment.student_name} → {assignment.teacher_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Day Selection */}
                <div className="space-y-2">
                  <Label>Day of Week *</Label>
                  <Select value={newSchedule.day} onValueChange={(value) => setNewSchedule(prev => ({ ...prev, day: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day} value={day}>{DAYS_LABELS[day]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone Section */}
                <Card className="bg-secondary/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Timezone Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Student Timezone */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Student Time Zone</Label>
                      <Select 
                        value={newSchedule.studentTimezone} 
                        onValueChange={(value) => setNewSchedule(prev => ({ ...prev, studentTimezone: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Student Time Input */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Student Local Time *</Label>
                      <Input
                        type="time"
                        value={newSchedule.studentTime}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, studentTime: e.target.value }))}
                      />
                    </div>

                    {/* Teacher Timezone */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Teacher Time Zone</Label>
                      <Select 
                        value={newSchedule.teacherTimezone} 
                        onValueChange={(value) => setNewSchedule(prev => ({ ...prev, teacherTimezone: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Auto-calculated Teacher Time */}
                    {calculatedTeacherTime && (
                      <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Teacher's Local Time (Auto-calculated)</p>
                        <p className="text-lg font-bold text-primary">
                          {formatTime12h(calculatedTeacherTime)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Duration */}
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={newSchedule.duration} onValueChange={(value) => setNewSchedule(prev => ({ ...prev, duration: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSchedule} disabled={createScheduleMutation.isPending}>
                  {createScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Schedule
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* No Assignments Warning */}
        {!hasAssignments && !isLoading && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-accent" />
                <div>
                  <p className="font-medium text-foreground">No Student–Teacher Assignments</p>
                  <p className="text-sm text-muted-foreground">
                    Create assignments in the Assignments module before scheduling classes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master Schedule Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No schedules available</p>
              <p className="text-sm mt-1">Assignments must exist before creating schedules</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Scheduled Today?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const isExpanded = expandedAssignments.has(assignment.id);
                  const assignmentSchedules = getSchedulesForAssignment(assignment.id);
                  const scheduledToday = hasClassToday(assignment.id);
                  const todaysClass = getTodaysClass(assignment.id);

                  return (
                    <React.Fragment key={assignment.id}>
                      <TableRow className="hover:bg-secondary/30">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleExpanded(assignment.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{assignment.student_name}</span>
                          </span>
                        </TableCell>
                        <TableCell>{assignment.teacher_name}</TableCell>
                        <TableCell>
                          {assignmentSchedules.length > 0 ? (
                            <Badge variant="default" className="bg-emerald-light/20 text-emerald-light border-emerald-light/30">
                              {assignmentSchedules.length} class{assignmentSchedules.length > 1 ? 'es' : ''}/week
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Scheduled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {todaysClass ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTime12h(todaysClass.student_local_time)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {scheduledToday ? (
                            <Badge className="bg-emerald-light text-white">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Weekly Calendar */}
                      {isExpanded && (
                        <TableRow className="bg-secondary/20">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm text-muted-foreground">Weekly Schedule</h4>
                              <div className="grid grid-cols-7 gap-2">
                                {DAYS_OF_WEEK.map((day) => {
                                  const daySchedule = assignmentSchedules.find(s => s.day_of_week === day);
                                  const isToday = day === todayDayName;

                                  return (
                                    <Card 
                                      key={day} 
                                      className={`p-3 text-center ${isToday ? 'ring-2 ring-primary' : ''} ${daySchedule ? 'bg-primary/10 border-primary/30' : 'bg-muted/30'}`}
                                    >
                                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {DAYS_LABELS[day].slice(0, 3)}
                                      </p>
                                      {daySchedule ? (
                                        <div>
                                          <p className="text-sm font-bold text-foreground">
                                            {formatTime12h(daySchedule.student_local_time)}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {daySchedule.duration_minutes}min
                                          </p>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">—</p>
                                      )}
                                    </Card>
                                  );
                                })}
                              </div>
                              {assignment.student_timezone && assignment.teacher_timezone && (
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                  <span><Globe className="h-3 w-3 inline mr-1" />Student: {assignment.student_timezone}</span>
                                  <span><Globe className="h-3 w-3 inline mr-1" />Teacher: {assignment.teacher_timezone}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
