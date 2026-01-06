import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { BookOpen, GraduationCap, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface CourseCardData {
  id: string;
  courseName: string;
  studentName?: string;
  teacherName?: string;
  lastLesson: string;
  lastLessonDate?: string;
  progress?: number;
}

interface CourseDeckCarouselProps {
  className?: string;
}

export function CourseDeckCarousel({ className }: CourseDeckCarouselProps) {
  const { user, activeRole } = useAuth();
  const isTeacher = activeRole === 'teacher';
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';

  const { data: courses, isLoading } = useQuery({
    queryKey: ['active-courses', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isTeacher) {
        // Get teacher's students
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select(`
            id,
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
            subject:subjects(name)
          `)
          .eq('teacher_id', user.id)
          .eq('status', 'active');

        if (!assignments) return [];

        // Get last lesson for each student
        const coursesData: CourseCardData[] = await Promise.all(
          assignments.map(async (a) => {
            const student = a.student as any;
            const subject = a.subject as any;

            const { data: lastAttendance } = await supabase
              .from('attendance')
              .select('lesson_covered, surah_name, ayah_from, ayah_to, class_date')
              .eq('student_id', student.id)
              .eq('teacher_id', user.id)
              .eq('status', 'present')
              .order('class_date', { ascending: false })
              .limit(1)
              .maybeSingle();

            const lastLesson = lastAttendance
              ? `${lastAttendance.surah_name || 'N/A'}${lastAttendance.ayah_from ? ` - Ayah ${lastAttendance.ayah_from}` : ''}`
              : 'No lessons yet';

            return {
              id: a.id,
              courseName: subject?.name || 'Quran',
              studentName: student.full_name,
              lastLesson,
              lastLessonDate: lastAttendance?.class_date ? format(new Date(lastAttendance.class_date), 'MMM dd') : undefined,
            };
          })
        );

        return coursesData;
      } else if (isStudent || isParent) {
        // Get student's enrollments
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

        if (studentIds.length === 0) return [];

        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select(`
            id,
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
            teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name),
            subject:subjects(name)
          `)
          .in('student_id', studentIds)
          .eq('status', 'active');

        if (!assignments) return [];

        const coursesData: CourseCardData[] = await Promise.all(
          assignments.map(async (a) => {
            const student = a.student as any;
            const teacher = a.teacher as any;
            const subject = a.subject as any;

            const { data: lastAttendance } = await supabase
              .from('attendance')
              .select('lesson_covered, surah_name, ayah_from, ayah_to, class_date')
              .eq('student_id', student.id)
              .eq('status', 'present')
              .order('class_date', { ascending: false })
              .limit(1)
              .maybeSingle();

            const lastLesson = lastAttendance
              ? `${lastAttendance.surah_name || 'N/A'}${lastAttendance.ayah_from ? ` - Ayah ${lastAttendance.ayah_from}` : ''}`
              : 'No lessons yet';

            return {
              id: a.id,
              courseName: subject?.name || 'Quran',
              studentName: isParent ? student.full_name : undefined,
              teacherName: teacher.full_name,
              lastLesson,
              lastLessonDate: lastAttendance?.class_date ? format(new Date(lastAttendance.class_date), 'MMM dd') : undefined,
            };
          })
        );

        return coursesData;
      }

      return [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          Active Courses
        </h3>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-64 flex-shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          Active Courses
        </h3>
        <Card className="bg-secondary/30 border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No active courses found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-accent" />
        Active Courses
      </h3>
      
      <Carousel
        opts={{
          align: 'start',
          loop: courses.length > 3,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {courses.map((course) => (
            <CarouselItem key={course.id} className="pl-2 md:pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3">
              <Card className="h-full bg-gradient-to-br from-card via-card to-primary/5 border-border/50 hover:shadow-card-hover transition-all duration-300 group cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-accent" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </div>
                  
                  <h4 className="font-serif font-bold text-foreground text-lg mb-1">{course.courseName}</h4>
                  
                  {(course.studentName || course.teacherName) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
                      <User className="h-3 w-3" />
                      {course.studentName || course.teacherName}
                    </p>
                  )}
                  
                  <div className="bg-secondary/50 rounded-lg p-2 mt-auto">
                    <p className="text-xs text-muted-foreground mb-1">Last Lesson</p>
                    <p className="text-sm font-medium text-foreground truncate">{course.lastLesson}</p>
                    {course.lastLessonDate && (
                      <p className="text-xs text-muted-foreground mt-1">{course.lastLessonDate}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        {courses.length > 2 && (
          <>
            <CarouselPrevious className="hidden sm:flex -left-4" />
            <CarouselNext className="hidden sm:flex -right-4" />
          </>
        )}
      </Carousel>
    </div>
  );
}
