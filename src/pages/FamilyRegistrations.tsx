import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Copy, Eye, GraduationCap, Link2, Search, Users } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Status = 'pending' | 'approved' | 'rejected';
type Kind = 'all' | 'parent' | 'teacher';

const statusTone: Record<string, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
};

export default function FamilyRegistrations() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('pending');
  const [kind, setKind] = useState<Kind>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['family-registrations', status, kind],
    queryFn: async () => {
      let query = supabase.from('family_registrations').select('*').eq('status', status);
      if (kind !== 'all') query = query.eq('registration_type', kind);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((row) =>
      `${row.parent_name} ${row.email} ${row.phone}`.toLowerCase().includes(term) ||
      JSON.stringify(row.children ?? []).toLowerCase().includes(term));
  }, [data, search]);

  const publicLink = `${window.location.origin}/register/student`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Applications &amp; registrations</h1>
          <p className="text-sm text-muted-foreground">Every submitted student and teacher form. Open a row to review the full profile before approving.</p>
        </div>
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: 'Link copied', description: publicLink }); }}>
          <Copy className="h-4 w-4 mr-1" />Copy student form link
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(value) => setStatus(value as Status)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="parent">Students / families</TabsTrigger>
            <TabsTrigger value="teacher">Teachers</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email, student…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-60" />
          No {status} applications. Share the registration links with families and applicants to get started.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider">Applicant</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Guardian</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Location</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Submitted</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-wider">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const children = Array.isArray(row.children) ? (row.children as any[]) : [];
                  const isTeacher = row.registration_type === 'teacher';
                  const applicant = (row.applicant_data as any) ?? {};
                  const studentName = (row as any).student_name || children[0]?.name || null;
                  const name = isTeacher ? (applicant.full_name || row.parent_name) : (studentName || row.parent_name);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/people/registrations/${row.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isTeacher ? 'bg-violet-500/15 text-violet-600' : 'bg-sky-500/15 text-sky-600'}`}>
                            {(name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{isTeacher ? 'Teacher applicant' : 'Student'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={isTeacher ? 'border-violet-500/40 bg-violet-500/10 text-violet-600' : 'border-sky-500/40 bg-sky-500/10 text-sky-600'}>
                          {isTeacher ? <GraduationCap className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                          {isTeacher ? 'Teacher' : 'Student'}
                        </Badge>
                        {row.lead_id && <Badge variant="secondary" className="ml-1.5 gap-1"><Link2 className="h-3 w-3" />Enquiry</Badge>}
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        <p className="truncate max-w-[200px]">{row.email}</p>
                        <p className="text-xs text-muted-foreground">{row.phone}</p>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {isTeacher ? '—' : (
                          <>
                            <p className="truncate max-w-[180px]">{row.parent_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{row.relationship || 'Guardian'}</p>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">{[row.city, row.country].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap">{format(new Date(row.created_at), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`capitalize ${statusTone[row.status] ?? ''}`}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" title="Open full review" onClick={() => navigate(`/people/registrations/${row.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
