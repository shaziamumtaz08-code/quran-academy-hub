import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, TrendingUp, DollarSign, Award, AlertCircle,
  CheckCircle2, XCircle, Clock, User
} from 'lucide-react';
import { format } from 'date-fns';

interface UserRelationshipPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  phone?: string;
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

export function UserRelationshipPanel({
  open, onOpenChange, email, phone, submissionData, courseId,
}: UserRelationshipPanelProps) {
  const [activeTab, setActiveTab] = useState('courses');

  // Match profile by email then phone (whatsapp_number)
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-match', email, phone],
    queryFn: async () => {
      if (email) {
        const { data } = await supabase.from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, gender, created_at')
          .eq('email', email.toLowerCase().trim()).limit(1);
        if (data?.length) return data[0];
      }
      if (phone) {
        const { data } = await supabase.from('profiles')
          .select('id, full_name, email, whatsapp_number, city, country, gender, created_at')
          .eq('whatsapp_number', phone.trim()).limit(1);
        if (data?.length) return data[0];
      }
      return null;
    },
    enabled: open && !!(email || phone),
  });

  // Check current course enrollment
  const { data: currentEnrollment } = useQuery({
    queryKey: ['user-current-enrollment', profile?.id, courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_enrollments')
        .select('id, status').eq('student_id', profile!.id).eq('course_id', courseId).limit(1);
      return data?.[0] || null;
    },
    enabled: open && !!profile?.id,
  });

  // Roles with divisions
  const { data: roles = [] } = useQuery({
    queryKey: ['user-roles-divisions', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles')
        .select('role, division_id, divisions:divisions(name)')
        .eq('user_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id,
  });

  // Enrollments for Courses tab
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['user-enrollments', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_enrollments')
        .select('id, status, enrolled_at, course_id, courses:courses(id, name, division_id, divisions:divisions(name))')
        .eq('student_id', profile!.id)
        .order('enrolled_at', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'courses',
  });

  // Attendance for Performance tab
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['user-attendance-perf', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('attendance')
        .select('status, course_id, courses:courses(name)')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'performance',
  });

  // Exams for Performance tab
  const { data: examData = [], isLoading: examsLoading } = useQuery({
    queryKey: ['user-exams-perf', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('teaching_exam_submissions')
        .select('score, status, exam:teaching_exams(title, total_marks, course_id, courses:courses(name))')
        .eq('student_id', profile!.id);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'performance',
  });

  // Fees for Finances tab
  const { data: feeData = [], isLoading: feesLoading } = useQuery({
    queryKey: ['user-fees', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_student_fees')
        .select('id, amount, currency, status, due_date, course_id, plan_id, courses:courses(name), plan:course_fee_plans(plan_name)')
        .eq('student_id', profile!.id)
        .order('due_date', { ascending: false });
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'finances',
  });

  // Fee payments
  const { data: feePayments = [] } = useQuery({
    queryKey: ['user-fee-payments', profile?.id, feeData],
    queryFn: async () => {
      const feeIds = feeData.map((f: any) => f.id);
      if (!feeIds.length) return [];
      const { data } = await supabase.from('course_fee_payments')
        .select('amount, payment_date, student_fee_id')
        .in('student_fee_id', feeIds);
      return data || [];
    },
    enabled: open && !!profile?.id && activeTab === 'finances' && feeData.length > 0,
  });

  // Certificates tab
  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ['user-certs', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_certificate_awards')
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

  // Group enrollments by division
  const enrollmentsByDivision = enrollments.reduce((acc: Record<string, any[]>, e: any) => {
    const divName = e.courses?.divisions?.name || 'Unassigned';
    if (!acc[divName]) acc[divName] = [];
    acc[divName].push(e);
    return acc;
  }, {});

  const divisionCount = Object.keys(enrollmentsByDivision).length;

  // Attendance by course
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

  // Fee summaries
  const totalPaid = feePayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalPending = feeData.filter((f: any) => f.status === 'pending').reduce((s: number, f: any) => s + (f.amount || 0), 0);
  const totalOverdue = feeData.filter((f: any) => f.status === 'overdue').reduce((s: number, f: any) => s + (f.amount || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[540px] p-0 flex flex-col">
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
          /* No match — minimal card */
          <div className="p-6 space-y-4">
            <SheetHeader>
              <SheetTitle className="text-base">Applicant Details</SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{submissionData?.full_name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{email} {phone ? `· ${phone}` : ''}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
              <AlertCircle className="h-3 w-3" /> New applicant — no prior history
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
          /* Full relationship panel */
          <>
            {/* Header */}
            <div className="p-6 pb-0 space-y-3">
              <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.email} {profile.whatsapp_number ? `· ${profile.whatsapp_number}` : ''}
                  </p>
                </div>
              </div>

              {/* Role chips */}
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r: any, i: number) => {
                  const divName = r.divisions?.name;
                  const label = `${r.role.replace(/_/g, ' ')}${divName ? ` · ${divName}` : ''}`;
                  return (
                    <Badge key={i} variant="outline" className={`text-[10px] capitalize ${ROLE_COLORS[r.role] || ''}`}>
                      {label}
                    </Badge>
                  );
                })}
              </div>

              {/* Enrollment badge */}
              {currentEnrollment && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Already enrolled in this course
                </Badge>
              )}

              <p className="text-xs text-muted-foreground">
                Member since {format(new Date(profile.created_at), 'MMM yyyy')}
                {enrollments.length > 0 && ` · Enrolled in ${enrollments.length} course${enrollments.length > 1 ? 's' : ''} across ${divisionCount} division${divisionCount > 1 ? 's' : ''}`}
              </p>

              <Separator />
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-background border w-full justify-start">
                  <TabsTrigger value="courses" className="gap-1 text-xs"><GraduationCap className="h-3.5 w-3.5" /> Courses</TabsTrigger>
                  <TabsTrigger value="performance" className="gap-1 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Performance</TabsTrigger>
                  <TabsTrigger value="finances" className="gap-1 text-xs"><DollarSign className="h-3.5 w-3.5" /> Finances</TabsTrigger>
                  <TabsTrigger value="certs" className="gap-1 text-xs"><Award className="h-3.5 w-3.5" /> Certs</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto mt-4">
                  {/* Courses Tab */}
                  <TabsContent value="courses" className="mt-0 space-y-4">
                    {enrollmentsLoading ? (
                      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                    ) : enrollments.length === 0 ? (
                      <EmptyState icon={GraduationCap} text="No course history yet" />
                    ) : (
                      Object.entries(enrollmentsByDivision).map(([divName, items]) => (
                        <div key={divName}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{divName}</p>
                          <div className="space-y-2">
                            {(items as any[]).map((e: any) => (
                              <Card key={e.id} className="border-border/60">
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">{e.courses?.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Enrolled {format(new Date(e.enrolled_at), 'MMM yyyy')}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[e.status] || ''}`}>
                                    {e.status}
                                  </Badge>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Performance Tab */}
                  <TabsContent value="performance" className="mt-0 space-y-6">
                    {(attendanceLoading || examsLoading) ? (
                      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                    ) : (
                      <>
                        {/* Attendance */}
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

                        {/* Exams */}
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

                  {/* Finances Tab */}
                  <TabsContent value="finances" className="mt-0 space-y-4">
                    {feesLoading ? (
                      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
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
                            const feeStatusColor = f.status === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : f.status === 'overdue' ? 'text-red-700 bg-red-50 border-red-200'
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
                                        <p className="text-[10px] text-emerald-600 mt-0.5">
                                          Paid on {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                                        </p>
                                      )}
                                    </div>
                                    <Badge variant="outline" className={`text-[10px] ${feeStatusColor}`}>
                                      {f.status}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Certificates Tab */}
                  <TabsContent value="certs" className="mt-0 space-y-2">
                    {certsLoading ? (
                      <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
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
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(c.issued_at), 'MMM d, yyyy')}
                            </p>
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
