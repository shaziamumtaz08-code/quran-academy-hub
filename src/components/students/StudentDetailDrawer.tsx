import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, User, BookOpen, Target, CheckSquare, Loader2, FileText, MapPin, ArrowRightLeft, Network, ExternalLink } from 'lucide-react';
import { TransferAssignmentDialog } from './TransferAssignmentDialog';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { UserConnectionsGraph } from '@/components/connections/UserConnectionsGraph';
import { Link } from 'react-router-dom';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAYS_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

// Country code abbreviations for timezone display
const COUNTRY_CODES: Record<string, string> = {
  'Pakistan': 'PK',
  'Canada': 'CA',
  'USA': 'US',
  'UK': 'UK',
  'UAE': 'AE',
  'Saudi Arabia': 'SA',
  'India': 'IN',
  'Australia': 'AU',
};

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

interface StudentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    full_name: string;
    email: string | null;
    subject_name: string | null;
    daily_target_lines: number;
    preferred_unit: string;
    last_lesson: string | null;
    homework: string | null;
  } | null;
  teacherId: string;
}

interface Schedule {
  id: string;
  day_of_week: string;
  teacher_local_time: string;
  student_local_time: string;
  duration_minutes: number;
}

interface StudentProfile {
  age: number | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  registration_id: string | null;
}

interface MonthlyPlan {
  notes: string | null;
  daily_target: number;
  monthly_target: number;
  primary_marker: string;
  status: string;
}

export function StudentDetailDrawer({ 
  open, 
  onOpenChange, 
  student, 
  teacherId
}: StudentDetailDrawerProps) {
  const { user, activeRole } = useAuth();
  const [transferOpen, setTransferOpen] = useState(false);
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  
  // Fetch student's full profile (age, gender, country, city)
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['student-profile-detail', student?.id],
    queryFn: async () => {
      if (!student?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('age, gender, country, city, registration_id')
        .eq('id', student.id)
        .single();
      
      if (error) throw error;
      return data as StudentProfile;
    },
    enabled: !!student?.id && open,
  });

  // Fetch teacher's profile for country code
  const { data: teacherProfile } = useQuery({
    queryKey: ['teacher-profile-detail', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, country, city')
        .eq('id', teacherId)
        .single();
      
      if (error) return null;
      return data as { full_name: string | null; country: string | null; city: string | null };
    },
    enabled: !!teacherId && open,
  });

  // Fetch student's active assignment for this teacher
  const { data: currentAssignment } = useQuery({
    queryKey: ['student-assignment-detail', student?.id, teacherId],
    queryFn: async () => {
      if (!student?.id || !teacherId) return null;
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!student?.id && !!teacherId && open,
  });

  // Fetch student's weekly schedule
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['student-schedules', student?.id, teacherId],
    queryFn: async () => {
      if (!student?.id || !teacherId) return [];
      
      const assignmentId = currentAssignment?.id;
      if (!assignmentId) {
        // fallback: get any assignment
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('id')
          .eq('student_id', student.id)
          .eq('teacher_id', teacherId)
          .maybeSingle();
        if (!assignment) return [];
        const { data } = await supabase
          .from('schedules')
          .select('id, day_of_week, teacher_local_time, student_local_time, duration_minutes')
          .eq('assignment_id', assignment.id)
          .eq('is_active', true);
        return (data || []) as Schedule[];
      }
      
      const { data, error } = await supabase
        .from('schedules')
        .select('id, day_of_week, teacher_local_time, student_local_time, duration_minutes')
        .eq('assignment_id', assignmentId)
        .eq('is_active', true);
      
      if (error) throw error;
      return (data || []) as Schedule[];
    },
    enabled: !!student?.id && !!teacherId && open,
  });

  // Fetch current month's plan
  const { data: monthlyPlan, isLoading: loadingPlan } = useQuery({
    queryKey: ['student-monthly-plan', student?.id, teacherId],
    queryFn: async () => {
      if (!student?.id || !teacherId) return null;
      
      const currentMonth = format(new Date(), 'MMMM');
      const currentYear = format(new Date(), 'yyyy');
      
      const { data, error } = await supabase
        .from('student_monthly_plans')
        .select('notes, daily_target, monthly_target, primary_marker, status')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();
      
      if (error) throw error;
      return data as MonthlyPlan | null;
    },
    enabled: !!student?.id && !!teacherId && open,
  });

  // Build schedule grid map
  const scheduleMap = new Map<string, Schedule>();
  schedules.forEach(s => {
    scheduleMap.set(s.day_of_week, s);
  });

  // Count of scheduled days
  const scheduledDaysCount = scheduleMap.size;

  // Get timezone abbreviations
  const teacherCode = COUNTRY_CODES[teacherProfile?.country || 'Pakistan'] || teacherProfile?.country?.slice(0, 2).toUpperCase() || 'PK';
  const studentCode = COUNTRY_CODES[profile?.country || 'Pakistan'] || profile?.country?.slice(0, 2).toUpperCase() || 'PK';

  const isLoading = loadingProfile || loadingSchedules || loadingPlan;

  if (!student) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-primary" />
            {student.full_name}
          </SheetTitle>
          {profile?.registration_id && (
            <Badge variant="outline" className="w-fit text-xs font-mono mt-1">
              {profile.registration_id}
            </Badge>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="connections" className="gap-1.5"><Network className="h-3.5 w-3.5" />Connections</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-6 mt-0">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Age</p>
                <p className="font-medium">{profile?.age || '-'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Gender</p>
                <p className="font-medium capitalize">{profile?.gender || '-'}</p>
              </div>
              {profile?.city && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {profile.city}, {profile.country}
                  </p>
                </div>
              )}
              {student.subject_name && (
                <div className={`bg-muted/50 rounded-lg p-3 ${!profile?.city ? 'col-span-2' : ''}`}>
                  <p className="text-xs text-muted-foreground mb-1">Subject</p>
                  <p className="font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {student.subject_name}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Weekly Schedule Grid */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly Schedule
                <Badge variant="secondary" className="text-xs ml-auto">
                  {scheduledDaysCount} {scheduledDaysCount === 1 ? 'day' : 'days'}
                </Badge>
              </h3>
              <div className="grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map(day => {
                  const schedule = scheduleMap.get(day);
                  const hasClass = !!schedule;
                  return (
                    <div
                      key={day}
                      className={`text-center p-2 rounded-md border ${
                        hasClass 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      <p className={`text-xs font-medium mb-1 ${hasClass ? 'text-primary' : 'text-muted-foreground'}`}>
                        {DAYS_LABELS[day]}
                      </p>
                      {hasClass && schedule ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold">
                            {formatTime12h(schedule.teacher_local_time)}
                            <span className="text-muted-foreground ml-0.5">({teacherCode})</span>
                          </p>
                          {schedule.student_local_time && schedule.student_local_time !== schedule.teacher_local_time && (
                            <p className="text-[10px] text-muted-foreground">
                              {formatTime12h(schedule.student_local_time)} ({studentCode})
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">-</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Targets */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Targets
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Daily Target</p>
                  <p className="font-medium">{student.daily_target_lines} {student.preferred_unit}</p>
                </div>
                {monthlyPlan && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Monthly Target</p>
                    <p className="font-medium">{monthlyPlan.monthly_target} {monthlyPlan.primary_marker}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Plan Notes */}
            {monthlyPlan?.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Monthly Planner Note
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm">{monthlyPlan.notes}</p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Last Lesson & Homework */}
            <div className="grid gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Last Lesson</p>
                <p className="text-sm">{student.last_lesson || 'No recent lesson'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Homework</p>
                <p className="text-sm">{student.homework || 'No homework assigned'}</p>
              </div>
            </div>

            {/* Transfer / Substitute Button — Admin only */}
            {isAdmin && currentAssignment && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transfer / Assign Substitute
                </Button>
              </>
            )}

            </TabsContent>

            <TabsContent value="connections" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Teachers, parents, courses & siblings.</p>
                {student && (
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Link to={`/connections/student/${student.id}`}>
                      Full view <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
              {student && <UserConnectionsGraph userId={student.id} userType="student" compact />}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>

      {/* Transfer Dialog */}
      {student && currentAssignment && (
        <TransferAssignmentDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          studentId={student.id}
          studentName={student.full_name}
          currentTeacherId={teacherId}
          currentTeacherName={teacherProfile?.full_name || 'Current Teacher'} 
          assignmentId={currentAssignment.id}
        />
      )}
    </Sheet>
  );
}