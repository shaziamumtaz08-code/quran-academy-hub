import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Search, Eye, Clock, CheckCircle2, XCircle, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Clock },
  reviewed: { label: 'Reviewed', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Eye },
  enrolled: { label: 'Enrolled', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

export function CourseApplicants({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

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
      toast({ title: 'Status updated' });
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

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(['all', 'new', 'reviewed', 'enrolled', 'rejected'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "p-3 rounded-lg border text-center transition-colors",
              filterStatus === status ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            )}>
            <p className="text-xl font-bold">{statusCounts[status]}</p>
            <p className="text-xs text-muted-foreground capitalize">{status === 'all' ? 'Total' : status}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(sub => {
                  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.new;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSubmission(sub)}>
                      <TableCell className="font-medium">{sub.data?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm">{sub.data?.email || '—'}</TableCell>
                      <TableCell className="text-sm">{sub.data?.phone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{sub.source_tag || 'website'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(sub.submitted_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs gap-1", cfg.color)}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select value={sub.status} onValueChange={(v) => updateStatus.mutate({ id: sub.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="enrolled">Enrolled</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Submitted {selectedSubmission && format(new Date(selectedSubmission.submitted_at), 'PPpp')}
            </DialogDescription>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-3 py-2">
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
              <div className="pt-2">
                <Select value={selectedSubmission.status}
                  onValueChange={(v) => {
                    updateStatus.mutate({ id: selectedSubmission.id, status: v });
                    setSelectedSubmission({ ...selectedSubmission, status: v });
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
