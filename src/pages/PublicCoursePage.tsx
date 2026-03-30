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
  Mail, Phone, MapPin, Play
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

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['public-course', slug],
    queryFn: async () => {
      // Try by slug first, then by ID
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
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Nav bar */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground border-b border-primary/20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="font-serif font-bold text-lg hidden sm:block">Al-Quran Time Academy</span>
          <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>Sign In</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.15),transparent_70%)]" />
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-3 space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-accent/20 text-accent border-accent/30">{course.level}</Badge>
                {(course as any).subject?.name && (
                  <Badge variant="outline" className="border-white/20 text-white/90">{(course as any).subject.name}</Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-serif font-bold leading-tight">{course.name}</h1>
              {course.description && <p className="text-lg text-white/80 leading-relaxed max-w-2xl">{course.description}</p>}
              <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                <span className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> {(course as any).teacher?.full_name}</span>
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {enrollmentCount} enrolled</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Starts {format(new Date(course.start_date), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex gap-3 pt-2">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 shadow-xl">
                  Enroll Now
                </Button>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <MessageCircle className="h-4 w-4 mr-2" /> Contact Us
                </Button>
              </div>
            </div>
            {/* Pricing Card */}
            <div className="md:col-span-2">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-2xl">
                <CardContent className="p-6 space-y-4">
                  {pricing.amount ? (
                    <div className="text-center space-y-1">
                      <p className="text-4xl font-bold">{pricing.currency || '$'}{pricing.amount}</p>
                      <p className="text-sm text-white/60">/{pricing.period || 'month'}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-2xl font-bold">Contact for Pricing</p>
                    </div>
                  )}
                  <Separator className="bg-white/20" />
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Live interactive sessions</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Expert instructor</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Course materials included</li>
                    <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-accent" /> Certificate of completion</li>
                  </ul>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                    Enroll Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Key Outcomes */}
        {outcomes.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">What You'll Learn</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {outcomes.map((o, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/40">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm">{o.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Syllabus */}
        {(syllabusLines.length > 0 || modules.length > 0) && (
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Course Syllabus</h2>
            {modules.length > 0 ? (
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
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <span className="text-sm">{line}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Instructor */}
        <section>
          <h2 className="text-2xl font-serif font-bold mb-6">Your Instructor</h2>
          <Card className="border-border/40">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {((course as any).teacher?.full_name || 'T').charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{(course as any).teacher?.full_name}</h3>
                <p className="text-sm text-muted-foreground">Expert Instructor</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* FAQs */}
        {faqs.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <Card key={i} className="border-border/40 cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{faq.question}</h4>
                      {openFaq === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    {openFaq === i && <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/40">{faq.answer}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Related Courses */}
        {relatedCourses.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Related Courses</h2>
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

        {/* Contact / Support */}
        {(contactInfo.email || contactInfo.phone || contactInfo.whatsapp) && (
          <section className="bg-muted/50 rounded-2xl p-8 text-center space-y-4">
            <h2 className="text-2xl font-serif font-bold">Need Help?</h2>
            <p className="text-muted-foreground">Contact us for any queries about this course</p>
            <div className="flex justify-center gap-4 flex-wrap">
              {contactInfo.email && (
                <Button variant="outline" asChild><a href={`mailto:${contactInfo.email}`}><Mail className="h-4 w-4 mr-2" /> {contactInfo.email}</a></Button>
              )}
              {contactInfo.whatsapp && (
                <Button variant="outline" asChild><a href={`https://wa.me/${contactInfo.whatsapp}`} target="_blank"><MessageCircle className="h-4 w-4 mr-2" /> WhatsApp</a></Button>
              )}
            </div>
          </section>
        )}

        {/* CTA Footer */}
        <section className="bg-primary text-primary-foreground rounded-2xl p-8 md:p-12 text-center space-y-4">
          <h2 className="text-3xl font-serif font-bold">Ready to Start Learning?</h2>
          <p className="text-white/70 max-w-xl mx-auto">Join {enrollmentCount}+ students already enrolled in this course</p>
          <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-10 shadow-xl">
            Enroll Now
          </Button>
        </section>
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
