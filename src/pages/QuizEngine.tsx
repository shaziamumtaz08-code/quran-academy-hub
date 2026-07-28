import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus, Loader2, Copy, Share2, Trash2, Eye, FileText, Pencil,
  ClipboardCheck, Trophy, Link as LinkIcon, Globe, Lock, Play, Square, Upload, X, Download,
  ChevronDown, ChevronRight, ChevronUp, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, Search, FileBarChart,
} from 'lucide-react';
import AttemptDetailDialog from '@/components/quiz/AttemptDetailDialog';
import QuizResultsExportDialog from '@/components/quiz/QuizResultsExportDialog';
import QuizFullReportDialog from '@/components/quiz/QuizFullReportDialog';
import { extractSourceFiles, QUIZ_SOURCE_ACCEPT } from '@/lib/quizSourceExtract';
import QuizCollaboratorsDialog from '@/components/quiz/QuizCollaboratorsDialog';
import { useDraftPersistence, loadDraft, clearDraft } from '@/hooks/useDraftPersistence';



import { format, formatDistanceStrict, differenceInMilliseconds } from 'date-fns';

function formatDuration(start: string, end?: string | null): string {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const ms = Math.max(0, differenceInMilliseconds(e, s));
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const hRem = hrs % 24;
  return hRem ? `${days}d ${hRem}h` : `${days}d`;
}

export default function QuizEngine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('banks');
  const [createOpen, setCreateOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '', name: '', description: '', language: 'en', mode: 'public' as string,
    course_id: '', difficulty_level: 'mixed' as string,
    questions_per_attempt: 10, time_limit_minutes: 0,
    max_attempts: 1, passing_percentage: 50,
    mcq: 5, tf: 3, fib: 2, custom_instructions: '',
  });
  const [editUploadedFiles, setEditUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [editSourceContent, setEditSourceContent] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const [extractingPdf, setExtractingPdf] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  // Sessions tab filters
  const [sessFilterBank, setSessFilterBank] = useState<string>('all');
  const [sessFilterStatus, setSessFilterStatus] = useState<string>('all');
  const [sessSort, setSessSort] = useState<'newest' | 'submissions' | 'duration'>('newest');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Results tab filters
  const [resQuiz, setResQuiz] = useState<string>('all');
  const [resSession, setResSession] = useState<string>('all');
  const [resSearch, setResSearch] = useState('');
  const [resFrom, setResFrom] = useState('');
  const [resTo, setResTo] = useState('');
  const [resScoreRange, setResScoreRange] = useState<[number, number]>([0, 100]);
  const [resPassFilter, setResPassFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [resSort, setResSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailAttemptId, setDetailAttemptId] = useState<string | null>(null);
  // Frozen snapshot of the ordered list at click time so Next/Prev can't drift
  // when filters/sorting/refetches change the underlying array.
  const [detailList, setDetailList] = useState<any[]>([]);
  const [fullReportOpen, setFullReportOpen] = useState(false);
  const [shareBank, setShareBank] = useState<{ id: string; name: string } | null>(null);

  const DRAFT_KEY = 'quiz-engine:create-draft';
  const emptyForm = {
    name: '', description: '', language: 'en',
    course_id: '', mode: 'public' as 'authenticated' | 'public',
    mcq: 5, tf: 3, fib: 2,
    difficulty_level: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    questions_per_attempt: 10, time_limit_minutes: 0,
    max_attempts: 1, passing_percentage: 50,
    source_content: '', custom_instructions: '',
  };

  // Form state — restored from an unsaved draft when the page was left mid-way
  const [form, setForm] = useState(() => loadDraft<typeof emptyForm>(DRAFT_KEY) || emptyForm);
  useDraftPersistence(DRAFT_KEY, form, { enabled: !!form.name || !!form.source_content });



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setExtractingPdf(true);
    try {
      const newFiles = await extractSourceFiles(files, 5);
      setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 5));
      const allText = [...uploadedFiles, ...newFiles].map(f => `[SOURCE: ${f.name}]\n${f.text}`).join('\n\n');
      setForm(prev => ({ ...prev, source_content: allText }));
      toast({ title: `${newFiles.length} file(s) processed` });
    } catch (err: any) {
      toast({ title: 'File processing failed', description: err.message, variant: 'destructive' });
    } finally {
      setExtractingPdf(false);
      if (e.target) e.target.value = '';
    }
  };


  const removeFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    const allText = updated.map(f => `[SOURCE: ${f.name}]\n${f.text}`).join('\n\n');
    setForm(prev => ({ ...prev, source_content: allText }));
  };

  // Load courses for dropdown
  const { data: courses = [] } = useQuery({
    queryKey: ['quiz-engine-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name').eq('status', 'active').order('name');
      return data || [];
    },
  });

  // Load quiz banks
  const { data: banks = [], isLoading: banksLoading } = useQuery({
    queryKey: ['quiz-banks'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_banks') as any)
        .select('*, course:courses(name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Load sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['quiz-sessions'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_sessions') as any)
        .select('*, quiz_bank:quiz_banks(name, mode)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Load attempts (ALL rows, no DISTINCT — each row = one attempt)
  const { data: attempts = [] } = useQuery({
    queryKey: ['quiz-attempts'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_attempts') as any)
        .select('*, session:quiz_sessions(title, access_token, quiz_bank_id, created_at), quiz_bank:quiz_banks(id, name, language, passing_percentage)')
        .eq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(2000);
      return data || [];
    },
  });

  // Derived: session # per bank (ordered by created_at asc)
  const sessionNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    const byBank: Record<string, any[]> = {};
    sessions.forEach((s: any) => {
      (byBank[s.quiz_bank_id] ||= []).push(s);
    });
    Object.values(byBank).forEach((list) => {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach((s, i) => map.set(s.id, i + 1));
    });
    return map;
  }, [sessions]);

  // Derived: attempts grouped by session
  const attemptsBySession = useMemo(() => {
    const map: Record<string, any[]> = {};
    attempts.forEach((a: any) => { (map[a.session_id] ||= []).push(a); });
    return map;
  }, [attempts]);

  // Derived: bank-level metrics (live sessions count, total sessions)
  const bankSessionStats = useMemo(() => {
    const map: Record<string, { total: number; live: number }> = {};
    sessions.forEach((s: any) => {
      const m = map[s.quiz_bank_id] ||= { total: 0, live: 0 };
      m.total++;
      if (s.status === 'live') m.live++;
    });
    return map;
  }, [sessions]);

  // Derived: attempt # per (student identity, quiz_bank_id), ranked by created_at asc
  const attemptNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    const groups: Record<string, any[]> = {};
    [...attempts].forEach((a: any) => {
      const ident = a.student_id || a.guest_email || a.guest_name || 'unknown';
      const key = `${ident}::${a.quiz_bank_id}`;
      (groups[key] ||= []).push(a);
    });
    Object.values(groups).forEach((list) => {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach((a, i) => map.set(a.id, i + 1));
    });
    return map;
  }, [attempts]);

  // Identify attempts (for grouping in expand)
  const attemptIdentity = (a: any) =>
    a.student_id || a.guest_email || a.guest_name || 'unknown';


  const createBank = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      // 1. Create the bank record
      const { data: bank, error } = await (supabase.from('quiz_banks') as any).insert({
        name: form.name,
        description: form.description || null,
        language: form.language,
        course_id: form.course_id || null,
        mode: form.mode,
        question_mix: { mcq: form.mcq, tf: form.tf, fib: form.fib },
        difficulty_level: form.difficulty_level,
        questions_per_attempt: form.mcq + form.tf + form.fib,
        time_limit_minutes: form.time_limit_minutes || null,
        max_attempts: form.max_attempts || 1,
        passing_percentage: form.passing_percentage,
        source_content: form.source_content,
        question_bank: [],
        created_by: user?.id,
        status: 'draft',
      }).select('id').single();

      if (error) throw error;

      // 2. Call AI to generate question bank
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-quiz-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
         body: JSON.stringify({
          quiz_bank_id: bank.id,
          source_content: form.source_content,
          language: form.language,
          difficulty_level: form.difficulty_level,
          question_mix: { mcq: form.mcq, tf: form.tf, fib: form.fib },
          custom_instructions: form.custom_instructions || '',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Generation failed');
      return result;
    },
    onSuccess: (data) => {
      setGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Quiz Bank Created', description: `${data.count} questions generated by AI` });
    },
    onError: (e: any) => {
      setGenerating(false);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const createSession = useMutation({
    mutationFn: async (bankId: string) => {
      const bank = banks.find((b: any) => b.id === bankId);
      const { error } = await (supabase.from('quiz_sessions') as any).insert({
        quiz_bank_id: bankId,
        title: bank?.name || 'Quiz Session',
        status: 'live',
        created_by: user?.id,
      });
      if (error) throw error;
      // Also mark bank as published
      await (supabase.from('quiz_banks') as any).update({ status: 'published' }).eq('id', bankId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      toast({ title: 'Session created & live!' });
    },
  });

  const toggleSession = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const closing = status === 'live';
      const { error } = await (supabase.from('quiz_sessions') as any)
        .update({
          status: closing ? 'closed' : 'live',
          closes_at: closing ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      toast({ title: 'Session updated' });
    },
  });

  const bulkCloseEmpty = useMutation({
    mutationFn: async () => {
      const empty = sessions.filter((s: any) =>
        s.status === 'live' && !attempts.some((a: any) => a.session_id === s.id)
      );
      if (empty.length === 0) return 0;
      const { error } = await (supabase.from('quiz_sessions') as any)
        .update({ status: 'closed', closes_at: new Date().toISOString() })
        .in('id', empty.map((s: any) => s.id));
      if (error) throw error;
      return empty.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      toast({ title: `Closed ${n} empty session${n === 1 ? '' : 's'}` });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('quiz_sessions') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
      toast({ title: 'Session deleted' });
    },
    onError: (e: any) => {
      toast({ title: 'Could not delete session', description: e.message, variant: 'destructive' });
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('quiz_banks') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      toast({ title: 'Deleted' });
    },
  });

  const updateBank = useMutation({
    mutationFn: async ({ regenerate }: { regenerate?: boolean } = {}) => {
      const { id, mcq, tf, fib, custom_instructions, ...updates } = editForm;
      const totalQ = mcq + tf + fib;
      const { error } = await (supabase.from('quiz_banks') as any).update({
        name: updates.name,
        description: updates.description || null,
        language: updates.language,
        mode: updates.mode,
        course_id: updates.course_id || null,
        difficulty_level: updates.difficulty_level,
        questions_per_attempt: totalQ,
        time_limit_minutes: updates.time_limit_minutes || null,
        max_attempts: updates.max_attempts || 1,
        passing_percentage: updates.passing_percentage,
        question_mix: { mcq, tf, fib },
      }).eq('id', id);
      if (error) throw error;

      if (regenerate && editSourceContent.trim()) {
        setRegenerating(true);
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-quiz-bank`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({
            quiz_bank_id: id,
            source_content: editSourceContent,
            language: updates.language,
            difficulty_level: updates.difficulty_level,
            question_mix: { mcq, tf, fib },
            custom_instructions: custom_instructions || '',
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Regeneration failed');
        return result;
      }
    },
    onSuccess: (data) => {
      setRegenerating(false);
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      setEditOpen(false);
      toast({ title: data?.count ? `Regenerated ${data.count} questions` : 'Quiz bank updated' });
    },
    onError: (e: any) => {
      setRegenerating(false);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const openEdit = (bank: any) => {
    const mix = bank.question_mix || {};
    setEditForm({
      id: bank.id,
      name: bank.name || '',
      description: bank.description || '',
      language: bank.language || 'en',
      mode: bank.mode || 'public',
      course_id: bank.course_id || '',
      difficulty_level: bank.difficulty_level || 'mixed',
      questions_per_attempt: bank.questions_per_attempt || 10,
      time_limit_minutes: bank.time_limit_minutes || 0,
      max_attempts: bank.max_attempts || 1,
      passing_percentage: bank.passing_percentage || 50,
      mcq: mix.mcq || 5,
      tf: mix.tf || 3,
      fib: mix.fib || 2,
      custom_instructions: bank.custom_instructions || '',
    });
    setEditSourceContent(bank.source_content || '');
    setEditUploadedFiles([]);
    setEditOpen(true);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setUploadedFiles([]);
    clearDraft(DRAFT_KEY);
  };

  // Save the half-finished quiz as a draft without running AI generation
  const saveDraft = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from('quiz_banks') as any).insert({
        name: form.name || 'Untitled quiz',
        description: form.description || null,
        language: form.language,
        course_id: form.course_id || null,
        mode: form.mode,
        question_mix: { mcq: form.mcq, tf: form.tf, fib: form.fib },
        difficulty_level: form.difficulty_level,
        questions_per_attempt: form.mcq + form.tf + form.fib,
        time_limit_minutes: form.time_limit_minutes || null,
        max_attempts: form.max_attempts || 1,
        passing_percentage: form.passing_percentage,
        source_content: form.source_content,
        question_bank: [],
        created_by: user?.id,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Saved as draft', description: 'You can generate questions later from Edit.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });


  const copyLink = (token: string) => {
    const url = `${window.location.origin}/quiz/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  const getQuestionCount = (bank: any) => {
    try { return Array.isArray(bank.question_bank) ? bank.question_bank.length : 0; } catch { return 0; }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Quiz Engine</h1>
            <p className="text-sm text-muted-foreground">AI-powered quiz banks for pre-screening & assessments</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Quiz Bank
          </Button>
        </div>

        {(() => {
          // ====== Sessions: filter + group ======
          const filteredSessions = sessions.filter((s: any) => {
            if (sessFilterBank !== 'all' && s.quiz_bank_id !== sessFilterBank) return false;
            if (sessFilterStatus !== 'all' && s.status !== sessFilterStatus) return false;
            return true;
          });
          const sortedSessions = [...filteredSessions].sort((a: any, b: any) => {
            if (sessSort === 'submissions') {
              return (attemptsBySession[b.id]?.length || 0) - (attemptsBySession[a.id]?.length || 0);
            }
            if (sessSort === 'duration') {
              const aEnd = a.closes_at || a.updated_at || new Date().toISOString();
              const bEnd = b.closes_at || b.updated_at || new Date().toISOString();
              const aDur = new Date(aEnd).getTime() - new Date(a.created_at).getTime();
              const bDur = new Date(bEnd).getTime() - new Date(b.created_at).getTime();
              return bDur - aDur;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          const groupedSessions: Record<string, { name: string; items: any[] }> = {};
          sortedSessions.forEach((s: any) => {
            const key = s.quiz_bank_id;
            const name = s.quiz_bank?.name || s.title || 'Untitled';
            (groupedSessions[key] ||= { name, items: [] }).items.push(s);
          });
          const emptyLiveCount = sessions.filter((s: any) =>
            s.status === 'live' && !attempts.some((a: any) => a.session_id === s.id)
          ).length;

          // ====== Results: filter + sort ======
          let filteredResults = attempts.filter((a: any) => {
            if (resQuiz !== 'all' && a.quiz_bank_id !== resQuiz) return false;
            if (resSession !== 'all' && a.session_id !== resSession) return false;
            if (resSearch) {
              const q = resSearch.toLowerCase();
              const name = (a.guest_name || '').toLowerCase();
              const email = (a.guest_email || '').toLowerCase();
              if (!name.includes(q) && !email.includes(q)) return false;
            }
            if (resFrom && new Date(a.created_at) < new Date(resFrom)) return false;
            if (resTo && new Date(a.created_at) > new Date(resTo + 'T23:59:59')) return false;
            const pct = Number(a.percentage) || 0;
            if (pct < resScoreRange[0] || pct > resScoreRange[1]) return false;
            const pass = pct >= (a.quiz_bank?.passing_percentage ?? 50);
            if (resPassFilter === 'pass' && !pass) return false;
            if (resPassFilter === 'fail' && pass) return false;
            return true;
          });
          filteredResults = [...filteredResults].sort((a: any, b: any) => {
            const dir = resSort.dir === 'asc' ? 1 : -1;
            const va = (() => {
              switch (resSort.key) {
                case 'name': return (a.guest_name || '').toLowerCase();
                case 'email': return (a.guest_email || '').toLowerCase();
                case 'quiz': return (a.quiz_bank?.name || '').toLowerCase();
                case 'score': return Number(a.score) || 0;
                case 'pct': return Number(a.percentage) || 0;
                case 'time': return Number(a.time_taken_seconds) || 0;
                case 'sessionNum': return sessionNumberMap.get(a.session_id) || 0;
                case 'attempt': return attemptNumberMap.get(a.id) || 0;
                case 'pass': return (Number(a.percentage) || 0) >= (a.quiz_bank?.passing_percentage ?? 50) ? 1 : 0;
                case 'date':
                default: return new Date(a.created_at).getTime();
              }
            })();
            const vb = (() => {
              switch (resSort.key) {
                case 'name': return (b.guest_name || '').toLowerCase();
                case 'email': return (b.guest_email || '').toLowerCase();
                case 'quiz': return (b.quiz_bank?.name || '').toLowerCase();
                case 'score': return Number(b.score) || 0;
                case 'pct': return Number(b.percentage) || 0;
                case 'time': return Number(b.time_taken_seconds) || 0;
                case 'sessionNum': return sessionNumberMap.get(b.session_id) || 0;
                case 'attempt': return attemptNumberMap.get(b.id) || 0;
                case 'pass': return (Number(b.percentage) || 0) >= (b.quiz_bank?.passing_percentage ?? 50) ? 1 : 0;
                case 'date':
                default: return new Date(b.created_at).getTime();
              }
            })();
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
          });

          const toggleSort = (key: string) => {
            setResSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
          };
          const SortIcon = ({ k }: { k: string }) => {
            if (resSort.key !== k) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />;
            return resSort.dir === 'asc'
              ? <ArrowUp className="h-3 w-3 inline ml-1" />
              : <ArrowDown className="h-3 w-3 inline ml-1" />;
          };

          // Per-quiz summary (when single quiz selected)
          const quizSummary = resQuiz !== 'all' ? (() => {
            const bank = banks.find((b: any) => b.id === resQuiz);
            const all = attempts.filter((a: any) => a.quiz_bank_id === resQuiz);
            const total = all.length;
            const unique = new Set(all.map((a: any) => attemptIdentity(a))).size;
            const avg = total ? Math.round(all.reduce((s: number, a: any) => s + (Number(a.percentage) || 0), 0) / total) : 0;
            const passed = all.filter((a: any) => (Number(a.percentage) || 0) >= (bank?.passing_percentage ?? 50)).length;
            const passRate = total ? Math.round((passed / total) * 100) : 0;
            return { bank, total, unique, avg, passRate, passed };
          })() : null;

          return (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="banks" className="gap-1 text-xs">
                  <FileText className="h-3.5 w-3.5" /> Banks ({banks.length})
                </TabsTrigger>
                <TabsTrigger value="sessions" className="gap-1 text-xs">
                  <LinkIcon className="h-3.5 w-3.5" /> Sessions ({sessions.length})
                </TabsTrigger>
                <TabsTrigger value="results" className="gap-1 text-xs">
                  <Trophy className="h-3.5 w-3.5" /> Results ({attempts.length})
                </TabsTrigger>
              </TabsList>

              {/* ===== Banks Tab ===== */}
              <TabsContent value="banks" className="mt-4 space-y-3">
                {banksLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : banks.length === 0 ? (
                  <Card><CardContent className="p-8 text-center">
                    <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No quiz banks yet. Create one to get started.</p>
                  </CardContent></Card>
                ) : (
                  <div className="grid gap-3">
                    {banks.map((bank: any) => {
                      const stats = bankSessionStats[bank.id] || { total: 0, live: 0 };
                      const hasLive = stats.live > 0;
                      const bankAttempts = attempts.filter((a: any) => a.quiz_bank_id === bank.id).length;
                      return (
                        <Card key={bank.id} className="border-border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-medium">{bank.name}</h4>
                                  {hasLive ? (
                                    <Badge className="text-xs gap-1 bg-green-600 hover:bg-green-600 text-white border-transparent">
                                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                      Live
                                    </Badge>
                                  ) : (
                                    <Badge variant={bank.status === 'published' ? 'default' : 'secondary'} className="text-xs">{bank.status}</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs gap-1">
                                    {bank.mode === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                    {bank.mode}
                                  </Badge>
                                  {bank.course?.name && <Badge variant="outline" className="text-xs">{bank.course.name}</Badge>}
                                </div>
                                {bank.description && <p className="text-xs text-muted-foreground">{bank.description}</p>}
                                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span>{getQuestionCount(bank)} Qs</span>
                                  <span>{bank.language?.toUpperCase()}</span>
                                  {bank.time_limit_minutes ? <span>⏱ {bank.time_limit_minutes}min</span> : <span>No timer</span>}
                                  <span>{bank.max_attempts || 1} attempt{(bank.max_attempts || 1) > 1 ? 's' : ''}</span>
                                  <span>Pass: {bank.passing_percentage}%</span>
                                  <span>{bankAttempts} submission{bankAttempts === 1 ? '' : 's'}</span>
                                  <button
                                    className="underline hover:text-foreground"
                                    onClick={() => { setSessFilterBank(bank.id); setActiveTab('sessions'); }}
                                  >
                                    {stats.live} active / {stats.total} session{stats.total === 1 ? '' : 's'}
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={hasLive ? 'secondary' : 'outline'}
                                  className="text-xs h-7"
                                  onClick={() => createSession.mutate(bank.id)}
                                  disabled={getQuestionCount(bank) === 0}
                                >
                                  <Play className="h-3 w-3 mr-1" /> {hasLive ? 'New Session' : 'Go Live'}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  title="Share with collaborators"
                                  onClick={() => setShareBank({ id: bank.id, name: bank.name })}>
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  onClick={() => openEdit(bank)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                                  onClick={() => deleteBank.mutate(bank.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ===== Sessions Tab ===== */}
              <TabsContent value="sessions" className="mt-4 space-y-3">
                {sessions.length === 0 ? (
                  <Card><CardContent className="p-8 text-center">
                    <LinkIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No active sessions. Go Live on a quiz bank to create one.</p>
                  </CardContent></Card>
                ) : (
                  <>
                    {/* Filter bar */}
                    <Card>
                      <CardContent className="p-3 flex flex-wrap items-center gap-2">
                        <Select value={sessFilterBank} onValueChange={setSessFilterBank}>
                          <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Quizzes</SelectItem>
                            {banks.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={sessFilterStatus} onValueChange={setSessFilterStatus}>
                          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="live">Live</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={sessSort} onValueChange={(v: any) => setSessSort(v)}>
                          <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Sort: Newest</SelectItem>
                            <SelectItem value="submissions">Sort: Most Submissions</SelectItem>
                            <SelectItem value="duration">Sort: Duration</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Showing {sortedSessions.length} of {sessions.length}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-8"
                            disabled={emptyLiveCount === 0}
                            onClick={() => bulkCloseEmpty.mutate()}
                          >
                            Bulk Close {emptyLiveCount} Empty
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {Object.entries(groupedSessions).map(([bankId, group]) => {
                      const isCollapsed = collapsedGroups[bankId];
                      return (
                        <Collapsible
                          key={bankId}
                          open={!isCollapsed}
                          onOpenChange={(open) => setCollapsedGroups((m) => ({ ...m, [bankId]: !open }))}
                        >
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 rounded-md text-left">
                              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <span className="text-sm font-medium">{group.name}</span>
                              <span className="text-xs text-muted-foreground">({group.items.length} session{group.items.length === 1 ? '' : 's'})</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {group.items.map((s: any) => {
                              const sessionAttempts = attemptsBySession[s.id] || [];
                              const sessNum = sessionNumberMap.get(s.id);
                              const ageHours = (Date.now() - new Date(s.created_at).getTime()) / 3600000;
                              const showStale = sessionAttempts.length === 0 && ageHours > 24 && s.status === 'live';
                              return (
                                <Card key={s.id} className="border-border">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="outline" className="text-xs">Session #{sessNum}</Badge>
                                          <h4 className="text-sm font-medium">{s.title || s.quiz_bank?.name}</h4>
                                          {s.status === 'live' ? (
                                            <Badge className="text-xs gap-1 bg-green-600 hover:bg-green-600 text-white border-transparent">
                                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" className="text-xs">Closed</Badge>
                                          )}
                                          <Badge variant="outline" className="text-xs">
                                            {s.quiz_bank?.mode === 'public' ? '🌐 Public' : '🔒 Auth'}
                                          </Badge>
                                          {showStale && (
                                            <Badge className="text-xs gap-1 bg-amber-500 hover:bg-amber-500 text-white border-transparent">
                                              <AlertTriangle className="h-3 w-3" /> 0 submissions
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                                          <button
                                            className="underline hover:text-foreground"
                                            onClick={() => { setResSession(s.id); setResQuiz('all'); setActiveTab('results'); }}
                                          >
                                            {sessionAttempts.length} submission{sessionAttempts.length === 1 ? '' : 's'}
                                          </button>
                                          <span>Created: {format(new Date(s.created_at), 'MMM d, yyyy')} at {format(new Date(s.created_at), 'HH:mm')}</span>
                                          {s.status === 'closed' && s.closes_at && (
                                            <span>Closed: {format(new Date(s.closes_at), 'MMM d, yyyy')} at {format(new Date(s.closes_at), 'HH:mm')}</span>
                                          )}
                                          <span>Active for {formatDuration(s.created_at, s.status === 'closed' ? s.closes_at : null)}</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        {s.quiz_bank?.mode === 'public' && (
                                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                                            onClick={() => copyLink(s.access_token)}>
                                            <Copy className="h-3 w-3" /> Copy Link
                                          </Button>
                                        )}
                                        {s.status === 'live' ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => toggleSession.mutate({ id: s.id, status: s.status })}
                                          >
                                            <Square className="h-3 w-3 mr-1" /> Close Session
                                          </Button>
                                        ) : (
                                          <Button size="sm" variant="ghost" className="text-xs h-7"
                                            onClick={() => toggleSession.mutate({ id: s.id, status: s.status })}>
                                            <Play className="h-3 w-3 mr-1" /> Reopen
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </>
                )}
              </TabsContent>

              {/* ===== Results Tab ===== */}
              <TabsContent value="results" className="mt-4 space-y-3">
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={resQuiz} onValueChange={(v) => { setResQuiz(v); setResSession('all'); }}>
                        <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Quizzes</SelectItem>
                          {banks.map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={resSession} onValueChange={setResSession}>
                        <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sessions</SelectItem>
                          {sessions
                            .filter((s: any) => resQuiz === 'all' || s.quiz_bank_id === resQuiz)
                            .map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.quiz_bank?.name || s.title} — Session #{sessionNumberMap.get(s.id)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={resSearch}
                          onChange={(e) => setResSearch(e.target.value)}
                          placeholder="Search name or email"
                          className="h-8 text-xs pl-7 w-[200px]"
                        />
                      </div>
                      <Input type="date" value={resFrom} onChange={(e) => setResFrom(e.target.value)} className="h-8 text-xs w-[140px]" />
                      <Input type="date" value={resTo} onChange={(e) => setResTo(e.target.value)} className="h-8 text-xs w-[140px]" />
                      <div className="flex gap-1">
                        <Button size="sm" variant={resPassFilter === 'all' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setResPassFilter('all')}>All</Button>
                        <Button size="sm" variant={resPassFilter === 'pass' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setResPassFilter('pass')}>Pass</Button>
                        <Button size="sm" variant={resPassFilter === 'fail' ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setResPassFilter('fail')}>Fail</Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">Score: {resScoreRange[0]}%–{resScoreRange[1]}%</span>
                      <Slider
                        min={0} max={100} step={1}
                        value={resScoreRange}
                        onValueChange={(v) => setResScoreRange([v[0], v[1]] as [number, number])}
                        className="max-w-xs"
                      />
                      <Button
                        size="sm" variant="ghost" className="h-8 text-xs"
                        onClick={() => {
                          setResQuiz('all'); setResSession('all'); setResSearch(''); setResFrom(''); setResTo('');
                          setResScoreRange([0, 100]); setResPassFilter('all');
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {quizSummary && quizSummary.bank && (
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><p className="text-xs text-muted-foreground">Total attempts</p><p className="text-lg font-semibold">{quizSummary.total}</p></div>
                        <div><p className="text-xs text-muted-foreground">Unique students</p><p className="text-lg font-semibold">{quizSummary.unique}</p></div>
                        <div><p className="text-xs text-muted-foreground">Avg score</p><p className="text-lg font-semibold">{quizSummary.avg}%</p></div>
                        <div><p className="text-xs text-muted-foreground">Pass rate</p><p className="text-lg font-semibold">{quizSummary.passRate}%</p></div>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden bg-destructive/30 flex">
                        <div className="bg-green-600 h-full" style={{ width: `${quizSummary.passRate}%` }} />
                        <div className="bg-destructive h-full" style={{ width: `${100 - quizSummary.passRate}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{quizSummary.passed} pass / {quizSummary.total - quizSummary.passed} fail</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Showing {filteredResults.length} of {attempts.length} results</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setFullReportOpen(true)} disabled={filteredResults.length === 0}>
                        <FileBarChart className="h-3.5 w-3.5 mr-1" /> Full Report
                      </Button>
                      <Button size="sm" onClick={() => setExportOpen(true)} disabled={filteredResults.length === 0}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {filteredResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No results match the filters.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="text-xs">#</TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('sessionNum')}>Session<SortIcon k="sessionNum" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('attempt')}>Attempt<SortIcon k="attempt" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('name')}>Name<SortIcon k="name" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('email')}>Email<SortIcon k="email" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('quiz')}>Quiz<SortIcon k="quiz" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('score')}>Score<SortIcon k="score" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('pct')}>%<SortIcon k="pct" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('pass')}>Result<SortIcon k="pass" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('time')}>Time<SortIcon k="time" /></TableHead>
                              <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort('date')}>Date &amp; Time<SortIcon k="date" /></TableHead>
                              <TableHead className="text-xs w-[60px] text-right">Review</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResults.map((a: any, idx: number) => {
                              const passThreshold = a.quiz_bank?.passing_percentage ?? 50;
                              const pctVal = Number(a.percentage) || 0;
                              const isPass = pctVal >= passThreshold;
                              return (
                                <TableRow
                                  key={a.id}
                                  className="cursor-pointer transition-colors hover:bg-primary/5"
                                  onClick={() => { setDetailList([...filteredResults]); setDetailAttemptId(a.id); }}
                                >
                                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                  <TableCell className="text-xs font-mono">#{sessionNumberMap.get(a.session_id) || '—'}</TableCell>
                                  <TableCell className="text-xs font-mono">#{attemptNumberMap.get(a.id) || 1}</TableCell>
                                  <TableCell className="text-sm font-medium">{a.guest_name || '—'}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{a.guest_email || '—'}</TableCell>
                                  <TableCell className="text-sm">{a.quiz_bank?.name || a.session?.title || '—'}</TableCell>
                                  <TableCell className="text-sm font-mono">{a.score}/{a.max_score}</TableCell>
                                  <TableCell>
                                    <Badge variant={pctVal >= 70 ? 'default' : pctVal >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                                      {pctVal}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={`text-xs ${isPass ? 'bg-green-600 hover:bg-green-600' : 'bg-destructive hover:bg-destructive'} text-white border-transparent`}>
                                      {isPass ? 'Pass' : 'Fail'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {a.time_taken_seconds ? `${Math.floor(a.time_taken_seconds / 60)}m ${a.time_taken_seconds % 60}s` : '—'}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(a.created_at), 'MMM d, yyyy HH:mm')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={(e) => { e.stopPropagation(); setDetailList([...filteredResults]); setDetailAttemptId(a.id); }}
                                      title="View full quiz review"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>


                {/* Export uses filtered set */}
                <QuizResultsExportDialog
                  open={exportOpen}
                  onOpenChange={setExportOpen}
                  filename="quiz-results"
                  rows={filteredResults.map((a: any, idx: number) => {
                    const isPass = (Number(a.percentage) || 0) >= (a.quiz_bank?.passing_percentage ?? 50);
                    return {
                      row: idx + 1,
                      session_num: sessionNumberMap.get(a.session_id) || '',
                      attempt_num: attemptNumberMap.get(a.id) || '',
                      name: a.guest_name || '',
                      email: a.guest_email || '',
                      quiz: a.quiz_bank?.name || a.session?.title || '',
                      score: `${a.score}/${a.max_score}`,
                      percentage: Number(a.percentage) || 0,
                      result: isPass ? 'Pass' : 'Fail',
                      time: a.time_taken_seconds ? `${Math.floor(a.time_taken_seconds / 60)}m ${a.time_taken_seconds % 60}s` : '',
                      date: format(new Date(a.created_at), 'yyyy-MM-dd HH:mm'),
                    };
                  })}
                />

                <QuizFullReportDialog
                  open={fullReportOpen}
                  onOpenChange={setFullReportOpen}
                  quizName={quizSummary?.bank?.name || 'All Quizzes'}
                  subtitle={`Quiz Participation & Performance Report · ${filteredResults.length} attempts`}
                  rows={filteredResults.map((a: any) => ({
                    name: a.guest_name || 'Anonymous',
                    email: a.guest_email || '',
                    percentage: Number(a.percentage) || 0,
                    score: `${a.score}/${a.max_score}`,
                    pass: (Number(a.percentage) || 0) >= (a.quiz_bank?.passing_percentage ?? 50),
                  }))}
                />

                <AttemptDetailDialog
                  open={!!detailAttemptId}
                  onOpenChange={(o) => { if (!o) { setDetailAttemptId(null); setDetailList([]); } }}
                  attempts={detailList}
                  attemptId={detailAttemptId}
                  setAttemptId={setDetailAttemptId}
                  sessionNumberMap={sessionNumberMap}
                  attemptNumberMap={attemptNumberMap}
                />

              </TabsContent>
            </Tabs>
          );
        })()}

        <QuizCollaboratorsDialog
          quizBankId={shareBank?.id ?? null}
          quizName={shareBank?.name}
          open={!!shareBank}
          onOpenChange={(o) => !o && setShareBank(null)}
        />

        {/* Create Quiz Bank Dialog */}
        <Dialog open={createOpen} onOpenChange={c => { if (!generating) { setCreateOpen(c); if (!c) resetForm(); } }}>

          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Quiz Bank</DialogTitle>
              <DialogDescription>Upload source content and AI will generate a question bank.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Quiz Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Arabic Level 1 Pre-Screening" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Language</Label>
                  <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={form.mode} onValueChange={(v: any) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 Public Link</SelectItem>
                      <SelectItem value="authenticated">🔒 Authenticated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Link to Course (optional)</Label>
                <Select value={form.course_id} onValueChange={v => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Number of Questions by Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-[10px] text-muted-foreground">MCQ</Label><Input type="number" min={0} value={form.mcq} onChange={e => setForm({ ...form, mcq: +e.target.value })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">True / False</Label><Input type="number" min={0} value={form.tf} onChange={e => setForm({ ...form, tf: +e.target.value })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">Fill in Blank</Label><Input type="number" min={0} value={form.fib} onChange={e => setForm({ ...form, fib: +e.target.value })} /></div>
                </div>
                <p className="text-[10px] text-muted-foreground">Total questions per quiz: <strong>{form.mcq + form.tf + form.fib}</strong></p>
              </div>
              <div>
                <Label className="text-xs">Difficulty Level</Label>
                <Select value={form.difficulty_level} onValueChange={(v: any) => setForm({ ...form, difficulty_level: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Time Limit (minutes)</Label>
                  <Input type="number" min={0} value={form.time_limit_minutes} onChange={e => setForm({ ...form, time_limit_minutes: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">0 = no timer</p>
                </div>
                <div>
                  <Label className="text-xs">Max Attempts</Label>
                  <Input type="number" min={1} value={form.max_attempts} onChange={e => setForm({ ...form, max_attempts: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Per email/student</p>
                </div>
                <div>
                  <Label className="text-xs">Passing %</Label>
                  <Input type="number" min={0} max={100} value={form.passing_percentage} onChange={e => setForm({ ...form, passing_percentage: +e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Source Content *</Label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                    {extractingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload PDF / Image / Audio / Video / Text
                    <input type="file" multiple accept={QUIZ_SOURCE_ACCEPT} className="hidden" onChange={handleFileUpload} disabled={extractingPdf} />
                  </label>
                  <span className="text-[10px] text-muted-foreground">Max 5 files · PDFs up to 50 pages · media is transcribed by AI</span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {uploadedFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                        <FileText className="h-3 w-3" /> {f.name}
                        <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Textarea value={form.source_content} onChange={e => setForm({ ...form, source_content: e.target.value })}
                  placeholder="Upload files above (PDF, image, audio, video, text) or paste text directly..."

                  className="min-h-[100px] text-xs" />
              </div>
              <div>
                <Label className="text-xs">Custom AI Instructions (optional)</Label>
                <Textarea value={form.custom_instructions} onChange={e => setForm({ ...form, custom_instructions: e.target.value })}
                  placeholder="e.g. Focus on chapters 3-5 only."
                  className="min-h-[70px] text-xs" />
                <p className="text-[10px] text-muted-foreground mt-0.5">By default AI already focuses only on core topics and ignores URLs, watermarks, page headers, dates and author names. Add anything extra here.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={generating}>Cancel</Button>
              <Button variant="secondary" onClick={() => saveDraft.mutate()} disabled={!form.name.trim() || generating || saveDraft.isPending}>
                {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save as Draft'}
              </Button>
              <Button onClick={() => createBank.mutate()}

                disabled={!form.name.trim() || !form.source_content.trim() || generating}
                className="gap-1.5">
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : 'Create & Generate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Quiz Bank Dialog */}
        <Dialog open={editOpen} onOpenChange={v => { if (!regenerating) setEditOpen(v); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quiz Bank</DialogTitle>
              <DialogDescription>Update settings, question mix, or regenerate questions with new content.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Quiz Name *</Label>
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Language</Label>
                  <Select value={editForm.language} onValueChange={v => setEditForm({ ...editForm, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={editForm.mode} onValueChange={v => setEditForm({ ...editForm, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 Public Link</SelectItem>
                      <SelectItem value="authenticated">🔒 Authenticated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Link to Course (optional)</Label>
                  <Select value={editForm.course_id} onValueChange={v => setEditForm({ ...editForm, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Difficulty Level</Label>
                  <Select value={editForm.difficulty_level} onValueChange={v => setEditForm({ ...editForm, difficulty_level: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">MCQ Count</Label>
                  <Input type="number" min={0} value={editForm.mcq} onChange={e => setEditForm({ ...editForm, mcq: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">True/False Count</Label>
                  <Input type="number" min={0} value={editForm.tf} onChange={e => setEditForm({ ...editForm, tf: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Fill-in-Blank Count</Label>
                  <Input type="number" min={0} value={editForm.fib} onChange={e => setEditForm({ ...editForm, fib: +e.target.value })} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Total questions per attempt: {editForm.mcq + editForm.tf + editForm.fib}</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Time Limit (min)</Label>
                  <Input type="number" min={0} value={editForm.time_limit_minutes} onChange={e => setEditForm({ ...editForm, time_limit_minutes: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">0 = no timer</p>
                </div>
                <div>
                  <Label className="text-xs">Max Attempts</Label>
                  <Input type="number" min={1} value={editForm.max_attempts} onChange={e => setEditForm({ ...editForm, max_attempts: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Passing %</Label>
                  <Input type="number" min={0} max={100} value={editForm.passing_percentage} onChange={e => setEditForm({ ...editForm, passing_percentage: +e.target.value })} />
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <h4 className="text-sm font-medium mb-2">Regenerate Questions (optional)</h4>
                <p className="text-[10px] text-muted-foreground mb-2">Upload new source files or modify AI instructions to regenerate the question bank. Leave empty to keep existing questions.</p>
                
                <div>
                  <Label className="text-xs">Upload Source Files (PDF, image, audio, video or text — up to 5)</Label>
                  <Input type="file" accept={QUIZ_SOURCE_ACCEPT} multiple onChange={async (e) => {
                    const files = e.target.files;
                    if (!files) return;
                    setExtractingPdf(true);
                    try {
                      const newFiles = await extractSourceFiles(files, 5);
                      const allFiles = [...editUploadedFiles, ...newFiles].slice(0, 5);
                      setEditUploadedFiles(allFiles);
                      setEditSourceContent(allFiles.map(f => `[SOURCE: ${f.name}]\n${f.text}`).join('\n\n'));
                      toast({ title: `${newFiles.length} file(s) processed` });
                    } catch (err: any) {
                      toast({ title: 'File processing failed', description: err.message, variant: 'destructive' });
                    } finally {
                      setExtractingPdf(false);
                      if (e.target) e.target.value = '';
                    }
                  }} className="text-xs" disabled={extractingPdf} />
                  {extractingPdf && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Extracting content…</p>}

                </div>

                {editUploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editUploadedFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs">
                        <FileText className="h-3 w-3" /> {f.name}
                        <button onClick={() => {
                          const updated = editUploadedFiles.filter((_, idx) => idx !== i);
                          setEditUploadedFiles(updated);
                          setEditSourceContent(updated.length > 0 ? updated.map(fl => `[SOURCE: ${fl.name}]\n${fl.text}`).join('\n\n') : '');
                        }} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-2">
                  <Label className="text-xs">Or paste content directly</Label>
                  <Textarea value={editSourceContent} onChange={e => setEditSourceContent(e.target.value)}
                    className="min-h-[80px] text-xs" placeholder="Paste syllabus, notes, or content here..." />
                </div>

                <div className="mt-2">
                  <Label className="text-xs">Custom AI Instructions (optional)</Label>
                  <Textarea value={editForm.custom_instructions} onChange={e => setEditForm({ ...editForm, custom_instructions: e.target.value })}
                    placeholder="e.g. Focus on chapters 3-5 only."
                    className="min-h-[60px] text-xs" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Core-topic focus (ignoring URLs, watermarks, headers, dates, author names) is already applied by default</p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={regenerating}>Cancel</Button>
              <Button onClick={() => updateBank.mutate({ regenerate: false })} disabled={!editForm.name.trim() || regenerating}>
                Save Settings Only
              </Button>
              <Button onClick={() => updateBank.mutate({ regenerate: true })}
                disabled={!editForm.name.trim() || !editSourceContent.trim() || regenerating}
                variant="default" className="gap-1.5">
                {regenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Regenerating...</> : '🔄 Save & Regenerate Questions'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
