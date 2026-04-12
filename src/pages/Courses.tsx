import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout as DashboardLayout } from "@/components/layout/ConditionalDashboardLayout";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { FileUploadField } from '@/components/shared/FileUploadField';
import {
  Plus, Search, BookOpen, Users, Globe, Clock, Star,
  Sparkles, Loader2, X, Library, MoreVertical, Trash2, Copy
} from 'lucide-react';
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
const TAG_OPTIONS = ['Quran', 'Arabic', 'Tajweed', 'Hifz', 'Islamic Studies', 'Qaida', 'Spoken Arabic', 'Grammar', 'Online', 'Weekend', 'Intensive', 'Kids', 'Adults', 'Sisters Only'];

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
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<Course | null>(null);
  const [dupName, setDupName] = useState('');
  const [dupOptions, setDupOptions] = useState({ modules: true, classes: true, assignments: false, feePlans: false, marketing: false });
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formLevel, setFormLevel] = useState('All Levels');
  const [formMaxStudents, setFormMaxStudents] = useState('30');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formWebsiteEnabled, setFormWebsiteEnabled] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Website fields
  const [webDescription, setWebDescription] = useState('');
  const [webOutcomes, setWebOutcomes] = useState('');
  const [webSyllabus, setWebSyllabus] = useState('');
  const [webFaqs, setWebFaqs] = useState('');
  const [webContactEmail, setWebContactEmail] = useState('');
  const [webWhatsapp, setWebWhatsapp] = useState('');
  const [webHeroImage, setWebHeroImage] = useState('');

  // ─── Queries ──────────────────────────────────────────
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', activeDivision?.id],
    queryFn: async () => {
      let q = supabase
        .from('courses')
        .select('*, subject:subjects!courses_subject_id_fkey(name)')
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

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('id, name').eq('is_active', true);
      return data || [];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-courses'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'super_admin', 'admin_academic'] as any);
      if (!roleRows?.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name')
        .in('id', roleRows.map((r: any) => r.user_id)).is('archived_at', null).order('full_name');
      return profiles || [];
    },
  });

  // ─── AI Assist ────────────────────────────────────────
  const handleAiAssist = async () => {
    if (!formName.trim()) {
      toast({ title: 'Enter a course name first', variant: 'destructive' });
      return;
    }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-course-content', {
        body: {
          prompt: `Write a compelling 2-3 sentence course description for a course called "${formName}". Level: ${formLevel}. Subject: ${subjects.find((s: any) => s.id === formSubjectId)?.name || 'General'}. Keep it professional and engaging for an Islamic education academy.`,
          lessonTitle: formName,
        },
      });
      if (error) throw error;
      const content = data?.content || '';
      // Strip HTML tags for plain text description
      const plainText = content.replace(/<[^>]*>/g, '').trim();
      setFormDescription(plainText);
      toast({ title: 'Description generated!' });
    } catch (err: any) {
      toast({ title: 'AI generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setAiGenerating(false);
    }
  };

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

      // Parse FAQs from question|answer format
      const faqs = webFaqs.trim()
        ? webFaqs.split('\n').filter(l => l.includes('|')).map(l => {
            const [q, a] = l.split('|').map(s => s.trim());
            return { question: q, answer: a };
          })
        : null;

      // Parse outcomes
      const outcomes = webOutcomes.trim()
        ? webOutcomes.split('\n').filter(l => l.trim()).map(l => l.trim())
        : null;

      // Contact info
      const contactInfo = (webContactEmail || webWhatsapp)
        ? { email: webContactEmail || null, whatsapp: webWhatsapp || null }
        : null;

      const { data, error } = await supabase.from('courses').insert({
        name: formName.trim() || 'Untitled Course',
        description: formDescription || null,
        teacher_id: profile?.id,
        subject_id: formSubjectId || null,
        start_date: formStartDate || format(new Date(), 'yyyy-MM-dd'),
        end_date: formEndDate || null,
        max_students: parseInt(formMaxStudents) || 30,
        level: formLevel,
        tags: formTags.length ? formTags : null,
        website_enabled: formWebsiteEnabled,
        seo_slug: slug || null,
        branch_id: branchId,
        division_id: divisionId,
        // Website fields
        hero_image_url: formWebsiteEnabled ? (webHeroImage || null) : null,
        syllabus_text: formWebsiteEnabled ? (webSyllabus || null) : null,
        outcomes: formWebsiteEnabled ? outcomes : null,
        faqs: formWebsiteEnabled ? faqs : null,
        contact_info: formWebsiteEnabled ? contactInfo : null,
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
    setFormSubjectId(''); setFormStartDate(''); setFormEndDate('');
    setFormLevel('All Levels'); setFormMaxStudents('30'); setFormTags([]);
    setFormWebsiteEnabled(false);
    setWebDescription(''); setWebOutcomes(''); setWebSyllabus('');
    setWebFaqs(''); setWebContactEmail(''); setWebWhatsapp(''); setWebHeroImage('');
  };

  // ─── Tag toggle ───────────────────────────────────────
  const toggleTag = (tag: string) => {
    setFormTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // ─── Delete Course (cascade) ─────────────────────────
  const handleDeleteCourse = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const cid = deleteTarget.id;
      // Cascade delete in FK order
      await supabase.from('course_lesson_plans').delete().eq('course_id', cid);
      await supabase.from('course_lessons').delete().eq('course_id', cid);
      await supabase.from('course_modules').delete().eq('course_id', cid);
      await supabase.from('course_enrollments').delete().eq('course_id', cid);
      await supabase.from('course_assignment_submissions').delete().in('assignment_id',
        (await supabase.from('course_assignments').select('id').eq('course_id', cid)).data?.map((a: any) => a.id) || []
      );
      await supabase.from('course_assignments').delete().eq('course_id', cid);
      await supabase.from('course_notifications').delete().eq('course_id', cid);
      await supabase.from('course_message_sequences').delete().eq('course_id', cid);
      await supabase.from('course_fee_payments').delete().in('student_fee_id',
        (await supabase.from('course_student_fees').select('id').eq('course_id', cid)).data?.map((f: any) => f.id) || []
      );
      await supabase.from('course_student_fees').delete().eq('course_id', cid);
      await supabase.from('course_fee_plans').delete().eq('course_id', cid);
      await supabase.from('course_certificate_awards').delete().eq('course_id', cid);
      await supabase.from('course_certificates').delete().eq('course_id', cid);
      await supabase.from('course_badges').delete().eq('course_id', cid);
      await supabase.from('course_post_replies').delete().in('post_id',
        (await supabase.from('course_posts').select('id').eq('course_id', cid)).data?.map((p: any) => p.id) || []
      );
      await supabase.from('course_posts').delete().eq('course_id', cid);
      // Classes: remove students/staff first, nullify zoom refs
      const classIds = (await supabase.from('course_classes').select('id').eq('course_id', cid)).data?.map((c: any) => c.id) || [];
      if (classIds.length) {
        await supabase.from('course_class_students').delete().in('class_id', classIds);
        await supabase.from('course_class_staff').delete().in('class_id', classIds);
      }
      await supabase.from('course_classes').delete().eq('course_id', cid);
      // Syllabi & session plans
      const syllabiIds = (await supabase.from('syllabi').select('id').eq('course_id', cid)).data?.map((s: any) => s.id) || [];
      if (syllabiIds.length) {
        await supabase.from('session_plans').delete().in('syllabus_id', syllabiIds);
      }
      await supabase.from('syllabi').delete().eq('course_id', cid);
      // Finally delete the course
      const { error } = await supabase.from('courses').delete().eq('id', cid);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Course deleted permanently' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ─── Duplicate Course ────────────────────────────────
  const handleDuplicateCourse = async () => {
    if (!duplicateTarget) return;
    setDuplicating(true);
    try {
      const src = duplicateTarget;
      // Insert new course as draft
      const { data: newCourse, error } = await supabase.from('courses').insert({
        name: dupName.trim() || `Copy of ${src.name}`,
        description: src.description,
        teacher_id: src.teacher_id,
        subject_id: src.subject_id,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: null,
        max_students: src.max_students,
        level: src.level,
        tags: src.tags,
        status: 'draft',
        website_enabled: dupOptions.marketing ? src.website_enabled : false,
        seo_slug: null,
        is_group_class: src.is_group_class,
        enrollment_type: src.enrollment_type,
        hero_image_url: dupOptions.marketing ? src.hero_image_url : null,
      } as any).select('id').single();
      if (error) throw error;
      const newId = newCourse.id;

      // Duplicate modules & lessons
      if (dupOptions.modules) {
        const { data: modules } = await supabase.from('course_modules').select('*').eq('course_id', src.id).order('sort_order');
        for (const mod of modules || []) {
          const { data: newMod } = await supabase.from('course_modules').insert({
            course_id: newId, title: mod.title, sort_order: mod.sort_order,
          }).select('id').single();
          if (newMod) {
            const { data: lessons } = await supabase.from('course_lessons').select('*').eq('module_id', mod.id).order('sort_order');
            for (const les of lessons || []) {
              await supabase.from('course_lessons').insert({
                course_id: newId, module_id: newMod.id, title: les.title,
                content_type: les.content_type, content_html: les.content_html,
                video_url: les.video_url, file_url: les.file_url, sort_order: les.sort_order,
              });
            }
          }
        }
      }

      // Duplicate classes (schedule only, no students)
      if (dupOptions.classes) {
        const { data: srcClasses } = await supabase.from('course_classes').select('*').eq('course_id', src.id);
        for (const cls of srcClasses || []) {
          await supabase.from('course_classes').insert({
            course_id: newId, name: cls.name, schedule_days: cls.schedule_days,
            schedule_time: cls.schedule_time, timezone: cls.timezone,
            session_duration: cls.session_duration, max_seats: cls.max_seats,
            class_type: cls.class_type, fee_amount: cls.fee_amount,
            fee_currency: cls.fee_currency, is_volunteer: cls.is_volunteer,
          });
        }
      }

      // Duplicate assignments
      if (dupOptions.assignments) {
        const { data: srcAssignments } = await supabase.from('course_assignments').select('*').eq('course_id', src.id);
        for (const a of srcAssignments || []) {
          await supabase.from('course_assignments').insert({
            course_id: newId, title: a.title, instructions: a.instructions,
            file_url: a.file_url, file_name: a.file_name, status: 'draft',
          });
        }
      }

      // Duplicate fee plans
      if (dupOptions.feePlans) {
        const { data: srcPlans } = await supabase.from('course_fee_plans').select('*').eq('course_id', src.id);
        for (const p of srcPlans || []) {
          await supabase.from('course_fee_plans').insert({
            course_id: newId, plan_name: p.plan_name, total_amount: p.total_amount,
            currency: p.currency, installments: p.installments,
            installment_schedule: p.installment_schedule, tax_percent: p.tax_percent,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Course duplicated' });
      setDuplicateTarget(null);
      navigate(`/courses/${newId}`);
    } catch (err: any) {
      toast({ title: 'Duplicate failed', description: err.message, variant: 'destructive' });
    } finally {
      setDuplicating(false);
    }
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
                className="group cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01] overflow-hidden border-border/60 relative"
                onClick={() => navigate(`/courses/${course.id}`)}>
                {/* Hero strip */}
                <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary/60" />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{course.name}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {course.level || 'All Levels'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={course.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {course.status}
                        </Badge>
                        {course.website_enabled && (
                          <Badge variant="outline" className="text-xs text-accent border-accent/30">
                            <Globe className="h-3 w-3 mr-1" /> Live
                          </Badge>
                        )}
                      </div>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => { setDupName(`Copy of ${course.name}`); setDupOptions({ modules: true, classes: true, assignments: false, feePlans: false, marketing: false }); setDuplicateTarget(course); }}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(course)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

        {/* ─── Create Course Dialog ─────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Create New Course</DialogTitle>
              <DialogDescription>Set up a new course for your academy</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Course Name + AI Assist */}
              <div className="space-y-1.5">
                <Label>Course Name *</Label>
                <div className="flex gap-2">
                  <Input className="flex-1" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Spoken Arabic for Beginners" />
                </div>
              </div>

              {/* Description with AI button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-accent"
                    disabled={aiGenerating || !formName.trim()} onClick={handleAiAssist}>
                    {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    AI Assist
                  </Button>
                </div>
                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Brief course overview…" rows={3} />
              </div>

              {/* Subject + Level */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <Select value={formLevel} onValueChange={setFormLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.map(tag => (
                    <Badge key={tag} variant={formTags.includes(tag) ? 'default' : 'outline'}
                      className={cn("cursor-pointer text-xs transition-colors",
                        formTags.includes(tag) ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      )}
                      onClick={() => toggleTag(tag)}>
                      {tag}
                      {formTags.includes(tag) && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Max Students */}
              <div className="space-y-1.5">
                <Label>Max Students</Label>
                <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} />
              </div>

              {/* Start Date + End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
                </div>
              </div>

              {/* Publish to Website Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                <Switch checked={formWebsiteEnabled} onCheckedChange={setFormWebsiteEnabled} />
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-accent" /> Publish to Website
                  </Label>
                  <p className="text-xs text-muted-foreground">Make this course visible on the public website</p>
                </div>
              </div>

              {/* Website Fields (revealed when toggle is ON) */}
              {formWebsiteEnabled && (
                <div className="space-y-4 p-4 rounded-lg border border-accent/20 bg-accent/5">
                  <div className="flex items-center gap-2 text-sm font-medium text-accent">
                    <Globe className="h-4 w-4" /> Public Website Details
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Public Description</Label>
                    <Textarea value={webDescription} onChange={e => setWebDescription(e.target.value)}
                      placeholder="Extended description for the public page…" rows={3} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Key Outcomes (one per line)</Label>
                    <Textarea value={webOutcomes} onChange={e => setWebOutcomes(e.target.value)}
                      placeholder={"Learn proper Tajweed rules\nMemorize Juz 30\nUnderstand Arabic grammar basics"} rows={4} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Syllabus Text</Label>
                    <Textarea value={webSyllabus} onChange={e => setWebSyllabus(e.target.value)}
                      placeholder="Week-by-week or topic-by-topic syllabus outline…" rows={4} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">FAQs (question|answer per line)</Label>
                    <Textarea value={webFaqs} onChange={e => setWebFaqs(e.target.value)}
                      placeholder={"What level is required?|No prior experience needed\nHow long is the course?|12 weeks, 2 sessions/week"} rows={4} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Contact Email</Label>
                      <Input type="email" value={webContactEmail} onChange={e => setWebContactEmail(e.target.value)}
                        placeholder="info@academy.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">WhatsApp Number</Label>
                      <Input value={webWhatsapp} onChange={e => setWebWhatsapp(e.target.value)}
                        placeholder="+1234567890" />
                    </div>
                  </div>

                  <FileUploadField
                    label="Hero Image"
                    bucket="course-materials"
                    value={webHeroImage}
                    onChange={setWebHeroImage}
                    accept="image/jpeg,image/png,image/webp"
                    hint="Recommended: 1200×630px, JPEG or PNG"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={() => createCourse.mutate()} disabled={createCourse.isPending || !formName.trim()}>
                {createCourse.isPending ? 'Creating…' : 'Create Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Course Confirmation ────────────────── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Course Permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{deleteTarget?.name}</strong> and all its classes, enrollments, modules, lessons, assignments, and resources. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCourse} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Deleting…</> : 'Delete Forever'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── Duplicate Course Dialog ───────────────────── */}
        <Dialog open={!!duplicateTarget} onOpenChange={v => !v && setDuplicateTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicate Course</DialogTitle>
              <DialogDescription>Choose what to copy from "{duplicateTarget?.name}"</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">New Course Name</Label>
                <Input value={dupName} onChange={e => setDupName(e.target.value)} />
              </div>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What to duplicate</p>
              <div className="space-y-2">
                {[
                  { key: 'modules', label: 'Modules & Lessons' },
                  { key: 'classes', label: 'Classes (schedule only, no students)' },
                  { key: 'assignments', label: 'Assignments' },
                  { key: 'feePlans', label: 'Fee Plans' },
                  { key: 'marketing', label: 'Marketing / Website settings' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={(dupOptions as any)[opt.key]}
                      onCheckedChange={v => setDupOptions(prev => ({ ...prev, [opt.key]: !!v }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateTarget(null)}>Cancel</Button>
              <Button onClick={handleDuplicateCourse} disabled={duplicating || !dupName.trim()}>
                {duplicating ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Duplicating…</> : 'Duplicate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
