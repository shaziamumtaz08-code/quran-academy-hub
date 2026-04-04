import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Search, Play, Clock, Star, ShoppingCart, ArrowLeft } from 'lucide-react';

export default function RecordedCourses() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');

  // Fetch courses that have recorded content (course_lessons with video_url)
  const { data: courses, isLoading } = useQuery({
    queryKey: ['recorded-courses'],
    queryFn: async () => {
      // Get courses with at least one video lesson
      const { data: lessons } = await supabase
        .from('course_lessons')
        .select('course_id')
        .not('video_url', 'is', null)
        .limit(100);

      if (!lessons?.length) return [];

      const courseIds = [...new Set(lessons.map(l => l.course_id))];

      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, name, description, level, hero_image_url, pricing, seo_slug, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .in('id', courseIds)
        .eq('website_enabled', true)
        .eq('status', 'active');

      if (!coursesData?.length) return [];

      // Get lesson counts per course
      const { data: allLessons } = await supabase
        .from('course_lessons')
        .select('course_id, id')
        .in('course_id', courseIds);

      const lessonCounts = new Map<string, number>();
      allLessons?.forEach(l => lessonCounts.set(l.course_id, (lessonCounts.get(l.course_id) || 0) + 1));

      return coursesData.map(c => ({
        ...c,
        lessonCount: lessonCounts.get(c.id) || 0,
        teacher: (c as any).teacher?.full_name || 'Instructor',
        subject: (c as any).subject?.name || '',
        pricing: (c.pricing || {}) as any,
      }));
    },
  });

  const filtered = (courses || []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-[hsl(var(--navy))] to-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <Play className="w-8 h-8 text-accent" />
            <h1 className="text-3xl md:text-4xl font-serif font-bold">Recorded Courses</h1>
          </div>
          <p className="text-lg text-white/70 max-w-2xl mb-6">Learn at your own pace with our library of recorded lessons</p>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              placeholder="Search recorded courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
        </div>
      </header>

      {/* Course Grid */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : !filtered.length ? (
          <div className="text-center py-20">
            <Play className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">No recorded courses available</h3>
            <p className="text-sm text-muted-foreground mt-1">Check back soon for new content</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/courses-catalog')}>
              Browse Live Courses →
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((course) => (
              <div
                key={course.id}
                className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/course/${course.seo_slug || course.id}`)}
              >
                {/* Thumbnail */}
                {course.hero_image_url ? (
                  <div className="relative h-44 bg-cover bg-center" style={{ backgroundImage: `url(${course.hero_image_url})` }}>
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-6 h-6 text-primary ml-1" />
                      </div>
                    </div>
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-black/60 text-white border-0 text-[10px]">
                        <Play className="w-2.5 h-2.5 mr-1" /> {course.lessonCount} lessons
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="relative h-44 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <Play className="w-12 h-12 text-primary/20" />
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline" className="text-[10px]">
                        {course.lessonCount} lessons
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-2.5">
                  <div className="flex gap-2">
                    {course.level && <Badge variant="outline" className="text-[10px]">{course.level}</Badge>}
                    {course.subject && <Badge className="bg-accent/10 text-accent border-0 text-[10px]">{course.subject}</Badge>}
                  </div>

                  <h3 className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {course.name}
                  </h3>

                  <p className="text-[11px] text-muted-foreground">{course.teacher}</p>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    {course.pricing.amount ? (
                      <span className="text-base font-black text-primary">
                        {course.pricing.currency || '$'}{course.pricing.amount}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-teal">Free</span>
                    )}
                    <Button size="sm" variant="outline" className="text-[11px] h-7">
                      {isAuthenticated ? 'Start Learning' : 'View Course'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-primary/5 border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Al-Quran Time Academy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
