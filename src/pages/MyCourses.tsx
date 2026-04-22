import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import CourseThumbnailCard from '@/components/courses/CourseThumbnailCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

export default function MyCourses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeDivision } = useDivision();

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['my-courses-page', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('course_enrollments')
        .select(`
          id,
          status,
          enrolled_at,
          course_id,
          courses:courses!inner(
            id,
            name,
            level,
            thumbnail_url,
            hero_image_url,
            division_id,
            divisions:divisions(name),
            subject:subjects!courses_subject_id_fkey(name)
          )
        `)
        .eq('student_id', user.id)
        .in('status', ['active', 'completed']);

      if (activeDivision?.id) {
        query = query.eq('courses.division_id', activeDivision.id);
      }

      const { data, error } = await query.order('enrolled_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const groupedCourses = useMemo(() => {
    return enrollments.reduce<Record<string, any[]>>((acc, enrollment: any) => {
      const divisionName = enrollment.courses?.divisions?.name || 'Courses';
      if (!acc[divisionName]) acc[divisionName] = [];
      acc[divisionName].push(enrollment);
      return acc;
    }, {});
  }, [enrollments]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">My Courses</h1>
        <p className="text-sm text-muted-foreground">Open any course to enter its full workspace.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-medium text-foreground">No courses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your enrolled courses will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCourses).map(([divisionName, items]) => (
            <section key={divisionName} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{divisionName}</h2>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((enrollment: any) => {
                  const course = enrollment.courses;
                  return (
                    <CourseThumbnailCard
                      key={enrollment.id}
                      course={{
                        id: course.id,
                        name: course.name,
                        level: course.level,
                        thumbnail_url: course.thumbnail_url,
                        hero_image_url: course.hero_image_url,
                        subject_name: course.subject?.name || divisionName,
                        status: enrollment.status === 'completed' ? 'closed' : 'open',
                      }}
                      ctaLabel="Open Course"
                      onClick={() => navigate(`/my-courses/${course.id}`)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}