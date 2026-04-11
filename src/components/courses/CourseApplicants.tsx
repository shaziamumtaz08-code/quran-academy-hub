import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Search, Eye, Clock, CheckCircle2, XCircle, UserPlus, Loader2,
  AlertTriangle, RefreshCcw, Users, FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { CourseApplicantImport } from './CourseApplicantImport';

interface Submission {
  id: string;
  form_id: string;
  course_id: string;
  data: Record<string, any>;
  status: string;
  source_tag: string | null;
  submitted_at: string;
  notes: string | null;
}

interface EnrollError {
  submission?: Submission;
  name: string;
  email: string;
  reason: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Clock },
  reviewed: { label: 'Reviewed', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Eye },
  enrolled: { label: 'Enrolled', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export function CourseApplicants({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [errors, setErrors] = useState<EnrollError[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [activeTab, setActiveTab] = useState('applicants');

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['registration-submissions', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registration_submissions')
        .select('*')
        .eq('course_id', courseId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Submission[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('registration_submissions')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
    },
  });

  const filtered = submissions.filter(s => {
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    const name = (s.data?.full_name || s.data?.email || '').toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = {
    all: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    reviewed: submissions.filter(s => s.status === 'reviewed').length,
    enrolled: submissions.filter(s => s.status === 'enrolled').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  // ─── Core enrollment logic ───
  async function enrollSingle(name: string, email: string, submissionId?: string): Promise<{
    success: boolean;
    isNew: boolean;
    error?: string;
  }> {
    const emailLower = email.toLowerCase().trim();

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return { success: false, isNew: false, error: 'Invalid email format' };
    }

    // Check if profile exists
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('email', emailLower)
      .limit(1);

    let profileId: string;
    let isNew = false;

    if (existingProfiles && existingProfiles.length > 0) {
      const existing = existingProfiles[0];
      // Name mismatch check
      if (existing.full_name && name && existing.full_name.toLowerCase() !== name.toLowerCase()) {
        return {
          success: false,
          isNew: false,
          error: `Name mismatch: existing "${existing.full_name}" vs submitted "${name}"`,
        };
      }
      profileId = existing.id;
    } else {
      // Create new user via edge function
      const tempPassword = generateTempPassword();
      const { data: createResult, error: createError } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: emailLower,
          password: tempPassword,
          fullName: name || emailLower.split('@')[0],
          role: 'student',
        },
      });

      if (createError || !createResult?.user?.id) {
        return {
          success: false,
          isNew: false,
          error: createError?.message || createResult?.error || 'Failed to create user',
        };
      }
      profileId = createResult.user.id;
      isNew = true;
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('course_id', courseId)
      .eq('student_id', profileId)
      .limit(1);

    if (!existingEnrollment || existingEnrollment.length === 0) {
      const { data: newEnrollment, error: enrollErr } = await supabase.from('course_enrollments').insert({
        course_id: courseId,
        student_id: profileId,
        status: 'active',
      }).select('id').single();
      if (enrollErr) {
        return { success: false, isNew, error: enrollErr.message };
      }

      // Update submission with enrollment audit trail
      if (submissionId && newEnrollment) {
        await supabase.from('registration_submissions')
          .update({
            status: 'enrolled',
            reviewed_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            enrollment_id: newEnrollment.id,
          } as any)
          .eq('id', submissionId);
      }
    } else if (submissionId) {
      await supabase.from('registration_submissions')
        .update({ status: 'enrolled', reviewed_at: new Date().toISOString() })
        .eq('id', submissionId);
    }

    return { success: true, isNew };
  }

  async function handleEnrollSelected() {
    setEnrolling(true);
    const toEnroll = submissions.filter(s => selectedIds.has(s.id) && s.status !== 'enrolled');
    let enrolled = 0, newUsers = 0, matched = 0;
    const newErrors: EnrollError[] = [];

    for (const sub of toEnroll) {
      const name = sub.data?.full_name || '';
      const email = sub.data?.email || '';

      if (!email) {
        newErrors.push({ submission: sub, name, email, reason: 'No email provided' });
        continue;
      }

      const result = await enrollSingle(name, email, sub.id);
      if (result.success) {
        enrolled++;
        if (result.isNew) newUsers++; else matched++;
      } else {
        newErrors.push({ submission: sub, name, email, reason: result.error || 'Unknown error' });
      }
    }

    setErrors(prev => [...prev, ...newErrors]);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });

    toast({
      title: `${enrolled} enrolled`,
      description: `${newUsers} new users created, ${matched} matched to existing${newErrors.length > 0 ? `, ${newErrors.length} errors` : ''}`,
    });

    if (newErrors.length > 0) setActiveTab('errors');
    setEnrolling(false);
  }

  async function handleEnrollSingle(sub: Submission) {
    setEnrolling(true);
    const name = sub.data?.full_name || '';
    const email = sub.data?.email || '';

    if (!email) {
      toast({ title: 'No email', description: 'This applicant has no email address', variant: 'destructive' });
      setEnrolling(false);
      return;
    }

    const result = await enrollSingle(name, email, sub.id);
    if (result.success) {
      toast({
        title: 'Enrolled successfully',
        description: result.isNew ? 'New user created and enrolled' : 'Existing user matched and enrolled',
      });
      setSelectedSubmission(null);
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
    } else {
      setErrors(prev => [...prev, { submission: sub, name, email, reason: result.error || 'Unknown error' }]);
      toast({ title: 'Enrollment failed', description: result.error, variant: 'destructive' });
    }
    setEnrolling(false);
  }

  async function handleManualAdd() {
    if (!manualEmail.trim()) return;
    setEnrolling(true);
    const result = await enrollSingle(manualName.trim(), manualEmail.trim());
    if (result.success) {
      toast({
        title: 'Student enrolled',
        description: result.isNew ? 'New user created and enrolled' : 'Existing user matched and enrolled',
      });
      setAddOpen(false);
      setManualName('');
      setManualEmail('');
      queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
    } else {
      toast({ title: 'Failed', description: result.error, variant: 'destructive' });
    }
    setEnrolling(false);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="bg-background border">
            <TabsTrigger value="applicants" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Applicants
            </TabsTrigger>
            {errors.length > 0 && (
              <TabsTrigger value="errors" className="gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Errors ({errors.length})
              </TabsTrigger>
            )}
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Import CSV
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Add Student
            </Button>
          </div>
        </div>

        <TabsContent value="applicants" className="mt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['all', 'new', 'reviewed', 'enrolled', 'rejected'] as const).map(status => (
              <button key={status} onClick={() => setFilterStatus(status)}
                className={cn("p-3 rounded-lg border text-center transition-colors",
                  filterStatus === status ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}>
                <p className="text-xl font-bold">{statusCounts[status]}</p>
                <p className="text-xs text-muted-foreground capitalize">{status === 'all' ? 'Total' : status}</p>
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {selectedIds.size > 0 && (
              <Button size="sm" className="gap-1.5" onClick={handleEnrollSelected} disabled={enrolling}>
                {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Enroll Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                <UserPlus className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                No applications yet. Share your registration form link to start receiving applications.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(sub => {
                      const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.new;
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedSubmission(sub)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(sub.id)}
                              onCheckedChange={() => toggleSelect(sub.id)} />
                          </TableCell>
                          <TableCell className="font-medium">{sub.data?.full_name || '—'}</TableCell>
                          <TableCell className="text-sm">{sub.data?.email || '—'}</TableCell>
                          <TableCell className="text-sm">{sub.data?.phone || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{sub.source_tag || 'Website'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(sub.submitted_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] gap-1", cfg.color)}>
                              <Icon className="h-3 w-3" /> {cfg.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">{errors.length} enrollment error(s)</p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setErrors([])}>
              Clear All
            </Button>
          </div>
          {errors.map((err, idx) => (
            <Card key={idx} className="border-destructive/30">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{err.name || '(no name)'} — {err.email || '(no email)'}</p>
                  <p className="text-xs text-destructive mt-0.5">{err.reason}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={async () => {
                  const result = await enrollSingle(err.name, err.email, err.submission?.id);
                  if (result.success) {
                    setErrors(prev => prev.filter((_, i) => i !== idx));
                    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
                    toast({ title: 'Retry successful' });
                  } else {
                    toast({ title: 'Retry failed', description: result.error, variant: 'destructive' });
                  }
                }}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Retry
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <Sheet open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Application Details</SheetTitle>
            <SheetDescription>
              {selectedSubmission && `Submitted ${format(new Date(selectedSubmission.submitted_at), 'PPpp')}`}
            </SheetDescription>
          </SheetHeader>
          {selectedSubmission && (
            <div className="space-y-4 mt-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = STATUS_CONFIG[selectedSubmission.status] || STATUS_CONFIG.new;
                  const Icon = cfg.icon;
                  return (
                    <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                      <Icon className="h-3.5 w-3.5" /> {cfg.label}
                    </Badge>
                  );
                })()}
                <Badge variant="outline" className="text-xs">{selectedSubmission.source_tag || 'Website'}</Badge>
              </div>

              {/* Form responses */}
              <div className="space-y-1 border rounded-lg p-3">
                {Object.entries(selectedSubmission.data).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
                    <span className="text-xs text-muted-foreground font-medium w-32 shrink-0 capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm flex-1">
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Select value={selectedSubmission.status}
                  onValueChange={(v) => {
                    updateStatus.mutate({ id: selectedSubmission.id, status: v });
                    setSelectedSubmission({ ...selectedSubmission, status: v });
                  }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                {selectedSubmission.status !== 'enrolled' && (
                  <Button className="gap-1.5" onClick={() => handleEnrollSingle(selectedSubmission)} disabled={enrolling}>
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Enroll
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Student Manually</DialogTitle>
            <DialogDescription>Enroll a student directly without a form submission</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Ahmed Ali" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={!manualEmail.trim() || enrolling}>
              {enrolling ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enrolling…</> : 'Enroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <CourseApplicantImport
        open={importOpen}
        onOpenChange={setImportOpen}
        courseId={courseId}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] })}
      />
    </div>
  );
}
