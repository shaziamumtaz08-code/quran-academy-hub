import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Clock, User, BookOpen, Users, Loader2, Mail, MapPin, BarChart3, Network, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityLink } from '@/components/shared/EntityLink';
import { UserConnectionsGraph } from '@/components/connections/UserConnectionsGraph';
import { Link } from 'react-router-dom';

const DAYS_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

interface TeacherDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: { id: string; full_name: string; email?: string | null } | null;
}

export function TeacherDetailDrawer({ open, onOpenChange, teacher }: TeacherDetailDrawerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-detail-drawer', teacher?.id],
    queryFn: async () => {
      if (!teacher?.id) return null;

      const now = new Date();
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

      // Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, city')
        .eq('id', teacher.id)
        .maybeSingle();

      // Assigned students with subjects
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
          subject:subjects(name),
          schedules(day_of_week, start_time, duration_minutes, is_active)
        `)
        .eq('teacher_id', teacher.id)
        .eq('status', 'active');

      // Attendance stats this month
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status')
        .eq('teacher_id', teacher.id)
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);

      const total = attendance?.length || 0;
      const present = attendance?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
      const teacherAbsent = attendance?.filter(a => a.status === 'teacher_absent' || a.status === 'teacher_leave').length || 0;

      return {
        profile,
        students: (assignments || []).map((a: any) => ({
          id: a.student?.id,
          name: a.student?.full_name || 'Unknown',
          subject: a.subject?.name || null,
          schedules: (a.schedules || []).filter((s: any) => s.is_active),
        })),
        stats: {
          total,
          present,
          teacherAbsent,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        },
      };
    },
    enabled: open && !!teacher?.id,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-xl">Teacher Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !data ? (
          <p className="text-muted-foreground mt-6">No data found.</p>
        ) : (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="connections" className="gap-1.5"><Network className="h-3.5 w-3.5" />Connections</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5 mt-0">
              {/* Profile Header */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg text-foreground">{data.profile?.full_name || teacher?.full_name}</h3>
                  {data.profile?.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {data.profile.email}
                    </p>
                  )}
                  {(data.profile?.country || data.profile?.city) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {[data.profile.city, data.profile.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Monthly Stats */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> This Month
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center bg-secondary/50 rounded-lg py-2">
                    <p className="text-xl font-black text-foreground">{data.stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total Classes</p>
                  </div>
                  <div className="text-center bg-secondary/50 rounded-lg py-2">
                    <p className="text-xl font-black text-teal">{data.stats.rate}%</p>
                    <p className="text-[10px] text-muted-foreground">Attendance</p>
                  </div>
                  <div className="text-center bg-secondary/50 rounded-lg py-2">
                    <p className="text-xl font-black text-destructive">{data.stats.teacherAbsent}</p>
                    <p className="text-[10px] text-muted-foreground">T. Absent</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assigned Students */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Assigned Students ({data.students.length})
                </h4>
                {data.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students assigned</p>
                ) : (
                  <div className="space-y-3">
                    {data.students.map((s: any) => (
                      <div key={s.id} className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <EntityLink to={`/students?search=${encodeURIComponent(s.name)}`} variant="name" className="text-sm">
                            {s.name}
                          </EntityLink>
                          {s.subject && (
                            <Badge variant="secondary" className="text-[10px]">
                              <BookOpen className="h-3 w-3 mr-1" /> {s.subject}
                            </Badge>
                          )}
                        </div>
                        {s.schedules.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.schedules.map((sch: any, i: number) => (
                              <span key={i} className="text-[10px] bg-card rounded px-1.5 py-0.5 text-muted-foreground border border-border">
                                <Calendar className="h-2.5 w-2.5 inline mr-0.5" />
                                {DAYS_LABELS[sch.day_of_week] || sch.day_of_week} {sch.start_time ? formatTime12h(sch.start_time) : ''}
                                {sch.duration_minutes ? ` (${sch.duration_minutes}m)` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="connections" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Students, classes & co-teachers.</p>
                {teacher && (
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Link to={`/connections/teacher/${teacher.id}`}>
                      Full view <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
              {teacher && <UserConnectionsGraph userId={teacher.id} userType="teacher" compact />}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
