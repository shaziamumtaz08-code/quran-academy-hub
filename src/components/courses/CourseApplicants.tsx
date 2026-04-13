import React, { useState, useRef, useMemo } from 'react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Search, Eye, Clock, CheckCircle2, XCircle, UserPlus, Loader2,
  Users, FileSpreadsheet, X, MoreVertical, Download, Copy,
  ExternalLink, ArrowUpDown, Trash2, ChevronRight, ClipboardList,
  UserCheck, LayoutList
} from 'lucide-react';
import { format } from 'date-fns';
import { CourseApplicantImport } from './CourseApplicantImport';
import { UserRelationshipPanel } from './UserRelationshipPanel';
import { useNavigate } from 'react-router-dom';

interface Submission {
  id: string;
  form_id: string;
  course_id: string;
  data: Record<string, any>;
  status: string;
  source_tag: string | null;
  submitted_at: string;
  notes: string | null;
  enrollment_id?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Clock },
  reviewed: { label: 'Reviewed', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Eye },
  enrolled: { label: 'Enrolled', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

type SortKey = 'submitted_at' | 'name' | 'status' | 'city';

export function CourseApplicants({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('submitted_at');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualEnrolling, setManualEnrolling] = useState(false);
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [relationshipApplicant, setRelationshipApplicant] = useState<{
    email: string; phone?: string; data?: Record<string, any>;
  } | null>(null);
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);

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

  const { data: rosteredCount = 0 } = useQuery({
    queryKey: ['course-rostered-count', courseId],
    queryFn: async () => {
      const { data: classes } = await supabase
        .from('course_classes')
        .select('id')
        .eq('course_id', courseId);
      if (!classes?.length) return 0;
      const { count } = await supabase
        .from('course_class_students')
        .select('id', { count: 'exact', head: true })
        .in('class_id', classes.map(c => c.id));
      return count || 0;
    },
  });

  // Filter + Search + Sort
  const filtered = useMemo(() => {
    let result = submissions.filter(s => {
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      if (!matchStatus) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const d = s.data || {};
      return (
        (d.full_name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      switch (sortKey) {
        case 'name': return (a.data?.full_name || '').localeCompare(b.data?.full_name || '');
        case 'status': return a.status.localeCompare(b.status);
        case 'city': return (a.data?.city || '').localeCompare(b.data?.city || '');
        default: return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      }
    });
    return result;
  }, [submissions, filterStatus, search, sortKey]);

  const selectableFiltered = filtered.filter(s => s.status === 'new' || s.status === 'reviewed');
  const statusCounts = useMemo(() => ({
    all: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    reviewed: submissions.filter(s => s.status === 'reviewed').length,
    enrolled: submissions.filter(s => s.status === 'enrolled').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }), [submissions]);

  const headerChecked = selectableFiltered.length > 0 && selectableFiltered.every(s => selectedIds.has(s.id));
  const headerIndeterminate = !headerChecked && selectableFiltered.some(s => selectedIds.has(s.id));

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      const input = headerCheckboxRef.current.querySelector('input');
      if (input) input.indeterminate = headerIndeterminate;
    }
  }, [headerIndeterminate]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleAll = () => {
    if (headerChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableFiltered.map(s => s.id)));
  };

  // ─── Save email for an applicant ───
  async function saveEmail(subId: string, newEmail: string) {
    const sub = submissions.find(s => s.id === subId);
    if (!sub) return;
    const updatedData = { ...sub.data, email: newEmail.toLowerCase().trim() };
    const { error } = await supabase.from('registration_submissions')
      .update({ data: updatedData as any })
      .eq('id', subId);
    if (error) { toast.error(error.message); return; }
    toast.success('Email saved');
    setEditEmailId(null);
    setEditEmailValue('');
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
  }

  // ─── Enrollment via Edge Function ───
  async function enrollSubmission(submissionId: string): Promise<{ success: boolean; matched: boolean; name: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('enroll-applicant', {
      body: { submission_id: submissionId, course_id: courseId },
    });
    if (error) return { success: false, matched: false, name: '', error: error.message };
    if (data?.error) return { success: false, matched: false, name: '', error: data.error };
    return {
      success: true,
      matched: data.matched_existing || false,
      name: data.student_name || '',
    };
  }

  async function handleEnrollSingle(sub: Submission) {
    const d = sub.data || {};
    if (!d.email?.trim()) {
      toast.error('Email is required before enrollment. Click "Add email" in the table to add one.');
      return;
    }
    setEnrollingId(sub.id);
    const result = await enrollSubmission(sub.id);
    if (result.success) {
      toast.success(
        result.matched
          ? `Matched existing profile — ${result.name} enrolled to course`
          : `Student "${result.name}" enrolled successfully`
      );
      setSelectedSubmission(null);
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
    } else {
      toast.error(result.error || 'Enrollment failed');
    }
    setEnrollingId(null);
  }

  // Status update
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('registration_submissions')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] }),
  });

  // Delete submission
  async function handleDelete(id: string) {
    const { error } = await supabase.from('registration_submissions').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Applicant deleted');
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
      if (selectedSubmission?.id === id) setSelectedSubmission(null);
    }
    setDeleteDialogId(null);
  }

  // Bulk operations
  async function handleBulkEnroll() {
    setBatchLoading(true);
    const ids = Array.from(selectedIds);
    
    // Filter out applicants without valid emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const withEmail: string[] = [];
    const withoutEmail: string[] = [];
    for (const id of ids) {
      const sub = submissions?.find((s: any) => s.id === id);
      const email = (sub?.data?.email || '').trim();
      if (email && emailRegex.test(email)) {
        withEmail.push(id);
      } else {
        withoutEmail.push(id);
      }
    }

    if (withoutEmail.length > 0) {
      toast.error(`${withoutEmail.length} applicant(s) skipped — email is required before enrollment`);
    }

    if (withEmail.length === 0) {
      setBatchLoading(false);
      return;
    }

    let enrolled = 0, errors = 0;
    for (const id of withEmail) {
      const result = await enrollSubmission(id);
      if (result.success) enrolled++; else errors++;
    }
    toast.success(`${enrolled} enrolled${errors > 0 ? `, ${errors} failed` : ''}`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
    setBatchLoading(false);
  }

  async function handleBulkReview() {
    setBatchLoading(true);
    await supabase.from('registration_submissions').update({ status: 'reviewed' }).in('id', Array.from(selectedIds));
    toast.success(`${selectedIds.size} marked as reviewed`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
    setBatchLoading(false);
  }

  async function handleBulkReject() {
    setBatchLoading(true);
    await supabase.from('registration_submissions').update({ status: 'rejected' }).in('id', Array.from(selectedIds));
    toast.success(`${selectedIds.size} rejected`);
    setSelectedIds(new Set());
    setRejectDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
    setBatchLoading(false);
  }

  // Manual add
  async function handleManualAdd() {
    if (!manualEmail.trim()) return;
    setManualEnrolling(true);
    // Create a submission first, then enroll
    const { data: sub, error } = await supabase.from('registration_submissions').insert({
      form_id: courseId,
      course_id: courseId,
      data: { full_name: manualName.trim(), email: manualEmail.trim().toLowerCase() },
      source_tag: 'manual',
      status: 'new',
    }).select('id').single();

    if (error || !sub) {
      toast.error(error?.message || 'Failed to add');
      setManualEnrolling(false);
      return;
    }

    const result = await enrollSubmission(sub.id);
    if (result.success) {
      toast.success(`${result.name} enrolled`);
      setAddOpen(false);
      setManualName('');
      setManualEmail('');
      queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course-enrolled', courseId] });
    } else {
      toast.error(result.error || 'Enrollment failed');
    }
    setManualEnrolling(false);
  }

  // Export CSV
  function exportCSV(rows: Submission[]) {
    const headers = ['Full Name', "Father's Name", 'Email', 'Phone', 'Gender', 'City', 'Age', 'Country', 'Source', 'Applied At', 'Status'];
    const csvRows = [headers.join(',')];
    for (const s of rows) {
      const d = s.data || {};
      csvRows.push([
        `"${(d.full_name || '').replace(/"/g, '""')}"`,
        `"${(d.fathers_name || d.father_name || '').replace(/"/g, '""')}"`,
        `"${(d.email || '').replace(/"/g, '""')}"`,
        `"${(d.phone || '').replace(/"/g, '""')}"`,
        `"${(d.gender || '').replace(/"/g, '""')}"`,
        `"${(d.city || '').replace(/"/g, '""')}"`,
        `"${(d.age || '').toString().replace(/"/g, '""')}"`,
        `"${(d.country || '').replace(/"/g, '""')}"`,
        `"${(s.source_tag || 'Website').replace(/"/g, '""')}"`,
        `"${format(new Date(s.submitted_at), 'yyyy-MM-dd HH:mm')}"`,
        `"${s.status}"`,
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applicants-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Applicants
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => exportCSV(filtered)}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Import
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* ──── Visual Pipeline Tracker ──── */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 px-3 sm:px-6">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Enrollment Pipeline</p>
          <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto">
            {[
              { label: 'Applied', count: statusCounts.all, icon: ClipboardList, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
              { label: 'Reviewed', count: statusCounts.reviewed + statusCounts.enrolled, icon: Eye, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
              { label: 'Enrolled', count: statusCounts.enrolled, icon: UserCheck, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
              { label: 'Rostered', count: rosteredCount, icon: LayoutList, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.label}>
                <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", step.color)}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-lg font-bold leading-none">{step.count}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-[-18px]" />
                )}
              </React.Fragment>
            ))}
          </div>
          {(() => {
            const missingEmailCount = submissions.filter(s => s.status !== 'enrolled' && s.status !== 'rejected' && !s.data?.email?.trim()).length;
            return (
              <>
                {missingEmailCount > 0 && (
                  <p className="text-[11px] text-destructive mt-3 flex items-center gap-1">
                    ⚠ {missingEmailCount} applicant{missingEmailCount !== 1 ? 's' : ''} missing email — cannot be enrolled until email is added.
                  </p>
                )}
                {statusCounts.enrolled > 0 && rosteredCount < statusCounts.enrolled && (
                  <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1">
                    ✓ Students are auto-assigned to the default class on enrollment.
                  </p>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Stat Cards — clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['all', 'new', 'reviewed', 'enrolled', 'rejected'] as const).map(status => (
          <button key={status} onClick={() => setFilterStatus(status)}
            className={cn("p-3 rounded-lg border text-center transition-all",
              filterStatus === status ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30")}>
            <p className="text-xl font-bold">{statusCounts[status]}</p>
            <p className="text-xs text-muted-foreground capitalize">{status === 'all' ? 'Total' : status}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted_at">Applied Date ↓</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="city">City</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            <UserPlus className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
            {submissions.length === 0
              ? 'No applications yet. Share your registration form link.'
              : 'No applicants match current filters.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <Checkbox ref={headerCheckboxRef} checked={headerChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="w-10 px-2 text-xs">#</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Father</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Phone</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Gender</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">City</TableHead>
                  <TableHead className="text-xs hidden xl:table-cell">Age</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Source</TableHead>
                  <TableHead className="text-xs">Applied</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="w-10 px-2 sticky right-0 bg-background z-[5]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub, idx) => {
                  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.new;
                  const Icon = cfg.icon;
                  const isSelectable = sub.status === 'new' || sub.status === 'reviewed';
                  const isSelected = selectedIds.has(sub.id);
                  const d = sub.data || {};
                  return (
                    <TableRow key={sub.id}
                      className={cn("cursor-pointer hover:bg-muted/50", isSelected && "bg-primary/5")}
                      onClick={() => setSelectedSubmission(sub)}>
                      <TableCell className="px-3" onClick={e => e.stopPropagation()}>
                        {isSelectable ? (
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(sub.id)} />
                        ) : <div className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="px-2 text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm">
                        <button className="text-left hover:underline text-primary/80 hover:text-primary"
                          onClick={e => {
                            e.stopPropagation();
                            setRelationshipApplicant({
                              email: d.email || '', phone: d.phone || d.whatsapp_number || '', data: d,
                            });
                          }}>
                          {d.full_name || '—'}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell">{d.fathers_name || d.father_name || '—'}</TableCell>
                      <TableCell className="text-sm" onClick={e => e.stopPropagation()}>
                        {editEmailId === sub.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="email"
                              value={editEmailValue}
                              onChange={e => setEditEmailValue(e.target.value)}
                              className="h-7 text-xs w-[180px]"
                              placeholder="email@example.com"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && editEmailValue.includes('@')) saveEmail(sub.id, editEmailValue);
                                if (e.key === 'Escape') { setEditEmailId(null); setEditEmailValue(''); }
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              disabled={!editEmailValue.includes('@')}
                              onClick={() => saveEmail(sub.id, editEmailValue)}>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6"
                              onClick={() => { setEditEmailId(null); setEditEmailValue(''); }}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : d.email ? (
                          <span>{d.email}</span>
                        ) : (
                          <button
                            className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 font-medium"
                            onClick={() => { setEditEmailId(sub.id); setEditEmailValue(''); }}>
                            <UserPlus className="h-3 w-3" /> Add email
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell">{d.phone || '—'}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{d.gender || '—'}</TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{d.city || '—'}</TableCell>
                      <TableCell className="text-xs hidden xl:table-cell">{d.age || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{sub.source_tag || 'Website'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(sub.submitted_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] gap-1", cfg.color)}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2 sticky right-0 bg-background z-[5] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => setSelectedSubmission(sub)}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                            </DropdownMenuItem>
                            {sub.status !== 'enrolled' && (
                              <DropdownMenuItem onClick={() => handleEnrollSingle(sub)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Enroll
                              </DropdownMenuItem>
                            )}
                            {sub.status !== 'reviewed' && sub.status !== 'enrolled' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: sub.id, status: 'reviewed' })}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Mark Reviewed
                              </DropdownMenuItem>
                            )}
                            {sub.status !== 'rejected' && sub.status !== 'enrolled' && (
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: sub.id, status: 'rejected' })}>
                                <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialogId(sub.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur border-t shadow-lg py-3 px-6 flex items-center justify-between rounded-b-lg -mx-1">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={batchLoading}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCSV(submissions.filter(s => selectedIds.has(s.id)))} disabled={batchLoading}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkReview} disabled={batchLoading}>
              {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              Reviewed
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
              onClick={() => setRejectDialogOpen(true)} disabled={batchLoading}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleBulkEnroll} disabled={batchLoading}>
              {batchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Enroll
            </Button>
          </div>
        </div>
      )}

      {/* ──── Detail Side Panel ──── */}
      <Sheet open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <SheetContent className="sm:max-w-[560px] overflow-y-auto">
          <SheetHeader className="pb-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              {selectedSubmission?.data?.full_name || 'Applicant'}
            </SheetTitle>
          </SheetHeader>
          {selectedSubmission && (() => {
            const sub = selectedSubmission;
            const d = sub.data || {};
            const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.new;
            const Icon = cfg.icon;
            const dataEntries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '');

            return (
              <div className="space-y-5 mt-4">
                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                    <Icon className="h-3.5 w-3.5" /> {cfg.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{sub.source_tag || 'Website'}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(sub.submitted_at), 'PPpp')}
                  </span>
                </div>

                <Separator />

                {/* Data Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {dataEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <p className="text-xs text-muted-foreground capitalize mb-0.5 flex items-center gap-1">
                        {key.replace(/_/g, ' ')}
                        {key === 'email' && (
                          <button className="hover:text-primary" title="Copy email"
                            onClick={() => { navigator.clipboard.writeText(String(value)); toast.success('Email copied'); }}>
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </p>
                      <p className="text-sm font-medium truncate">{String(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Enrolled badge */}
                {sub.enrollment_id && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Enrolled & rostered
                  </span>
                )}

                {/* Missing email warning */}
                {!d.email?.trim() && sub.status !== 'enrolled' && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">⚠ Email required for enrollment</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={editEmailId === sub.id ? editEmailValue : ''}
                        onChange={e => { setEditEmailId(sub.id); setEditEmailValue(e.target.value); }}
                        onFocus={() => setEditEmailId(sub.id)}
                        className="h-8 text-sm flex-1"
                        placeholder="Enter student email"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editEmailValue.includes('@')) saveEmail(sub.id, editEmailValue);
                        }}
                      />
                      <Button size="sm" variant="outline"
                        disabled={!editEmailValue.includes('@') || editEmailId !== sub.id}
                        onClick={() => saveEmail(sub.id, editEmailValue)}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  {sub.status !== 'enrolled' && (
                    <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                      onClick={() => handleEnrollSingle(sub)}
                      disabled={enrollingId === sub.id || !d.email?.trim()}>
                      {enrollingId === sub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {!d.email?.trim() ? 'Add email first' : 'Enroll'}
                    </Button>
                  )}
                  {sub.status !== 'reviewed' && sub.status !== 'enrolled' && (
                    <Button variant="outline" className="gap-1.5 flex-1"
                      onClick={() => {
                        updateStatus.mutate({ id: sub.id, status: 'reviewed' });
                        setSelectedSubmission({ ...sub, status: 'reviewed' });
                      }}>
                      <Eye className="h-4 w-4" /> Reviewed
                    </Button>
                  )}
                  {sub.status !== 'rejected' && sub.status !== 'enrolled' && (
                    <Button variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        updateStatus.mutate({ id: sub.id, status: 'rejected' });
                        setSelectedSubmission({ ...sub, status: 'rejected' });
                      }}>
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Manual Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Enroll directly without a form submission</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Ahmed Ali" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleManualAdd} disabled={!manualEmail.trim() || manualEnrolling}>
              {manualEnrolling ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Enrolling…</> : 'Enroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <CourseApplicantImport open={importOpen} onOpenChange={setImportOpen} courseId={courseId}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['registration-submissions', courseId] })} />

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {selectedIds.size} applicant{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>Status can be changed later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkReject} disabled={batchLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {batchLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this applicant?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the submission record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteDialogId && handleDelete(deleteDialogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Relationship Panel */}
      <UserRelationshipPanel open={!!relationshipApplicant} onOpenChange={() => setRelationshipApplicant(null)}
        email={relationshipApplicant?.email || ''} phone={relationshipApplicant?.phone}
        submissionData={relationshipApplicant?.data} courseId={courseId} />
    </div>
  );
}
