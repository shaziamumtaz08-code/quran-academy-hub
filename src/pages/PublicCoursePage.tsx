import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, Clock, Users, Globe, Star, ChevronDown, ChevronRight,
  CheckCircle, MessageCircle, Calendar, GraduationCap, ArrowLeft,
  Mail, Phone, MapPin, Play, CreditCard, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FAQ { question: string; answer: string; }
interface Outcome { text: string; }
interface Pricing { amount?: number; currency?: string; period?: string; }
interface ContactInfo { email?: string; phone?: string; whatsapp?: string; }

export default function PublicCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  const { data: course, isLoading } = useQuery({
    queryKey: ['public-course', slug],
    queryFn: async () => {
      let q = supabase.from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .eq('website_enabled', true)
        .eq('status', 'active');

      const { data: bySlug } = await q.eq('seo_slug', slug!).maybeSingle();
      if (bySlug) return bySlug;

      const { data: byId } = await supabase.from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .eq('id', slug!)
        .eq('website_enabled', true)
        .eq('status', 'active')
        .maybeSingle();
      return byId;
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['public-course-modules', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { data } = await supabase.from('course_modules').select('*, lessons:course_lessons(id, title, content_type)')
        .eq('course_id', course!.id).order('sort_order');
      return data || [];
    },
  });

  const { data: syllabus } = useQuery({
    queryKey: ['public-course-syllabus', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { data } = await supabase.from('syllabi')
        .select('id, rows, duration_weeks, sessions_week')
        .eq('course_id', course!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const { data: enrollmentCount = 0 } = useQuery({
    queryKey: ['public-enrollment-count', course?.id],
    enabled: !!course?.id,
    queryFn: async () => {
      const { count } = await supabase.from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', course!.id).eq('status', 'active');
      return count || 0;
    },
  });

  const { data: relatedCourses = [] } = useQuery({
    queryKey: ['related-courses', course?.subject_id],
    enabled: !!course?.subject_id,
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, seo_slug, teacher:profiles!courses_teacher_id_fkey(full_name)')
        .eq('website_enabled', true).eq('status', 'active')
        .eq('subject_id', course!.subject_id!)
        .neq('id', course!.id).limit(3);
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <h2 className="text-xl font-semibold">Course Not Found</h2>
          <p className="text-muted-foreground">This course may not be available or has been removed.</p>
          <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const outcomes: Outcome[] = Array.isArray(course.outcomes) ? (course.outcomes as unknown as Outcome[]) : [];
  const faqs: FAQ[] = Array.isArray(course.faqs) ? (course.faqs as unknown as FAQ[]) : [];
  const pricing = (course.pricing || {}) as Pricing;
  const contactInfo = (course.contact_info || {}) as ContactInfo;
  const syllabusLines = (course.syllabus_text || '').split('\n').filter(Boolean);

  const syllabusRows: any[] = syllabus?.rows
    ? (typeof syllabus.rows === 'string' ? JSON.parse(syllabus.rows) : syllabus.rows)
    : [];

  const handleApply = () => {
    navigate(`/apply/${course.seo_slug || course.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav bar */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>Sign In</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.15),transparent_70%)]" />
        {course.hero_image_url && (
          <img src={course.hero_image_url as string} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
        )}
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            {(course as any).subject?.name && (
              <Badge className="bg-white/15 text-white border-0">{(course as any).subject.name}</Badge>
            )}
            <Badge className="bg-white/15 text-white border-0">{course.level}</Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">{course.name}</h1>
          {course.description && (
            <p className="text-lg text-white/80 mb-8 max-w-2xl">{course.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <GraduationCap className="h-4 w-4" /> {(course as any).teacher?.full_name}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-white/70">
              <Users className="h-4 w-4" /> {enrollmentCount} enrolled
            </span>
            {pricing.amount ? (
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <CreditCard className="h-4 w-4" /> {pricing.currency || '$'}{pricing.amount}/{pricing.period || 'month'}
              </span>
            ) : null}
            {course.start_date && (
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <Calendar className="h-4 w-4" /> Starts {format(new Date(course.start_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <Button size="lg" className="h-12 px-8 text-base" onClick={handleApply}>
            Apply Now <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* What you'll learn */}
      {outcomes.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xl font-semibold mb-6">What you'll learn</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/40">
                <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-sm">{o.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Curriculum — Teaching OS syllabus OR modules OR text syllabus */}
      {(syllabusRows.length > 0 || modules.length > 0 || syllabusLines.length > 0) && (
        <section className="bg-muted/30 py-12">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-xl font-semibold mb-6">Curriculum</h2>

            {syllabusRows.length > 0 ? (
              <div className="space-y-2">
                {syllabusRows.map((row: any, i: number) => (
                  <Card key={i} className="border-border/40">
                    <CardContent className="p-4 flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {row.week || i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{row.topic}</p>
                        {row.objectives && (
                          <p className="text-xs text-muted-foreground mt-1">{row.objectives}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : modules.length > 0 ? (
              <div className="space-y-3">
                {modules.map((mod: any, i: number) => (
                  <Card key={mod.id} className="border-border/40">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{i + 1}</span>
                        {mod.title}
                        <Badge variant="outline" className="ml-auto text-xs">{mod.lessons?.length || 0} lessons</Badge>
                      </CardTitle>
                    </CardHeader>
                    {mod.lessons?.length > 0 && (
                      <CardContent className="px-4 pb-4 pt-0">
                        <ul className="space-y-1 ml-9">
                          {mod.lessons.map((l: any) => (
                            <li key={l.id} className="text-sm text-muted-foreground flex items-center gap-2">
                              <Play className="h-3 w-3" /> {l.title}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {syllabusLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <span className="text-sm">{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Instructor */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold mb-6">Your Instructor</h2>
        <Card className="border-border/40">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
              {((course as any).teacher?.full_name || 'T').charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold">{(course as any).teacher?.full_name}</h3>
              <p className="text-sm text-muted-foreground">Expert Instructor</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="bg-muted/30 py-12">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <Card key={i} className="border-border/40 cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between min-h-[44px]">
                      <h4 className="font-medium text-sm pr-4">{faq.question}</h4>
                      {openFaq === i ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    </div>
                    {openFaq === i && <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/40">{faq.answer}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Courses */}
      {relatedCourses.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xl font-semibold mb-6">Related Courses</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {relatedCourses.map((rc: any) => (
              <Card key={rc.id} className="cursor-pointer hover:shadow-md transition-shadow border-border/40"
                onClick={() => navigate(`/course/${rc.seo_slug || rc.id}`)}>
                <div className="h-1.5 bg-gradient-to-r from-accent to-primary" />
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm">{rc.name}</h3>
                  <p className="text-xs text-muted-foreground">{rc.teacher?.full_name}</p>
                  <Badge variant="outline" className="text-xs">{rc.level}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {(contactInfo.email || contactInfo.phone || contactInfo.whatsapp) && (
        <section className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-muted/50 rounded-2xl p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold">Need Help?</h2>
            <p className="text-muted-foreground text-sm">Contact us for any queries about this course</p>
            <div className="flex justify-center gap-4 flex-wrap">
              {contactInfo.email && (
                <Button variant="outline" asChild><a href={`mailto:${contactInfo.email}`}><Mail className="h-4 w-4 mr-2" /> {contactInfo.email}</a></Button>
              )}
              {contactInfo.whatsapp && (
                <Button variant="outline" asChild><a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank"><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</a></Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CTA Footer */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to Start Learning?</h2>
          <p className="text-white/70 max-w-xl mx-auto">Join {enrollmentCount}+ students already enrolled in this course</p>
          <Button size="lg" className="h-12 px-10 text-base" onClick={handleApply}>
            Apply Now <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary/5 border-t border-border/40 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Al-Quran Time Academy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
