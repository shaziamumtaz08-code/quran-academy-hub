import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CourseThumbnailCard from '@/components/courses/CourseThumbnailCard';

interface AvailableCoursesSectionProps {
  activeDivision: string;
}

export default function AvailableCoursesSection({ activeDivision }: AvailableCoursesSectionProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [applyingCourseId, setApplyingCourseId] = useState<string | null>(null);

  const { data: availableCourses = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['dash-available-courses', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('courses')
        .select('id, name, level, description, division_id, hero_image_url, thumbnail_url, max_students, divisions:divisions(name), subject:subjects!courses_subject_id_fkey(name), auto_enroll_enabled')
        .eq('status', 'published');

      if (activeDivision !== 'all') {
        query = query.eq('division_id', activeDivision);
      }

      const { data: allCourses } = await query;
      if (!allCourses?.length) return [];

      const { data: enrolled } = await supabase.from('course_enrollments')
        .select('course_id')
        .eq('student_id', user!.id);
      const enrolledIds = new Set((enrolled || []).map(e => e.course_id));

      // Check pending applications by email
      const userEmail = (profile as any)?.email || '';
      let appliedIds = new Set<string>();
      if (userEmail) {
        const { data: applied } = await supabase.from('registration_submissions')
          .select('course_id')
          .in('status', ['new', 'reviewed']);
        // Filter client-side since jsonb filter syntax varies
        if (applied?.length) {
          appliedIds = new Set(applied.map(a => a.course_id).filter(Boolean) as string[]);
        }
      }

      return allCourses.filter(c => !enrolledIds.has(c.id) && !appliedIds.has(c.id));
    },
    enabled: !!user?.id,
  });

  const { data: eligibilityMap = {} } = useQuery({
    queryKey: ['dash-eligibility-check', user?.id, availableCourses.map(c => c.id).join(',')],
    queryFn: async () => {
      const result: Record<string, { eligible: boolean; reasons: string[] }> = {};

      for (const course of availableCourses) {
        const { data: rules } = await supabase.from('course_eligibility_rules')
          .select('*')
          .eq('course_id', course.id)
          .eq('is_active', true);

        if (!rules?.length) {
          result[course.id] = { eligible: true, reasons: [] };
          continue;
        }

        let eligible = true;
        const reasons: string[] = [];

        for (const rule of rules) {
          if (rule.rule_type === 'prerequisite_course') {
            const prereqId = (rule.rule_value as any)?.course_id;
            if (prereqId) {
              const { data: comp } = await supabase.from('course_enrollments')
                .select('id').eq('student_id', user!.id).eq('course_id', prereqId)
                .eq('status', 'completed').limit(1);
              if (!comp?.length) {
                eligible = false;
                const { data: prereq } = await supabase.from('courses').select('name').eq('id', prereqId).single();
                reasons.push(`Complete "${prereq?.name || 'prerequisite'}" first`);
              }
            }
          }
          if (rule.rule_type === 'min_attendance') {
            const threshold = (rule.rule_value as any)?.threshold || 0;
            reasons.push(`Requires ${threshold}% attendance`);
          }
          if (rule.rule_type === 'must_pass_exam') {
            reasons.push('Requires passing exam');
          }
        }

        result[course.id] = { eligible, reasons };
      }

      return result;
    },
    enabled: !!user?.id && availableCourses.length > 0,
  });

  const handleQuickApply = async (courseIdToApply: string) => {
    setApplyingCourseId(courseIdToApply);
    try {
      // Check if course has auto-decide enabled
      const { data: courseConfig } = await supabase.from('courses')
        .select('auto_enroll_enabled')
        .eq('id', courseIdToApply)
        .single();

      const autoMode = courseConfig?.auto_enroll_enabled === true;
      const elig = eligibilityMap[courseIdToApply];
      const isEligible = elig?.eligible !== false;

      let status = 'new';
      let eligStatus = isEligible ? 'eligible' : 'not_eligible';

      if (autoMode && !isEligible) {
        status = 'rejected';
      }

      const { data: submission, error } = await supabase.from('registration_submissions').insert({
        form_id: courseIdToApply,
        course_id: courseIdToApply,
        data: {
          full_name: (profile as any)?.full_name || '',
          email: (profile as any)?.email || '',
          phone: (profile as any)?.whatsapp_number || '',
          city: (profile as any)?.city || '',
          gender: (profile as any)?.gender || '',
        },
        status,
        source_tag: 'dashboard_apply',
        eligibility_status: eligStatus,
        eligibility_notes: elig?.reasons?.length ? elig.reasons.join('; ') : null,
      }).select('id').single();

      if (error) throw error;

      // Auto-enroll if auto mode + eligible
      if (autoMode && isEligible && user?.id) {
        const { data: enrollment } = await supabase.from('course_enrollments').insert({
          course_id: courseIdToApply,
          student_id: user.id,
          status: 'active',
        }).select('id').single();

        if (enrollment && submission) {
          await supabase.from('registration_submissions').update({
            status: 'enrolled',
            processed_at: new Date().toISOString(),
            enrollment_id: enrollment.id,
          }).eq('id', submission.id);
        }

        toast.success('You have been automatically enrolled!');
      } else {
        toast.success('Application submitted! You will be notified when reviewed.');
      }

      queryClient.invalidateQueries({ queryKey: ['dash-available-courses'] });
      queryClient.invalidateQueries({ queryKey: ['dash-enrollments'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply');
    } finally {
      setApplyingCourseId(null);
    }
  };

  if (loadingAvailable) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Available courses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!availableCourses.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Available courses</h2>
        <Badge variant="secondary" className="text-xs">{availableCourses.length}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableCourses.map(course => {
          const elig = eligibilityMap[course.id];
          const isEligible = elig?.eligible !== false;
          const isApplying = applyingCourseId === course.id;

          return (
            <div key={course.id} className="space-y-2">
              <CourseThumbnailCard
                course={{
                  id: course.id,
                  name: course.name,
                  thumbnail_url: (course as any).thumbnail_url,
                  hero_image_url: (course as any).hero_image_url,
                  subject_name: (course as any).subject?.name || (course.divisions as any)?.name,
                  level: course.level,
                  max_seats: (course as any).max_students,
                  status: isEligible ? 'open' : 'coming_soon',
                }}
                ctaLabel={isApplying ? 'Applying...' : isEligible ? 'Apply now' : 'Not eligible'}
                onClick={() => isEligible && !isApplying && handleQuickApply(course.id)}
              />
              {elig?.reasons?.length ? (
                <div className="px-2 space-y-1">
                  {elig.reasons.map((r, i) => (
                    <p key={i} className="text-[11px] flex items-center gap-1.5">
                      {isEligible ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <span className="text-muted-foreground">{r}</span>
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
