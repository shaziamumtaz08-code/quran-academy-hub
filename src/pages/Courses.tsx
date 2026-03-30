import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, BookOpen, Users, Eye, Archive, Globe, Pencil, ExternalLink, Clock, Star, ArrowUpDown, MoreHorizontal, Copy, Sparkles, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────
interface Course {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string;
  subject_id: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  max_students: number;
  is_group_class: boolean;
  level: string;
  website_enabled: boolean;
  seo_slug: string | null;
  enrollment_type: string;
  tags: string[];
  hero_image_url: string | null;
  created_at: string;
  teacher?: { full_name: string };
  subject?: { name: string } | null;
  enrollment_count?: number;
}

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];

// ─── Main Component ────────────────────────────────────
export default function Courses() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeDivision, activeBranch } = useDivision();
  const { activeRole, profile } = useAuth();

  const canManage = useMemo(() => {
    const allowed = new Set(['super_admin', 'admin', 'admin_academic']);
    const assignedRoles = profile?.roles || [];
    return assignedRoles.some((r) => allowed.has(r)) || (activeRole ? allowed.has(activeRole) : false);
  }, [activeRole, profile?.roles]);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formLevel, setFormLevel] = useState('All Levels');
  const [formMaxStudents, setFormMaxStudents] = useState('30');
  const [formWebsiteEnabled, setFormWebsiteEnabled] = useState(false);

  // ─── Queries ──────────────────────────────────────────
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', activeDivision?.id],
    queryFn: async () => {
      let q = supabase
        .from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (activeDivision?.id) q = q.eq('division_id', activeDivision.id);
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;

      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('status', 'active');

      const countMap: Record<string, number> = {};
      (enrollments || []).forEach(e => { countMap[e.course_id] = (countMap[e.course_id] || 0) + 1; });

      return (data || []).map(c => ({
        ...c,
        level: c.level || 'All Levels',
        website_enabled: c.website_enabled || false,
        tags: c.tags || [],
        enrollment_count: countMap[c.id] || 0,
      })) as Course[];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-courses'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name')
        .in('id', roleRows.map((r: any) => r.user_id)).is('archived_at', null).order('full_name');
      return profiles || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('id, name').eq('is_active', true);
      return data || [];
    },
  });

  // ─── Mutations ────────────────────────────────────────
  const createCourse = useMutation({
    mutationFn: async () => {
      let branchId = activeBranch?.id ?? null;
      let divisionId = activeDivision?.id ?? null;

      if ((!branchId || !divisionId) && profile?.id) {
        const { data: ctx } = await supabase.rpc('get_user_default_context', { _user_id: profile.id }).maybeSingle();
        branchId = branchId || ctx?.branch_id || null;
        divisionId = divisionId || ctx?.division_id || null;
      }
      if (!branchId || !divisionId) throw new Error('Please select a branch/division first');

      const slug = formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data, error } = await supabase.from('courses').insert({
        name: formName.trim() || `Untitled Course`,
        description: formDescription || null,
        teacher_id: formTeacherId || profile?.id,
        subject_id: formSubjectId || null,
        start_date: formStartDate || format(new Date(), 'yyyy-MM-dd'),
        max_students: parseInt(formMaxStudents) || 30,
        level: formLevel,
        website_enabled: formWebsiteEnabled,
        seo_slug: slug || null,
        branch_id: branchId,
        division_id: divisionId,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Course created' });
      if (data?.id) navigate(`/courses/${data.id}`);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormTeacherId('');
    setFormSubjectId(''); setFormStartDate(''); setFormLevel('All Levels');
    setFormMaxStudents('30'); setFormWebsiteEnabled(false);
  };

  // ─── Filtering ────────────────────────────────────────
  const filtered = useMemo(() => {
    return courses.filter(c => {
      const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c as any).teacher?.full_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchLevel = filterLevel === 'all' || c.level === filterLevel;
      return matchSearch && matchStatus && matchLevel;
    });
  }, [courses, search, filterStatus, filterLevel]);

  const stats = useMemo(() => ({
    total: courses.length,
    active: courses.filter(c => c.status === 'active').length,
    published: courses.filter(c => c.website_enabled).length,
    students: courses.reduce((sum, c) => sum + (c.enrollment_count || 0), 0),
  }), [courses]);

  // ─── Render ───────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Premium Header */}
        <div className="page-header-premium rounded-xl p-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                <BookOpen className="h-6 w-6" /> Course Management
              </h1>
              <p className="text-white/80 mt-1">Create, manage, and publish courses across your academy</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => navigate('/course-assets')}>
                <Star className="h-4 w-4 mr-1" /> Asset Library
              </Button>
              {canManage && (
                <Button onClick={() => setCreateOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Plus className="h-4 w-4 mr-1" /> New Course
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Courses', value: stats.total, icon: BookOpen, color: 'text-primary' },
            { label: 'Active', value: stats.active, icon: Clock, color: 'text-emerald-600' },
            { label: 'Published', value: stats.published, icon: Globe, color: 'text-accent' },
            { label: 'Students', value: stats.students, icon: Users, color: 'text-amber-600' },
          ].map(s => (
            <Card key={s.label} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-muted", s.color)}><s.icon className="h-5 w-5" /></div>
                <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search courses or teachers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No courses found. Create your first course to get started.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(course => (
              <Card key={course.id}
                className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01] overflow-hidden border-border/60"
                onClick={() => navigate(`/courses/${course.id}`)}>
                {/* Hero strip */}
                <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary/60" />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{course.name}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {(course as any).teacher?.full_name || 'Unassigned'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <Badge variant={course.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {course.status}
                      </Badge>
                      {course.website_enabled && (
                        <Badge variant="outline" className="text-xs text-accent border-accent/30">
                          <Globe className="h-3 w-3 mr-1" /> Live
                        </Badge>
                      )}
                    </div>
                  </div>

                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {course.enrollment_count}/{course.max_students}</span>
                    <span>{(course as any).subject?.name || 'General'}</span>
                    <Badge variant="outline" className="text-xs">{course.level}</Badge>
                    <span className="ml-auto">{format(new Date(course.start_date), 'MMM yyyy')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Course Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif">Create New Course</DialogTitle>
              <DialogDescription>Set up a new course for your academy</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Course Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Spoken Arabic for Beginners" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Brief course overview…" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Teacher *</Label>
                  <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select value={formLevel} onValueChange={setFormLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max Students</Label>
                  <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch checked={formWebsiteEnabled} onCheckedChange={setFormWebsiteEnabled} />
                <div>
                  <Label className="text-sm font-medium">Publish to Website</Label>
                  <p className="text-xs text-muted-foreground">Make this course visible on the public website</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createCourse.mutate()} disabled={createCourse.isPending || !formName.trim()}>
                {createCourse.isPending ? 'Creating…' : 'Create Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
