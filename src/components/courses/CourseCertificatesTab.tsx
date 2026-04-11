import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Award, FileText, Users, Trash2, Send, Sparkles, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { triggerNotification } from '@/lib/notifications';

interface CourseCertificatesTabProps {
  courseId: string;
}

export function CourseCertificatesTab({ courseId }: CourseCertificatesTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('templates');
  const [createOpen, setCreateOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issuingTemplateId, setIssuingTemplateId] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [issueGrade, setIssueGrade] = useState('');
  const [issueCustomText, setIssueCustomText] = useState('');
  const [autoAwarding, setAutoAwarding] = useState(false);

  // Template form state
  const [tplName, setTplName] = useState('');
  const [tplHtml, setTplHtml] = useState(DEFAULT_TEMPLATE);
  const [criteria, setCriteria] = useState({
    requireCompletion: false,
    requireAttendance: false,
    minAttendance: '75',
    requireExamPass: false,
  });

  // Queries
  const { data: templates = [] } = useQuery({
    queryKey: ['course-certificates', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_certificates')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: awards = [] } = useQuery({
    queryKey: ['course-certificate-awards', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_certificate_awards')
        .select('*, student:profiles!course_certificate_awards_student_id_fkey(full_name, email), certificate:course_certificates!course_certificate_awards_certificate_id_fkey(template_name)')
        .eq('course_id', courseId)
        .order('issued_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['course-enrolled-students-cert', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id, student:profiles!course_enrollments_student_id_fkey(id, full_name, email)')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return (data || []) as any[];
    },
  });

  const { data: courseName } = useQuery({
    queryKey: ['course-name-cert', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('name').eq('id', courseId).single();
      return data?.name || '';
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const hasCriteria = criteria.requireCompletion || criteria.requireAttendance || criteria.requireExamPass;
      const fields = hasCriteria ? {
        auto_award_criteria: {
          require_completion: criteria.requireCompletion,
          require_attendance: criteria.requireAttendance,
          min_attendance_pct: parseInt(criteria.minAttendance) || 75,
          require_exam_pass: criteria.requireExamPass,
        }
      } : null;

      const { error } = await supabase.from('course_certificates').insert({
        course_id: courseId,
        template_name: tplName,
        template_html: tplHtml,
        created_by: user?.id,
        is_default: templates.length === 0,
        fields,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-certificates', courseId] });
      setCreateOpen(false);
      setTplName('');
      setTplHtml(DEFAULT_TEMPLATE);
      setCriteria({ requireCompletion: false, requireAttendance: false, minAttendance: '75', requireExamPass: false });
      toast({ title: 'Certificate template created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_certificates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-certificates', courseId] });
      toast({ title: 'Template deleted' });
    },
  });

  const issueCertificates = useMutation({
    mutationFn: async () => {
      const entries = Array.from(selectedStudents).map((studentId, idx) => ({
        certificate_id: issuingTemplateId,
        student_id: studentId,
        course_id: courseId,
        issued_by: user?.id,
        grade: issueGrade || null,
        custom_text: issueCustomText || null,
        certificate_number: `CERT-${courseId.slice(0, 6).toUpperCase()}-${Date.now()}-${idx}`,
      }));
      const { error } = await supabase.from('course_certificate_awards').insert(entries);
      if (error) throw error;

      // Trigger notifications
      for (const studentId of selectedStudents) {
        await triggerNotification('certificate_awarded', studentId, { course_name: courseName || '' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-certificate-awards', courseId] });
      setIssueOpen(false);
      setSelectedStudents(new Set());
      setIssueGrade('');
      setIssueCustomText('');
      toast({ title: `${selectedStudents.size} certificate(s) issued` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleAutoAward = async () => {
    setAutoAwarding(true);
    try {
      const template = templates.find(t => t.is_default) || templates[0];
      if (!template) { toast({ title: 'Create a certificate template first', variant: 'destructive' }); return; }

      const autoAwardCriteria = (template.fields as any)?.auto_award_criteria;
      if (!autoAwardCriteria) { toast({ title: 'No auto-award criteria set on the default template', variant: 'destructive' }); return; }

      // Get enrolled students (completed if required)
      const statusFilter = autoAwardCriteria.require_completion ? 'completed' : 'active';
      const { data: enrolled } = await supabase.from('course_enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', statusFilter);

      if (!enrolled?.length) { toast({ title: 'No eligible students found' }); return; }

      // Already awarded
      const { data: alreadyAwarded } = await supabase.from('course_certificate_awards')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('certificate_id', template.id);
      const awardedSet = new Set((alreadyAwarded || []).map(a => a.student_id));

      let awarded = 0;
      for (const e of enrolled) {
        if (awardedSet.has(e.student_id)) continue;
        let eligible = true;

        if (autoAwardCriteria.require_attendance) {
          const { data: att } = await supabase.from('attendance')
            .select('status')
            .eq('student_id', e.student_id)
            .eq('course_id', courseId);
          if (att?.length) {
            const pct = Math.round(att.filter(a => a.status === 'present').length / att.length * 100);
            if (pct < (autoAwardCriteria.min_attendance_pct || 75)) eligible = false;
          } else {
            eligible = false;
          }
        }

        if (autoAwardCriteria.require_exam_pass && eligible) {
          const { data: submissions } = await supabase.from('teaching_exam_submissions')
            .select('total_score, passed, exam:teaching_exams!inner(course_id)')
            .eq('student_id', e.student_id);
          const relevant = (submissions || []).filter((s: any) => s.exam?.course_id === courseId);
          const passed = relevant.some((s: any) => s.passed);
          if (!passed) eligible = false;
        }

        if (eligible) {
          const certNumber = `CERT-${courseId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${awarded}`;
          await supabase.from('course_certificate_awards').insert({
            certificate_id: template.id,
            course_id: courseId,
            student_id: e.student_id,
            issued_by: user?.id,
            certificate_number: certNumber,
          });
          await triggerNotification('certificate_awarded', e.student_id, { course_name: courseName || '' });
          awarded++;
        }
      }

      toast({ title: `${awarded} certificate${awarded !== 1 ? 's' : ''} awarded` });
      queryClient.invalidateQueries({ queryKey: ['course-certificate-awards', courseId] });
    } finally {
      setAutoAwarding(false);
    }
  };

  const openIssueDialog = (templateId: string) => {
    setIssuingTemplateId(templateId);
    setSelectedStudents(new Set());
    setIssueOpen(true);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedStudents.size === enrolledStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(enrolledStudents.map((e: any) => e.student_id)));
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="templates" className="gap-1 text-xs">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="issued" className="gap-1 text-xs">
            <Award className="h-3.5 w-3.5" /> Issued ({awards.length})
          </TabsTrigger>
        </TabsList>

        {/* Templates */}
        <TabsContent value="templates" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Certificate Templates</h3>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Award className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No certificate templates yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {templates.map(tpl => {
                const hasCriteria = !!(tpl.fields as any)?.auto_award_criteria;
                return (
                  <Card key={tpl.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-amber-500" />
                            <h4 className="text-sm font-medium">{tpl.template_name}</h4>
                            {tpl.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                            {hasCriteria && <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> Auto-award</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {format(new Date(tpl.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openIssueDialog(tpl.id)}>
                            <Send className="h-3 w-3" /> Issue
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTemplate.mutate(tpl.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Template Preview</p>
                        <div className="text-xs" dangerouslySetInnerHTML={{ __html: tpl.template_html?.slice(0, 300) + '...' || '' }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Issued */}
        <TabsContent value="issued" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Issued Certificates</h3>
            <Button variant="outline" size="sm" onClick={handleAutoAward} disabled={autoAwarding} className="gap-1.5 text-xs">
              {autoAwarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Check & award eligible
            </Button>
          </div>

          <Card className="border-border">
            <CardContent className="px-4 pb-3 pt-3">
              {awards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No certificates issued yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Template</TableHead>
                        <TableHead className="text-xs">Grade</TableHead>
                        <TableHead className="text-xs">Cert #</TableHead>
                        <TableHead className="text-xs">Issued</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {awards.map(award => (
                        <TableRow key={award.id}>
                          <TableCell className="text-sm">{award.student?.full_name || '-'}</TableCell>
                          <TableCell className="text-sm">{award.certificate?.template_name || '-'}</TableCell>
                          <TableCell>
                            {award.grade ? <Badge variant="secondary" className="text-xs">{award.grade}</Badge> : '-'}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{award.certificate_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(award.issued_at), 'MMM d, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Certificate Template</DialogTitle>
            <DialogDescription>Design a certificate template with HTML. Use placeholders: {'{{student_name}}'}, {'{{course_name}}'}, {'{{grade}}'}, {'{{date}}'}, {'{{certificate_number}}'}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Template Name *</Label>
              <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Course Completion Certificate" />
            </div>
            <div>
              <Label className="text-xs">Template HTML</Label>
              <Textarea 
                value={tplHtml} 
                onChange={e => setTplHtml(e.target.value)} 
                className="min-h-[200px] font-mono text-xs"
              />
            </div>

            <Separator className="my-4" />
            <h4 className="font-medium text-sm">Auto-award criteria (optional)</h4>
            <p className="text-xs text-muted-foreground">
              When all conditions are met, the certificate can be automatically awarded.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox checked={criteria.requireCompletion}
                  onCheckedChange={v => setCriteria(prev => ({...prev, requireCompletion: !!v}))} />
                <Label className="text-sm">Course enrollment status = completed</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox checked={criteria.requireAttendance}
                  onCheckedChange={v => setCriteria(prev => ({...prev, requireAttendance: !!v}))} />
                <Label className="text-sm">Minimum attendance %</Label>
                {criteria.requireAttendance && (
                  <Input type="number" className="w-20 h-8" min="0" max="100"
                    value={criteria.minAttendance} onChange={e => setCriteria(prev => ({...prev, minAttendance: e.target.value}))} />
                )}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox checked={criteria.requireExamPass}
                  onCheckedChange={v => setCriteria(prev => ({...prev, requireExamPass: !!v}))} />
                <Label className="text-sm">Must pass at least one exam</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createTemplate.mutate()} disabled={!tplName.trim() || createTemplate.isPending}>
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Certificates Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Issue Certificates
            </DialogTitle>
            <DialogDescription>Select students to receive this certificate.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Grade (optional)</Label>
                <Input value={issueGrade} onChange={e => setIssueGrade(e.target.value)} placeholder="A+" />
              </div>
              <div>
                <Label className="text-xs">Custom Text</Label>
                <Input value={issueCustomText} onChange={e => setIssueCustomText(e.target.value)} placeholder="With honors" />
              </div>
            </div>

            <div className="border rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox checked={selectedStudents.size === enrolledStudents.length && enrolledStudents.length > 0} onCheckedChange={selectAll} />
                <span className="text-xs font-medium">Select All ({enrolledStudents.length})</span>
                <Badge variant="secondary" className="ml-auto text-xs">{selectedStudents.size} selected</Badge>
              </div>
              {enrolledStudents.map((enrollment: any) => (
                <div key={enrollment.student_id} className="flex items-center gap-2 py-1">
                  <Checkbox 
                    checked={selectedStudents.has(enrollment.student_id)} 
                    onCheckedChange={() => toggleStudent(enrollment.student_id)} 
                  />
                  <span className="text-sm">{enrollment.student?.full_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{enrollment.student?.email}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={() => issueCertificates.mutate()} disabled={selectedStudents.size === 0 || issueCertificates.isPending}>
              Issue to {selectedStudents.size} Student(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_TEMPLATE = `<div style="text-align:center; padding:40px; border:3px double #d4af37; font-family:Georgia,serif;">
  <h1 style="color:#1a365d; font-size:28px; margin-bottom:8px;">Certificate of Completion</h1>
  <p style="color:#666; font-size:14px;">This is to certify that</p>
  <h2 style="color:#2d3748; font-size:24px; margin:16px 0;">{{student_name}}</h2>
  <p style="color:#666; font-size:14px;">has successfully completed the course</p>
  <h3 style="color:#1a365d; font-size:20px; margin:12px 0;">{{course_name}}</h3>
  <p style="color:#666; font-size:14px;">Grade: {{grade}}</p>
  <p style="color:#999; font-size:12px; margin-top:24px;">Date: {{date}} | Certificate #: {{certificate_number}}</p>
</div>`;
