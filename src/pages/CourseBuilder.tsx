import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { CourseDiscussionBoard } from '@/components/courses/CourseDiscussionBoard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, Save, Plus, Trash2, GripVertical, FileText, Video, File,
  Sparkles, Loader2, Upload, ChevronDown, ChevronRight, Users, Settings,
  BookOpen, X, ExternalLink, ClipboardList, UserPlus, GraduationCap, DollarSign, FolderOpen,
  Bell, FileText as FileTextIcon, CheckCircle2, Circle, Globe, FileEdit, UserCheck, Layers
} from 'lucide-react';
import { RegistrationFormEditor } from '@/components/courses/RegistrationFormEditor';
import { CourseApplicants } from '@/components/courses/CourseApplicants';
import { CourseEligibilitySettings } from '@/components/courses/CourseEligibilitySettings';
import { CourseMarketingTab } from '@/components/courses/CourseMarketingTab';
import { CourseClassesTab } from '@/components/courses/CourseClassesTab';
import { CourseFinanceTab } from '@/components/courses/CourseFinanceTab';
import { CourseResourcesTab } from '@/components/courses/CourseResourcesTab';
import { CourseNotificationsTab } from '@/components/courses/CourseNotificationsTab';
import { CourseAssignmentsTab } from '@/components/courses/CourseAssignmentsTab';
import { CourseAttendanceTab } from '@/components/courses/CourseAttendanceTab';
import { CourseExamsTab } from '@/components/courses/CourseExamsTab';
import { CourseCertificatesTab } from '@/components/courses/CourseCertificatesTab';
import { CourseRoster } from '@/components/courses/CourseRoster';

// ─── Types ──────────────────────────────────────────────
interface Module {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Lesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  content_type: string;
  content_html: string | null;
  video_url: string | null;
  file_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const CONTENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document: <File className="h-4 w-4" />,
};

const CONTENT_TYPE_EMOJI: Record<string, string> = {
  text: '📄',
  video: '🎬',
  document: '📎',
};

// ─── Main Component ─────────────────────────────────────
export default function CourseBuilder() {
  const { id: courseId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [searchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'builder';
  const setActiveTab = (tab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    navigate(`${location.pathname}?tab=${tab}`, { replace: true });
  };

  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Website tab state
  const [webDescription, setWebDescription] = useState('');
  const [webOutcomes, setWebOutcomes] = useState('');
  const [webFaqs, setWebFaqs] = useState<{question: string; answer: string}[]>([]);
  const [webSyllabus, setWebSyllabus] = useState('');
  const [webPricingAmount, setWebPricingAmount] = useState('');
  const [webPricingCurrency, setWebPricingCurrency] = useState('USD');
  const [webContactEmail, setWebContactEmail] = useState('');
  const [webContactWhatsapp, setWebContactWhatsapp] = useState('');
  const [webEnabled, setWebEnabled] = useState(false);
  const [webLevel, setWebLevel] = useState('All Levels');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [webInstructorName, setWebInstructorName] = useState('');
  const [webInstructorBio, setWebInstructorBio] = useState('');
  const [testimonials, setTestimonials] = useState<{name: string; quote: string}[]>([]);
  
  // Ad creative state
  const [adTitle, setAdTitle] = useState('');
  const [adBody, setAdBody] = useState('');
  const [adHashtags, setAdHashtags] = useState('');
  const [supportWelcome, setSupportWelcome] = useState('');
  const [supportReminder, setSupportReminder] = useState('');
  const [supportLastSeat, setSupportLastSeat] = useState('');
  const [supportClosing, setSupportClosing] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [syllabusOpen, setSyllabusOpen] = useState(true);

  // AI state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // Add module/lesson
  const [addModuleTitle, setAddModuleTitle] = useState('');
  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [addLessonTitle, setAddLessonTitle] = useState('');
  const [addLessonType, setAddLessonType] = useState('text');

  // Editor state for selected lesson
  const [editorHtml, setEditorHtml] = useState('');
  const [editorVideoUrl, setEditorVideoUrl] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);

  // Settings state
  const [settingsName, setSettingsName] = useState('');
  const [settingsMaxStudents, setSettingsMaxStudents] = useState('30');
  const [settingsStartDate, setSettingsStartDate] = useState('');
  const [settingsEndDate, setSettingsEndDate] = useState('');
  const [autoEnrollEnabled, setAutoEnrollEnabled] = useState(false);

  // Roster CSV
  const [csvData, setCsvData] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  // ─── Queries ──────────────────────────────────────────
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course-detail', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .eq('id', courseId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery({
    queryKey: ['course-modules', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId!)
        .order('sort_order');
      if (error) throw error;
      return data as Module[];
    },
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['course-lessons', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_lessons')
        .select('*')
        .eq('course_id', courseId!)
        .order('sort_order');
      if (error) throw error;
      return data as Lesson[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['course-enrollments-builder', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*, student:profiles!course_enrollments_student_id_fkey(full_name, email)')
        .eq('course_id', courseId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Progress checklist queries
  const { data: formFieldsCount = 0 } = useQuery({
    queryKey: ['course-form-fields-count', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { count } = await supabase.from('registration_form_fields')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', courseId!);
      return count || 0;
    },
  });

  const { data: classCount = 0 } = useQuery({
    queryKey: ['course-class-count', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { count } = await supabase.from('course_classes')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId!);
      return count || 0;
    },
  });

  const { data: enrolledCount = 0 } = useQuery({
    queryKey: ['course-enrolled-count', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { count } = await supabase.from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId!)
        .eq('status', 'active');
      return count || 0;
    },
  });

  const { data: assignedCount = 0 } = useQuery({
    queryKey: ['course-assigned-count', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { count } = await supabase.from('course_class_students')
        .select('id, class:course_classes!inner(course_id)', { count: 'exact', head: true })
        .eq('class.course_id', courseId!);
      return count || 0;
    },
  });

  // Teaching OS syllabus sync (B1)
  const { data: teachingSyllabus } = useQuery({
    queryKey: ['teaching-syllabus', courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase.from('syllabi')
        .select('id, course_name, rows, duration_weeks, sessions_week, language, level, subject, status, created_at, updated_at')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const syllabusRows: Array<{week: number; topic: string; objectives: string; contentTypes: string[]}> =
    teachingSyllabus?.rows
      ? (typeof teachingSyllabus.rows === 'string' ? JSON.parse(teachingSyllabus.rows as string) : teachingSyllabus.rows) as any[]
      : [];

  const { data: sessionPlanCount = 0 } = useQuery({
    queryKey: ['session-plan-count', teachingSyllabus?.id],
    queryFn: async () => {
      const { count } = await supabase.from('session_plans')
        .select('id', { count: 'exact', head: true })
        .eq('syllabus_id', teachingSyllabus!.id);
      return count || 0;
    },
    enabled: !!teachingSyllabus?.id,
  });

  const { data: contentKitCount = 0 } = useQuery({
    queryKey: ['content-kit-count', teachingSyllabus?.id],
    queryFn: async () => {
      const { count } = await supabase.from('content_kits')
        .select('id', { count: 'exact', head: true })
        .eq('session_plan_id', teachingSyllabus!.id);
      return count || 0;
    },
    enabled: !!teachingSyllabus?.id,
  });

  // Teachers list for settings
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', (await supabase.from('user_roles').select('user_id').eq('role', 'teacher')).data?.map(r => r.user_id) || []);
      return data || [];
    },
  });

  // Initialize settings when course loads
  React.useEffect(() => {
    if (course) {
      setSettingsName(course.name);
      setSettingsMaxStudents(String(course.max_students));
      setSettingsStartDate(course.start_date);
      setSettingsEndDate(course.end_date || '');
      setAutoEnrollEnabled((course as any).auto_enroll_enabled || false);
      // Website fields
      setWebDescription(course.description || '');
      setWebLevel(course.level || 'All Levels');
      setWebEnabled(course.website_enabled || false);
      setWebSyllabus(course.syllabus_text || '');
      const outcomes = Array.isArray(course.outcomes) ? (course.outcomes as any[]).map((o: any) => o.text || '').join('\n') : '';
      setWebOutcomes(outcomes);
      const faqs = Array.isArray(course.faqs) ? (course.faqs as any[]).map((f: any) => ({ question: f.question || '', answer: f.answer || '' })) : [];
      setWebFaqs(faqs);
      const pricing = (course.pricing || {}) as any;
      setWebPricingAmount(String(pricing.amount || ''));
      setWebPricingCurrency(pricing.currency || 'USD');
      const contact = (course.contact_info || {}) as any;
      setWebContactEmail(contact.email || '');
      setWebContactWhatsapp(contact.whatsapp || '');
      setWebInstructorName(contact.instructor_name || '');
      setWebInstructorBio(contact.instructor_bio || '');
      setTestimonials(Array.isArray(contact.testimonials) ? contact.testimonials : []);
      setHeroImageUrl((course.hero_image_url as string) || '');
      // Ad creative
      const ad = (course.ad_creative || {}) as any;
      setAdTitle(ad.title || '');
      setAdBody(ad.body || '');
      setAdHashtags(ad.hashtags || '');
      const support = (course.support_messages || {}) as any;
      setSupportWelcome(support.welcome || '');
      setSupportReminder(support.reminder || '');
      setSupportLastSeat(support.lastSeat || '');
      setSupportClosing(support.closing || '');
    }
  }, [course]);

  // Auto-expand all modules initially
  React.useEffect(() => {
    if (modules.length > 0 && expandedModules.size === 0) {
      setExpandedModules(new Set(modules.map(m => m.id)));
    }
  }, [modules]);

  // When a lesson is selected, load its content
  React.useEffect(() => {
    if (selectedLesson) {
      setEditorHtml(selectedLesson.content_html || '');
      setEditorVideoUrl(selectedLesson.video_url || '');
      setEditorDirty(false);
    }
  }, [selectedLesson?.id]);

  const lessonsByModule = useMemo(() => {
    const map: Record<string, Lesson[]> = {};
    modules.forEach(m => { map[m.id] = []; });
    lessons.forEach(l => {
      if (map[l.module_id]) map[l.module_id].push(l);
    });
    return map;
  }, [modules, lessons]);

  // ─── Mutations ────────────────────────────────────────
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['course-modules', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course-lessons', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course-detail', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course-enrollments-builder', courseId] });
  };

  const addModule = useMutation({
    mutationFn: async (title: string) => {
      const maxOrder = modules.length > 0 ? Math.max(...modules.map(m => m.sort_order)) + 1 : 0;
      const { error } = await supabase.from('course_modules').insert({
        course_id: courseId!,
        title,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setAddModuleTitle('');
      toast({ title: 'Module added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteModule = useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await supabase.from('course_modules').delete().eq('id', moduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      if (selectedLesson && !modules.find(m => m.id === selectedLesson.module_id)) {
        setSelectedLesson(null);
      }
      toast({ title: 'Module deleted' });
    },
  });

  const addLesson = useMutation({
    mutationFn: async ({ moduleId, title, contentType }: { moduleId: string; title: string; contentType: string }) => {
      const moduleLessons = lessonsByModule[moduleId] || [];
      const maxOrder = moduleLessons.length > 0 ? Math.max(...moduleLessons.map(l => l.sort_order)) + 1 : 0;
      const { data, error } = await supabase.from('course_lessons').insert({
        module_id: moduleId,
        course_id: courseId!,
        title,
        content_type: contentType,
        sort_order: maxOrder,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateAll();
      setAddLessonModuleId(null);
      setAddLessonTitle('');
      setAddLessonType('text');
      if (data) setSelectedLesson(data as Lesson);
      toast({ title: 'Lesson added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteLesson = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from('course_lessons').delete().eq('id', lessonId);
      if (error) throw error;
    },
    onSuccess: (_, lessonId) => {
      invalidateAll();
      if (selectedLesson?.id === lessonId) setSelectedLesson(null);
      toast({ title: 'Lesson deleted' });
    },
  });

  const saveLesson = useCallback(async () => {
    if (!selectedLesson) return;
    setSaving(true);
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (selectedLesson.content_type === 'text') updates.content_html = editorHtml;
      if (selectedLesson.content_type === 'video') updates.video_url = editorVideoUrl;

      const { error } = await supabase.from('course_lessons').update(updates).eq('id', selectedLesson.id);
      if (error) throw error;

      setEditorDirty(false);
      invalidateAll();
      toast({ title: 'Lesson saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedLesson, editorHtml, editorVideoUrl]);

  const togglePublish = useMutation({
    mutationFn: async () => {
      const newStatus = course?.status === 'active' ? 'draft' : 'active';
      const { error } = await supabase.from('courses').update({ status: newStatus }).eq('id', courseId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: course?.status === 'active' ? 'Course unpublished' : 'Course published' });
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('courses').update({
        name: settingsName,
        max_students: parseInt(settingsMaxStudents) || 30,
        start_date: settingsStartDate,
        end_date: settingsEndDate || null,
        auto_enroll_enabled: autoEnrollEnabled,
      }).eq('id', courseId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Settings saved' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveWebsite = useMutation({
    mutationFn: async () => {
      const outcomesArr = webOutcomes.split('\n').filter(Boolean).map(t => ({ text: t.trim() }));
      const faqsArr = webFaqs.filter(f => f.question.trim());
      const { error } = await supabase.from('courses').update({
        description: webDescription || null,
        level: webLevel,
        website_enabled: webEnabled,
        syllabus_text: webSyllabus || null,
        outcomes: outcomesArr as any,
        faqs: faqsArr as any,
        pricing: { amount: parseFloat(webPricingAmount) || 0, currency: webPricingCurrency, period: 'month' } as any,
        hero_image_url: heroImageUrl || null,
        contact_info: {
          email: webContactEmail,
          whatsapp: webContactWhatsapp,
          instructor_name: webInstructorName,
          instructor_bio: webInstructorBio,
          testimonials: testimonials.filter(t => t.name.trim() || t.quote.trim()),
        } as any,
        seo_slug: course?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || null,
      }).eq('id', courseId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Website settings saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveAdCreative = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('courses').update({
        ad_creative: { title: adTitle, body: adBody, hashtags: adHashtags } as any,
        support_messages: { welcome: supportWelcome, reminder: supportReminder, lastSeat: supportLastSeat, closing: supportClosing } as any,
      }).eq('id', courseId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Marketing content saved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const generateWithAI = async () => {
    if (!aiPrompt.trim() || !selectedLesson) return;
    setAiGenerating(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await supabase.functions.invoke('generate-course-content', {
        body: { prompt: aiPrompt, lessonTitle: selectedLesson.title },
      });

      if (resp.error) throw new Error(resp.error.message || 'AI generation failed');
      const html = resp.data?.content || '';
      setEditorHtml(prev => prev ? prev + '\n' + html : html);
      setEditorDirty(true);
      setAiOpen(false);
      setAiPrompt('');
      toast({ title: 'Content generated!', description: 'Review and edit the generated content below.' });
    } catch (e: any) {
      toast({ title: 'AI Error', description: e.message, variant: 'destructive' });
    } finally {
      setAiGenerating(false);
    }
  };

  // ─── File Upload ──────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedLesson) return;
    const file = e.target.files[0];
    const path = `${courseId}/${selectedLesson.id}/${file.name}`;

    const { error: uploadError } = await supabase.storage.from('course-materials').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(path);
    const { error } = await supabase.from('course_lessons').update({
      file_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedLesson.id);

    if (error) {
      toast({ title: 'Error saving file URL', variant: 'destructive' });
    } else {
      invalidateAll();
      setSelectedLesson({ ...selectedLesson, file_url: urlData.publicUrl });
      toast({ title: 'File uploaded successfully' });
    }
  };

  // ─── CSV Bulk Import ──────────────────────────────────
  const importCSV = async () => {
    if (!csvData.trim()) return;
    setCsvImporting(true);
    try {
      const lines = csvData.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row + data rows');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const fnIdx = headers.findIndex(h => h.includes('first') && h.includes('name'));
      const lnIdx = headers.findIndex(h => h.includes('last') && h.includes('name'));
      const emIdx = headers.findIndex(h => h.includes('email'));

      if (emIdx === -1) throw new Error('Email column not found in CSV');

      let enrolled = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const email = cols[emIdx];
        const firstName = fnIdx >= 0 ? cols[fnIdx] : '';
        const lastName = lnIdx >= 0 ? cols[lnIdx] : '';
        const fullName = `${firstName} ${lastName}`.trim() || email;

        if (!email) continue;

        // Find existing profile by email
        const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
        let studentId = existing?.id;

        if (!studentId) {
          // Create profile via admin function
          const { data: created } = await supabase.functions.invoke('admin-create-user', {
            body: { email, full_name: fullName, role: 'student', password: email.split('@')[0] + '2024!' },
          });
          studentId = created?.user?.id;
        }

        if (studentId) {
          await supabase.from('course_enrollments').upsert({
            course_id: courseId!,
            student_id: studentId,
            status: 'active',
          }, { onConflict: 'course_id,student_id' }).select();
          enrolled++;
        }
      }

      invalidateAll();
      setCsvData('');
      toast({ title: `${enrolled} student(s) enrolled from CSV` });
    } catch (e: any) {
      toast({ title: 'Import Error', description: e.message, variant: 'destructive' });
    } finally {
      setCsvImporting(false);
    }
  };

  // ─── Render Helpers ───────────────────────────────────
  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (courseLoading || modulesLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6 space-y-4">
        <Skeleton className="h-12 w-96" />
        <div className="flex gap-4">
          <Skeleton className="h-[70vh] w-[35%]" />
          <Skeleton className="h-[70vh] w-[65%]" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <p className="text-lg text-muted-foreground">Course not found</p>
          <Button variant="outline" onClick={() => navigate('/courses')}>← Back to Courses</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          {/* ═══ BUILDER TAB ═══ */}
          <TabsContent value="builder" className="mt-4 flex-1">
            {/* Course setup progress — Interactive pills */}
            {(() => {
              const COLOR_CLASSES: Record<string, { done: string; icon: string }> = {
                blue: {
                  done: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                  icon: 'text-blue-500',
                },
                amber: {
                  done: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                  icon: 'text-amber-500',
                },
                emerald: {
                  done: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                  icon: 'text-emerald-500',
                },
              };

              const progressItems = [
                { label: 'Settings', done: !!course?.name, tab: 'settings', icon: Settings, color: 'blue' as const },
                { label: 'Website', done: !!(course as any)?.website_enabled, tab: 'website', icon: Globe, color: 'blue' as const },
                { label: 'Reg Form', done: formFieldsCount > 0, tab: 'reg-form', icon: FileEdit, color: 'amber' as const },
                { label: 'Classes', done: classCount > 0, tab: 'classes', icon: Layers, color: 'emerald' as const },
                { label: 'Enrolled', done: enrolledCount > 0, tab: 'applicants', icon: Users, color: 'emerald' as const },
                { label: 'Roster', done: assignedCount > 0, tab: 'roster', icon: UserCheck, color: 'emerald' as const },
              ];

              return (
                <div className="mb-6">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">Course setup progress</h3>
                  <div className="flex flex-wrap gap-2">
                    {progressItems.map(item => {
                      const Icon = item.icon;
                      const colors = COLOR_CLASSES[item.color];
                      return (
                        <button
                          key={item.label}
                          onClick={() => setActiveTab(item.tab)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all cursor-pointer border",
                            item.done
                              ? colors.done
                              : "bg-muted/30 text-muted-foreground border-dashed border-muted-foreground/30 hover:bg-muted/50 hover:border-muted-foreground/50"
                          )}
                        >
                          {item.done ? (
                            <CheckCircle2 className={cn("h-3.5 w-3.5", colors.icon)} />
                          ) : (
                            <Icon className="h-3.5 w-3.5" />
                          )}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {teachingSyllabus && syllabusRows.length > 0 ? (
              /* ─── SYNCED SYLLABUS VIEW ─── */
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <h3 className="font-medium">Teaching OS Syllabus</h3>
                        <Badge variant="secondary">{teachingSyllabus.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {teachingSyllabus.duration_weeks} weeks · {teachingSyllabus.sessions_week} sessions/week · {teachingSyllabus.language}
                        {teachingSyllabus.subject && ` · ${teachingSyllabus.subject}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{sessionPlanCount} sessions planned</p>
                        <p>{contentKitCount} content kits</p>
                      </div>
                      <Button variant="outline" size="sm"
                        onClick={() => navigate(`/teaching-os?syllabus_id=${teachingSyllabus.id}`)}>
                        Edit in Teaching OS
                      </Button>
                      <Button variant="default" size="sm"
                        onClick={() => navigate(`/teaching-os/planner?syllabus_id=${teachingSyllabus.id}&course_id=${courseId}`)}>
                        Open Planner →
                      </Button>
                    </div>
                  </div>
                </Card>

                <div className="space-y-2">
                  {syllabusRows.map((row, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                            W{row.week}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{row.topic}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{row.objectives}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {row.contentTypes?.map(ct => (
                            <Badge key={ct} variant="outline" className="text-[10px] px-1.5 py-0">
                              {ct}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              /* ─── MANUAL MODULE BUILDER ─── */
              <div>
                <Card className="p-4 mb-4 border-dashed">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-sm">Generate syllabus with AI</p>
                        <p className="text-xs text-muted-foreground">Use Teaching OS to auto-generate a structured syllabus from your course details</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm"
                      onClick={() => navigate(`/teaching-os?course_id=${courseId}`)}>
                      Open Teaching OS
                    </Button>
                  </div>
                </Card>

            {/* Mobile syllabus toggle */}
            <Button
              variant="outline"
              size="sm"
              className="mb-3 gap-1.5 md:hidden w-full"
              onClick={() => setSyllabusOpen(prev => !prev)}
            >
              <BookOpen className="h-4 w-4" />
              {syllabusOpen ? 'Hide Syllabus' : 'Show Syllabus'}
              {syllabusOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>

            <div className="flex flex-col md:flex-row gap-4 min-h-[calc(100vh-220px)]">
              {/* ─── Left Pane: Syllabus Outline ─── */}
              <div className={cn(
                'w-full md:w-1/3 shrink-0 bg-background rounded-xl shadow-sm border border-border overflow-hidden flex flex-col',
                !syllabusOpen && 'hidden md:flex'
              )}>
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="text-sm font-semibold text-foreground">Syllabus Outline</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{modules.length} modules · {lessons.length} lessons</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {modules.map(mod => (
                    <div key={mod.id} className="rounded-lg">
                      {/* Module header */}
                      <div className="flex items-center gap-1 group">
                        <button
                          onClick={() => toggleModule(mod.id)}
                          className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        >
                          {expandedModules.has(mod.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="text-sm font-semibold text-foreground truncate">{mod.title}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">{(lessonsByModule[mod.id] || []).length}</Badge>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => deleteModule.mutate(mod.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>

                      {/* Lessons */}
                      {expandedModules.has(mod.id) && (
                        <div className="ml-4 space-y-0.5 pb-1">
                          {(lessonsByModule[mod.id] || []).map(lesson => (
                            <div key={lesson.id} className="flex items-center group/lesson">
                              <button
                                onClick={() => setSelectedLesson(lesson)}
                                className={cn(
                                  'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                                  selectedLesson?.id === lesson.id
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted/50 text-foreground'
                                )}
                              >
                                <span className="text-base leading-none">{CONTENT_TYPE_EMOJI[lesson.content_type] || '📄'}</span>
                                <span className="truncate">{lesson.title}</span>
                              </button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover/lesson:opacity-100 transition-opacity shrink-0"
                                onClick={() => deleteLesson.mutate(lesson.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}

                          {/* Add lesson button */}
                          {addLessonModuleId === mod.id ? (
                            <div className="flex flex-col gap-2 p-2 bg-muted/30 rounded-lg">
                              <Input
                                placeholder="Lesson title"
                                value={addLessonTitle}
                                onChange={e => setAddLessonTitle(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                {(['text', 'video', 'document'] as const).map(t => (
                                  <Button
                                    key={t}
                                    size="sm"
                                    variant={addLessonType === t ? 'default' : 'outline'}
                                    className="h-7 text-xs gap-1 flex-1"
                                    onClick={() => setAddLessonType(t)}
                                  >
                                    {CONTENT_TYPE_ICONS[t]} {t}
                                  </Button>
                                ))}
                              </div>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 text-xs"
                                  disabled={!addLessonTitle.trim()}
                                  onClick={() => addLesson.mutate({ moduleId: mod.id, title: addLessonTitle, contentType: addLessonType })}
                                >
                                  Add
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddLessonModuleId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAddLessonModuleId(mod.id)}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-colors"
                            >
                              <Plus className="h-3 w-3" /> Add Lesson
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add module */}
                  <div className="pt-2">
                    {addModuleTitle !== null ? (
                      <div className="flex gap-2 p-2">
                        <Input
                          placeholder="Module title..."
                          value={addModuleTitle}
                          onChange={e => setAddModuleTitle(e.target.value)}
                          className="h-8 text-sm"
                          onKeyDown={e => e.key === 'Enter' && addModuleTitle.trim() && addModule.mutate(addModuleTitle)}
                        />
                        <Button
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={!addModuleTitle.trim()}
                          onClick={() => addModule.mutate(addModuleTitle)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    <button
                      onClick={() => setAddModuleTitle('')}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Add Module
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Right Pane: Content Editor (65%) ─── */}
              <div className="w-full md:flex-1 bg-background rounded-xl shadow-sm border border-border overflow-hidden flex flex-col">
                {selectedLesson ? (
                  <>
                    {/* Editor header */}
                    <div className="px-3 sm:px-5 py-3 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{CONTENT_TYPE_EMOJI[selectedLesson.content_type] || '📄'}</span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate">{selectedLesson.title}</h3>
                          <p className="text-xs text-muted-foreground capitalize">{selectedLesson.content_type} lesson</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLesson.content_type === 'text' && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAiOpen(true)}>
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Generate with AI
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={saveLesson}
                          disabled={!editorDirty || saving}
                          className="gap-1.5"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save
                        </Button>
                      </div>
                    </div>

                    {/* Editor body */}
                    <div className="flex-1 overflow-y-auto p-5">
                      {selectedLesson.content_type === 'text' && (
                        <div className="space-y-3">
                          <div
                            className="min-h-[400px] border border-border rounded-lg p-4 prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-ring"
                            contentEditable
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{ __html: editorHtml }}
                            onInput={(e) => {
                              setEditorHtml((e.target as HTMLDivElement).innerHTML);
                              setEditorDirty(true);
                            }}
                          />
                          <p className="text-xs text-muted-foreground">Rich text editor — type directly or use AI to generate content</p>
                        </div>
                      )}

                      {selectedLesson.content_type === 'video' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Video URL (YouTube, Vimeo, or direct link)</Label>
                            <div className="flex gap-2">
                              <Input
                                value={editorVideoUrl}
                                onChange={e => { setEditorVideoUrl(e.target.value); setEditorDirty(true); }}
                                placeholder="https://youtube.com/watch?v=..."
                                className="flex-1"
                              />
                              {editorVideoUrl && (
                                <Button size="icon" variant="outline" asChild>
                                  <a href={editorVideoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                          {editorVideoUrl && (
                            <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
                              <iframe
                                src={editorVideoUrl.includes('youtube.com/watch')
                                  ? editorVideoUrl.replace('watch?v=', 'embed/')
                                  : editorVideoUrl.includes('youtu.be/')
                                    ? `https://www.youtube.com/embed/${editorVideoUrl.split('youtu.be/')[1]}`
                                    : editorVideoUrl.includes('vimeo.com/')
                                      ? `https://player.vimeo.com/video/${editorVideoUrl.split('vimeo.com/')[1]}`
                                      : editorVideoUrl
                                }
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {selectedLesson.content_type === 'document' && (
                        <div className="space-y-4">
                          {selectedLesson.file_url ? (
                            <div className="rounded-xl border-2 border-dashed border-border p-6 text-center space-y-3">
                              <File className="h-10 w-10 text-primary mx-auto" />
                              <p className="text-sm font-medium">File uploaded</p>
                              <div className="flex gap-2 justify-center">
                                <Button size="sm" variant="outline" asChild>
                                  <a href={selectedLesson.file_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-1" /> View File
                                  </a>
                                </Button>
                                <label>
                                  <Button size="sm" variant="outline" asChild>
                                    <span><Upload className="h-4 w-4 mr-1" /> Replace</span>
                                  </Button>
                                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <label className="block">
                              <div className="rounded-xl border-2 border-dashed border-border p-10 text-center space-y-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                                <p className="text-sm font-medium">Drop a file here or click to upload</p>
                                <p className="text-xs text-muted-foreground">PDF, DOC, PPT, XLS supported</p>
                              </div>
                              <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-10">
                    <div className="space-y-3">
                      <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                      <h3 className="text-lg font-medium text-muted-foreground">Select a lesson to edit</h3>
                      <p className="text-sm text-muted-foreground/60 max-w-sm">
                        Choose a lesson from the syllabus outline on the left, or create a new module to get started.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ SETTINGS TAB ═══ */}
          <TabsContent value="settings" className="mt-4">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Course Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Course Name</Label>
                  <Input value={settingsName} onChange={e => setSettingsName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={settingsStartDate} onChange={e => setSettingsStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={settingsEndDate} onChange={e => setSettingsEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max Students</Label>
                  <Input type="number" value={settingsMaxStudents} onChange={e => setSettingsMaxStudents(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Teacher</Label>
                  <Input value={(course as any).teacher?.full_name || '—'} disabled />
                  <p className="text-xs text-muted-foreground">Teacher can only be changed from the Courses list</p>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={(course as any).subject?.name || '—'} disabled />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Auto-Enrollment</Label>
                    <p className="text-xs text-muted-foreground">Automatically enroll eligible applicants when they apply</p>
                  </div>
                  <Switch checked={autoEnrollEnabled} onCheckedChange={setAutoEnrollEnabled} />
                </div>

                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            {/* Eligibility Rules */}
            <div className="mt-6">
              <CourseEligibilitySettings courseId={courseId!} />
            </div>
          </TabsContent>

          {/* ═══ WEBSITE TAB ═══ */}
          <TabsContent value="website" className="mt-4 space-y-4">
            <Card><CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Public Course Page</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="web-toggle" className="text-sm">Publish to Website</Label>
                  <Switch id="web-toggle" checked={webEnabled} onCheckedChange={setWebEnabled} />
                </div>
              </div>
              {webEnabled && course?.seo_slug && (
                <p className="text-xs text-muted-foreground">Preview: <a href={`/course/${course.seo_slug}`} target="_blank" className="text-accent underline">/course/{course.seo_slug}</a></p>
              )}
              <div className="space-y-2"><Label>Description</Label><Textarea value={webDescription} onChange={e => setWebDescription(e.target.value)} rows={3} placeholder="Course overview for the website…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Level</Label>
                  <Select value={webLevel} onValueChange={setWebLevel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    {['Beginner','Intermediate','Advanced','All Levels'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Pricing ({webPricingCurrency})</Label><Input type="number" value={webPricingAmount} onChange={e => setWebPricingAmount(e.target.value)} placeholder="0" /></div>
              </div>
              <div className="space-y-2"><Label>Key Outcomes (one per line)</Label><Textarea value={webOutcomes} onChange={e => setWebOutcomes(e.target.value)} rows={4} placeholder="Learn conversational Arabic&#10;Master essential grammar" /></div>
              <div className="space-y-2"><Label>Syllabus Text</Label><Textarea value={webSyllabus} onChange={e => setWebSyllabus(e.target.value)} rows={4} placeholder="Week 1: Introduction&#10;Week 2: Basics" /></div>
              {/* FAQ Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">FAQs</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setWebFaqs([...webFaqs, { question: '', answer: '' }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add FAQ
                  </Button>
                </div>
                {webFaqs.length === 0 && (
                  <p className="text-xs text-muted-foreground">No FAQs added yet. Click "Add FAQ" to get started.</p>
                )}
                {webFaqs.map((faq, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Question"
                            value={faq.question}
                            onChange={e => {
                              const updated = [...webFaqs];
                              updated[i] = { ...updated[i], question: e.target.value };
                              setWebFaqs(updated);
                            }}
                          />
                          <Textarea
                            placeholder="Answer"
                            value={faq.answer}
                            rows={2}
                            onChange={e => {
                              const updated = [...webFaqs];
                              updated[i] = { ...updated[i], answer: e.target.value };
                              setWebFaqs(updated);
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setWebFaqs(webFaqs.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Hero Image */}
              <Separator />
              <div className="space-y-2">
                <Label>Hero Image</Label>
                <p className="text-xs text-muted-foreground">Banner image for the public course page (recommended 1200×400)</p>
                {heroImageUrl ? (
                  <div className="relative">
                    <img src={heroImageUrl} alt="Hero" className="rounded-lg w-full h-40 object-cover" />
                    <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setHeroImageUrl('')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload or drag image</p>
                    <Input type="file" accept="image/*" className="mt-2" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const path = `course-heroes/${courseId}/${file.name}`;
                      const { error } = await supabase.storage.from('course-assets').upload(path, file, { upsert: true });
                      if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); return; }
                      const { data: { publicUrl } } = supabase.storage.from('course-assets').getPublicUrl(path);
                      setHeroImageUrl(publicUrl);
                    }} />
                  </div>
                )}
              </div>

              {/* Instructor */}
              <Separator />
              <h4 className="font-semibold text-sm">Instructor</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Instructor Name</Label><Input value={webInstructorName} onChange={e => setWebInstructorName(e.target.value)} placeholder="e.g., Ustadha Fatima Ali" /></div>
                <div className="space-y-2"><Label>Contact Email</Label><Input value={webContactEmail} onChange={e => setWebContactEmail(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Instructor Bio</Label><Textarea value={webInstructorBio} onChange={e => setWebInstructorBio(e.target.value)} rows={3} placeholder="Brief introduction of the instructor..." /></div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={webContactWhatsapp} onChange={e => setWebContactWhatsapp(e.target.value)} placeholder="+92..." /></div>

              {/* Testimonials */}
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Student Testimonials</Label>
                    <p className="text-xs text-muted-foreground">Add quotes from past students (shown on public page)</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTestimonials([...testimonials, { name: '', quote: '' }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add Testimonial
                  </Button>
                </div>
                {testimonials.map((t, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-3 flex gap-3">
                      <div className="flex-1 space-y-2">
                        <Input value={t.name} placeholder="Student name" onChange={e => {
                          const updated = [...testimonials]; updated[i] = { ...updated[i], name: e.target.value }; setTestimonials(updated);
                        }} />
                        <Textarea value={t.quote} placeholder="Their testimonial..." rows={2} onChange={e => {
                          const updated = [...testimonials]; updated[i] = { ...updated[i], quote: e.target.value }; setTestimonials(updated);
                        }} />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTestimonials(testimonials.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={() => saveWebsite.mutate()} disabled={saveWebsite.isPending}>
                {saveWebsite.isPending ? 'Saving…' : 'Save Website Settings'}
              </Button>
            </CardContent></Card>
          </TabsContent>

          {/* ═══ MARKETING TAB ═══ */}
          <TabsContent value="marketing" className="mt-4">
            <CourseMarketingTab
              courseId={courseId!}
              courseName={course.name}
              courseDescription={course.description || ''}
            />
          </TabsContent>

          {/* ═══ COMMUNITY TAB ═══ */}
          <TabsContent value="community" className="mt-4">
            <CourseDiscussionBoard courseId={courseId!} currentUserId={user!.id} isAdmin={true} />
          </TabsContent>

          {/* ═══ ROSTER TAB ═══ */}
          <TabsContent value="roster" className="mt-4">
            <CourseRoster courseId={courseId!} />
          </TabsContent>

          {/* ═══ REGISTRATION FORM TAB ═══ */}
          <TabsContent value="reg-form" className="mt-4">
            <RegistrationFormEditor
              courseId={courseId!}
              courseSlug={course.seo_slug || course.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              courseName={course.name}
            />
          </TabsContent>

          {/* ═══ APPLICANTS TAB ═══ */}
          <TabsContent value="applicants" className="mt-4">
            <CourseApplicants courseId={courseId!} />
          </TabsContent>

          {/* ═══ CLASSES TAB ═══ */}
          <TabsContent value="classes" className="mt-4">
            <CourseClassesTab courseId={courseId!} />
          </TabsContent>

          {/* ═══ FINANCE TAB ═══ */}
          <TabsContent value="finance" className="mt-4">
            <CourseFinanceTab courseId={courseId!} />
          </TabsContent>

          {/* ═══ RESOURCES TAB ═══ */}
          <TabsContent value="resources" className="mt-4">
            <CourseResourcesTab courseId={courseId!} courseName={course?.name} />
          </TabsContent>

          {/* ═══ ASSIGNMENTS TAB ═══ */}
          <TabsContent value="assignments" className="mt-4">
            <CourseAssignmentsTab courseId={courseId!} />
          </TabsContent>

          {/* ═══ NOTIFICATIONS TAB ═══ */}
          <TabsContent value="notifications" className="mt-4">
            <CourseNotificationsTab
              courseId={courseId!}
              courseName={course?.name}
              whatsappChannelLink={(course as any)?.whatsapp_channel_link}
            />
          </TabsContent>

          {/* ═══ ATTENDANCE TAB ═══ */}
          <TabsContent value="attendance" className="mt-4">
            <CourseAttendanceTab courseId={courseId!} />
          </TabsContent>

          {/* ═══ EXAMS & QUIZZES TAB ═══ */}
          <TabsContent value="exams" className="mt-4">
            <CourseExamsTab courseId={courseId!} />
          </TabsContent>

          {/* ═══ CERTIFICATES TAB ═══ */}
          <TabsContent value="certificates" className="mt-4">
            <CourseCertificatesTab courseId={courseId!} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── AI Generation Dialog ─────────────────────── */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Generate with AI
            </DialogTitle>
            <DialogDescription>
              Describe what this lesson should cover. AI will generate structured content for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-muted/50 rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground">Lesson</p>
              <p className="text-sm font-medium">{selectedLesson?.title}</p>
            </div>
            <Textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. Cover the basics of Arabic grammar including noun types, verb conjugation patterns, and sentence structure with examples..."
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Cancel</Button>
            <Button onClick={generateWithAI} disabled={!aiPrompt.trim() || aiGenerating} className="gap-1.5">
              {aiGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
