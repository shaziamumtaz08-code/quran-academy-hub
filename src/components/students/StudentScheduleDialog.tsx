import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

interface Schedule {
  id: string;
  day_of_week: string;
  teacher_local_time: string;
  student_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

export function StudentScheduleDialog({ open, onOpenChange, studentId, studentName }: StudentScheduleDialogProps) {
  // Fetch student's profile for timezone info
  const { data: studentProfile } = useQuery({
    queryKey: ['student-profile-tz', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('country, city')
        .eq('id', studentId)
        .single();
      if (error) return null;
      return data as { country: string | null; city: string | null };
    },
    enabled: open && !!studentId,
  });

  // Fetch student's weekly schedule with teacher info
  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ['student-schedules', studentId],
    queryFn: async () => {
      // First get the assignment ID for this student
      const { data: assignments, error: assignmentError } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id')
        .eq('student_id', studentId);
      
      if (assignmentError) throw assignmentError;
      if (!assignments || assignments.length === 0) return { schedules: [], teacherProfile: null };
      
      const assignmentIds = assignments.map(a => a.id);
      const teacherId = assignments[0]?.teacher_id;
      
      // Get teacher profile for timezone
      let teacherProfile = null;
      if (teacherId) {
        const { data: teacher } = await supabase
          .from('profiles')
          .select('country, city')
          .eq('id', teacherId)
          .single();
        teacherProfile = teacher;
      }
      
      // Then get schedules for those assignments
      const { data, error } = await supabase
        .from('schedules')
        .select('id, day_of_week, teacher_local_time, student_local_time, duration_minutes, is_active')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true)
        .order('day_of_week');
      
      if (error) throw error;
      return { schedules: (data as Schedule[]) || [], teacherProfile };
    },
    enabled: open && !!studentId,
  });

  const schedules = schedulesData?.schedules || [];
  const teacherProfile = schedulesData?.teacherProfile;

  // Sort schedules by day order
  const sortedSchedules = schedules?.sort((a, b) => {
    return DAYS_ORDER.indexOf(a.day_of_week) - DAYS_ORDER.indexOf(b.day_of_week);
  });

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Get timezone abbreviations
  const teacherCode = COUNTRY_CODES[teacherProfile?.country || 'Pakistan'] || teacherProfile?.country?.slice(0, 2).toUpperCase() || 'PK';
  const studentCode = COUNTRY_CODES[studentProfile?.country || 'Canada'] || studentProfile?.country?.slice(0, 2).toUpperCase() || 'CA';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {studentName} - Weekly Schedule
            <Badge variant="secondary" className="ml-auto text-xs">
              {sortedSchedules?.length || 0} {(sortedSchedules?.length || 0) === 1 ? 'day' : 'days'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {studentProfile?.city && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {studentProfile.city}, {studentProfile.country}
          </div>
        )}

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !sortedSchedules || sortedSchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No schedule configured</p>
              <p className="text-sm">Contact admin to set up classes</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {sortedSchedules.map((schedule) => {
                const isToday = schedule.day_of_week.toLowerCase() === today.toLowerCase();
                
                return (
                  <div 
                    key={schedule.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      isToday 
                        ? "bg-primary/10 border-primary/30" 
                        : "bg-card hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm",
                        isToday 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {schedule.day_of_week.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{schedule.day_of_week}</p>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.student_local_time} ({studentCode})
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.teacher_local_time} ({teacherCode})
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {schedule.duration_minutes} min
                      </Badge>
                      {isToday && (
                        <Badge className="bg-primary text-primary-foreground text-xs">Today</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}