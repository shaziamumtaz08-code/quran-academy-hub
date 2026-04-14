import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap,
  TrendingUp,
  DollarSign,
  Award,
  AlertCircle,
  CheckCircle2,
  Users,
  User,
  Link2,
} from 'lucide-react';
import { format } from 'date-fns';

interface UserRelationshipPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  phone?: string;
  matchedProfileId?: string | null;
  submissionData?: Record<string, any>;
  courseId: string;
}

const ROLE_COLORS: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700 border-blue-200',
  teacher: 'bg-purple-100 text-purple-700 border-purple-200',
  parent: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  super_admin: 'bg-red-100 text-red-700 border-red-200',
  examiner: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  dropped: 'bg-gray-100 text-gray-500 border-gray-200',
};

function normalizePhoneLikeValue(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  const local = digits.replace(/^0+/, '');
  return { digits, local };
}

export function UserRelationshipPanel({
  open,
  onOpenChange,
  email,
  phone,
  matchedProfileId,
  submissionData,
  courseId,
}: UserRelationshipPanelProps) {
  const [activeTab, setActiveTab] = useState('courses');

  const normalizedEmail = email?.toLowerCase().trim() || '';
  const normalizedPhone = normalizePhoneLikeValue(phone);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-match-v2', matchedProfileId, normalizedEmail, phone],
    queryFn: async () => {
      if (matchedProfileId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, gender, created_at, registration_id')
          .eq('id', matchedProfileId)
          .maybeSingle();
        if (data) return data;
      }

      if (normalizedEmail) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, gender, created_at, registration_id')
          .ilike('email', normalizedEmail)
          .limit(1);
        if (data?.length) return data[0];
      }

      const { data: phoneCandidates } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number, city, country, gender, created_at, registration_id');

      if (phoneCandidates?.length && normalizedPhone) {
        const matched = phoneCandidates.find((candidate: any) => {
          const candidatePhone = normalizePhoneLikeValue(candidate.whatsapp_number);
          if (!candidatePhone || typeof normalizedPhone === 'string') return candidatePhone === normalizedPhone;
          if (typeof candidatePhone === 'string') {
            const digits = candidatePhone.replace(/\D/g, '');
            return digits === normalizedPhone.digits || digits.endsWith(normalizedPhone.local) || normalizedPhone.digits.endsWith(digits);
          }
          return (
            candidatePhone.digits === normalizedPhone.digits ||
            candidatePhone.local === normalizedPhone.local ||
            candidatePhone.digits.endsWith(normalizedPhone.local) ||
            normalizedPhone.digits.endsWith(candidatePhone.local)
          );
        });
        if (matched) return matched;
      }

      return null;
    },
    enabled: open && !!(matchedProfileId || normalizedEmail || phone),
  });

  const { data: currentEnrollment } = useQuery({
    queryKey: ['user-current-enrollment', profile?.id, courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('student_id', profile!.id)
        .eq('course_id', courseId)
        .limit(1);
      return data?.[0] || null;
    },
    enabled: open && !!profile?.id,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['user-roles', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id,
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['user-enrollments', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('id, status, enrolled_at, course_id, courses:courses(id, name, division_id, divisions:divisions(name))')
        .eq('student_id', profile!.id)
        .order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'courses',
  });

  const { data: classMemberships = [] } = useQuery({
    queryKey: ['user-class-memberships', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_class_students')
        .select('id, status, enrollment_ref, class_id, course_classes:course_classes(name, course_id, courses:courses(name, division_id, divisions:divisions(name)))')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'courses',
  });

  const { data: teacherAssignments = [] } = useQuery({
    queryKey: ['user-teacher-assignments', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          status,
          enrollment_ref,
          division_id,
          student_id,
          teacher_id,
          subject:subjects(name),
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, registration_id),
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name, registration_id),
          divisions:divisions(name)
        `)
        .or(`student_id.eq.${profile!.id},teacher_id.eq.${profile!.id}`)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'courses',
  });

  const { data: parentLinks = [] } = useQuery({
    queryKey: ['user-parent-links', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_parent_links')
        .select(`
          id,
          oversight_level,
          parent:profiles!student_parent_links_parent_id_fkey(id, full_name, registration_id),
          student:profiles!student_parent_links_student_id_fkey(id, full_name, registration_id)
        `)
        .or(`parent_id.eq.${profile!.id},student_id.eq.${profile!.id}`);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'courses',
  });

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['user-attendance-perf', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('status, course_id, courses:courses(name)')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'performance',
  });

  const { data: examData = [], isLoading: examsLoading } = useQuery({
    queryKey: ['user-exams-perf', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('teaching_exam_submissions')
        .select('score, status, exam:teaching_exams(title, total_marks, course_id, courses:courses(name))')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'performance',
  });

  const { data: feeData = [], isLoading: feesLoading } = useQuery({
    queryKey: ['user-fees', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_student_fees')
        .select('id, amount, currency, status, due_date, course_id, plan_id, courses:courses(name), plan:course_fee_plans(plan_name)')
        .eq('student_id', profile!.id)
        .order('due_date', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'finances',
  });

  const { data: feePayments = [] } = useQuery({
    queryKey: ['user-fee-payments', profile?.id, feeData.length],
    queryFn: async () => {
      const feeIds = feeData.map((f: any) => f.id);
      if (!feeIds.length) return [];
      const { data } = await supabase
        .from('course_fee_payments')
        .select('amount, payment_date, student_fee_id')
        .in('student_fee_id', feeIds);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'finances' && feeData.length > 0,
  });

  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ['user-certs', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_certificate_awards')
        .select('id, issued_at, grade, certificate_number, certificate:course_certificates(template_name), course:courses(name)')
        .eq('student_id', profile!.id)
        .order('issued_at', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'certs',
  });

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : (submissionData?.full_name || email || '?')[0].toUpperCase();

  const enrollmentsByDivision = enrollments.reduce((acc: Record<string, any[]>, e: any) => {
    const divName = e.courses?.divisions?.name || 'Unassigned';
    if (!acc[divName]) acc[divName] = [];
    acc[divName].push(e);
    return acc;
  }, {});

  const relationshipSummary = useMemo(() => {
    const taughtStudents = teacherAssignments.filter((row: any) => row.teacher_id === profile?.id);
    const learnedFromTeachers = teacherAssignments.filter((row: any) => row.student_id === profile?.id);
    const parentOf = parentLinks.filter((row: any) => row.parent?.id === profile?.id);
    const childOf = parentLinks.filter((row: any) => row.student?.id === profile?.id);
    return { taughtStudents, learnedFromTeachers, parentOf, childOf };
  }, [teacherAssignments, parentLinks, profile?.id]);

  const divisionCount = Object.keys(enrollmentsByDivision).length;
  const attendanceByCourse = (attendanceData || []).reduce((acc: Record<string, { present: number; total: number; name: string }>, a: any) => {
    const cId = a.course_id || 'unknown';
    const name = a.courses?.name || 'Unknown';
    if (!acc[cId]) acc[cId] = { present: 0, total: 0, name };
    acc[cId].total++;
    if (a.status === 'present') acc[cId].present++;
    return acc;
  }, {});

  const overallAttendance = attendanceData?.length
    ? Math.round((attendanceData.filter((a: any) => a.status === 'present').length / attendanceData.length) * 100)
    : 0;

  const totalPaid = feePayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalPending = feeData.filter((f: any) => f.status === 'pending').reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const totalOverdue = feeData.filter((f: any) => f.status === 'overdue').reduce((s: number, f: any) => s + (f.amount || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[560px] p-0 flex flex-col">
        {profileLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !profile ? (
          <div className="p-6 space-y-4">
            <SheetHeader>
              <SheetTitle className="text-base">Applicant Details</SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-muted text-muted-foreground font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{submissionData?.full_name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{email} {phone ? `· ${phone}` : ''}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
              <AlertCircle className="h-3 w-3" /> No unified profile found yet
            </Badge>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Submitted Data</p>
              {submissionData && Object.entries(submissionData).map(([key, value]) => (
                <div key={key} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="text-sm">{String(value || '—')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 pb-0 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email} {profile.whatsapp_number ? `· ${profile.whatsapp_number}` : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.registration_id ? `URN ${profile.registration_id}` : 'URN pending'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {roles.map((r: any, i: number) => (
                  <Badge key={`${r.role}-${i}`} variant="outline" className={`text-[10px] capitalize ${ROLE_COLORS[r.role] || ''}`}>
                    {r.role.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>

              {currentEnrollment && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Already enrolled in this course
                </Badge>
              )}

              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="Courses" value={enrollments.length} color="text-blue-600" />
                <MiniStat label="Classes" value={classMemberships.length} color="text-violet-600" />
                <MiniStat label="1:1 Links" value={teacherAssignments.length} color="text-purple-600" />
                <MiniStat label="Family Links" value={parentLinks.length} color="text-amber-600" />
              </div>

              <p className="text-xs text-muted-foreground">
                Member since {format(new Date(profile.created_at), 'MMM yyyy')}
                {enrollments.length > 0 && ` · Enrolled in ${enrollments.length} course${enrollments.length > 1 ? 's' : ''} across ${divisionCount} division${divisionCount > 1 ? 's' : ''}`}
              </p>

              <Separator />
            </div>

            <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-background border w-full justify-start">
                  <TabsTrigger value="courses" className="gap-1 text-xs"><GraduationCap className="h-3.5 w-3.5" /> Relationships</TabsTrigger>
                  <TabsTrigger value="performance" className="gap-1 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Performance</TabsTrigger>
                  <TabsTrigger value="finances" className="gap-1 text-xs"><DollarSign className="h-3.5 w-3.5" /> Finances</TabsTrigger>
                  <TabsTrigger value="certs" className="gap-1 text-xs"><Award className="h-3.5 w-3.5" /> Certs</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto mt-4">
                  <TabsContent value="courses" className="mt-0 space-y-4">
                    {enrollmentsLoading ? (
                      <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                    ) : (
                      <>
                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Course Enrollments</p>
                          {enrollments.length === 0 ? (
                            <EmptyState icon={GraduationCap} text="No course history yet" />
                          ) : (
                            Object.entries(enrollmentsByDivision).map(([divName, items]) => (
                              <div key={divName} className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">{divName}</p>
                                {(items as any[]).map((e: any) => (
                                  <Card key={e.id} className="border-border/60">
                                    <CardContent className="p-3 flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-medium">{e.courses?.name}</p>
                                        <p className="text-xs text-muted-foreground">Enrolled {format(new Date(e.enrolled_at), 'MMM yyyy')}</p>
                                      </div>
                                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[e.status] || ''}`}>{e.status}</Badge>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ))
                          )}
                        </section>

                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Class Memberships</p>
                          {classMemberships.length === 0 ? (
                            <EmptyState icon={Users} text="No class memberships" />
                          ) : (
                            classMemberships.map((item: any) => (
                              <Card key={item.id} className="border-border/60">
                                <CardContent className="p-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{item.course_classes?.courses?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.course_classes?.name || 'Unnamed class'}
                                      {item.enrollment_ref ? ` · ${item.enrollment_ref}` : ''}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status] || ''}`}>{item.status}</Badge>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </section>

                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1:1 Mentorship Links</p>
                          {teacherAssignments.length === 0 ? (
                            <EmptyState icon={Link2} text="No 1:1 relationships" />
                          ) : (
                            teacherAssignments.map((row: any) => {
                              const isStudentSide = row.student_id === profile.id;
                              const counterpart = isStudentSide ? row.teacher : row.student;
                              return (
                                <Card key={row.id} className="border-border/60">
                                  <CardContent className="p-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium">
                                        {isStudentSide ? 'Student of' : 'Teaching'} {counterpart?.full_name || 'Unknown'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {row.subject?.name || 'No subject'}
                                        {row.divisions?.name ? ` · ${row.divisions.name}` : ''}
                                        {row.enrollment_ref ? ` · ${row.enrollment_ref}` : ''}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[row.status] || ''}`}>{row.status}</Badge>
                                  </CardContent>
                                </Card>
                              );
                            })
                          )}
                        </section>

                        <section className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Family Relationships</p>
                          {parentLinks.length === 0 ? (
                            <EmptyState icon={User} text="No parent-student links" />
                          ) : (
                            parentLinks.map((row: any) => {
                              const isParent = row.parent?.id === profile.id;
                              const counterpart = isParent ? row.student : row.parent;
                              return (
                                <Card key={row.id} className="border-border/60">
                                  <CardContent className="p-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium">{isParent ? 'Parent of' : 'Child of'} {counterpart?.full_name || 'Unknown'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {counterpart?.registration_id || 'URN pending'}
                                        {row.oversight_level ? ` · ${row.oversight_level}` : ''}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                      {isParent ? 'Parent' : 'Student'}
                                    </Badge>
                                  </CardContent>
                                </Card>
                              );
                            })
                          )}
                        </section>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0 space-y-6">
                    {(attendanceLoading || examsLoading) ? (
                      <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</p>
                          {Object.keys(attendanceByCourse).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No attendance records</p>
                          ) : (
                            <>
                              <p className="text-sm font-medium">Overall: {overallAttendance}%</p>
                              {Object.entries(attendanceByCourse).map(([cId, data]) => {
                                const pct = Math.round((data.present / data.total) * 100);
                                const color = pct > 80 ? 'bg-emerald-500' : pct > 60 ? 'bg-amber-500' : 'bg-red-500';
                                return (
                                  <div key={cId} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span>{data.name}</span>
                                      <span className="font-medium">{pct}%</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exams</p>
                          {examData.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No exam submissions</p>
                          ) : (
                            <div className="space-y-2">
                              {examData.map((e: any, i: number) => {
                                const total = e.exam?.total_marks || 100;
                                const pct = Math.round((e.score / total) * 100);
                                const passed = pct >= 50;
                                return (
                                  <Card key={i} className="border-border/60">
                                    <CardContent className="p-3 flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-medium">{e.exam?.title}</p>
                                        <p className="text-xs text-muted-foreground">{e.exam?.courses?.name}</p>
                                      </div>
                                      <div className="text-right flex items-center gap-2">
                                        <span className="text-sm font-medium">{e.score}/{total}</span>
                                        <Badge variant="outline" className={`text-[10px] ${passed ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                                          {passed ? 'Pass' : 'Fail'}
                                        </Badge>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="finances" className="mt-0 space-y-4">
                    {feesLoading ? (
                      <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : feeData.length === 0 ? (
                      <EmptyState icon={DollarSign} text="No fee records" />
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <MiniStat label="Paid" value={totalPaid} color="text-emerald-600" />
                          <MiniStat label="Pending" value={totalPending} color="text-amber-600" />
                          <MiniStat label="Overdue" value={totalOverdue} color="text-red-600" />
                        </div>
                        <div className="space-y-2">
                          {feeData.map((f: any) => {
                            const payment = feePayments.find((p: any) => p.student_fee_id === f.id);
                            const feeStatusColor = f.status === 'paid'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : f.status === 'overdue'
                                ? 'text-red-700 bg-red-50 border-red-200'
                                : 'text-amber-700 bg-amber-50 border-amber-200';
                            return (
                              <Card key={f.id} className="border-border/60">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{f.courses?.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {f.plan?.plan_name || 'No plan'} · {f.currency} {f.amount}
                                        {f.due_date && ` · Due ${format(new Date(f.due_date), 'MMM d, yyyy')}`}
                                      </p>
                                      {payment && (
                                        <p className="text-[10px] text-emerald-600 mt-0.5">Paid on {format(new Date(payment.payment_date), 'MMM d, yyyy')}</p>
                                      )}
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] ${feeStatusColor}`}>{f.status}</Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="certs" className="mt-0 space-y-2">
                    {certsLoading ? (
                      <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : certs.length === 0 ? (
                      <EmptyState icon={Award} text="No certificates awarded" />
                    ) : (
                      certs.map((c: any) => (
                        <Card key={c.id} className="border-border/60">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{c.course?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.certificate?.template_name}
                                {c.certificate_number && ` · #${c.certificate_number}`}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">{format(new Date(c.issued_at), 'MMM d, yyyy')}</p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 text-center">
        <p className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
