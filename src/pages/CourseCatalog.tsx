import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Search, Users, GraduationCap, ArrowRight, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function CourseCatalog() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['public-course-catalog'],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, name, description, level, start_date, max_students, seo_slug, hero_image_url, pricing, tags, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .eq('website_enabled', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: enrollCounts } = useQuery({
    queryKey: ['catalog-enrollment-counts'],
    enabled: !!courses?.length,
    queryFn: async () => {
      const ids = courses!.map(c => c.id);
      const { data } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .in('course_id', ids)
        .eq('status', 'active');
      const counts = new Map<string, number>();
      data?.forEach(e => counts.set(e.course_id, (counts.get(e.course_id) || 0) + 1));
      return counts;
    },
  });

  const levels = Array.from(new Set(courses?.map(c => c.level).filter(Boolean) || []));

  const filtered = (courses || []).filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase());
    const matchLevel = levelFilter === 'all' || c.level === levelFilter;
    return matchSearch && matchLevel;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={() => navigate('/')}>
              ← Home
            </Button>
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-bold mb-3">Course Catalog</h1>
          <p className="text-lg text-white/70 max-w-2xl">Browse our courses and start your learning journey today</p>

          {/* Search + Filter */}
          <div className="flex gap-3 mt-8 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <Input
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            {levels.length > 1 && (
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium"
              >
                <option value="all">All Levels</option>
                {levels.map(l => <option key={l} value={l!}>{l}</option>)}
              </select>
            )}
          </div>
        </div>
      </header>

      {/* Course Grid */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">No courses found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((course) => {
              const pricing = (course.pricing || {}) as any;
              const enrolled = enrollCounts?.get(course.id) || 0;
              const teacher = (course as any).teacher?.full_name || 'Instructor';
              const subject = (course as any).subject?.name;

              return (
                <div
                  key={course.id}
                  onClick={() => navigate(`/course/${course.seo_slug || course.id}`)}
                  className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer"
                >
                  {/* Color bar */}
                  <div className="h-1.5 bg-gradient-to-r from-primary to-accent" />

                  {/* Hero image placeholder */}
                  {course.hero_image_url ? (
                    <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `url(${course.hero_image_url})` }} />
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-primary/20" />
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {course.level && <Badge variant="outline" className="text-[10px]">{course.level}</Badge>}
                      {subject && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{subject}</Badge>}
                    </div>

                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {course.name}
                    </h3>

                    {course.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {teacher}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {enrolled}</span>
                      </div>
                      {pricing.amount ? (
                        <span className="text-sm font-black text-primary">
                          {pricing.currency || '$'}{pricing.amount}<span className="text-[10px] font-normal text-muted-foreground">/{pricing.period || 'mo'}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground">Free</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
