import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTeachingSession } from '@/hooks/useTeachingSession';
import { supabase } from '@/integrations/supabase/client';
import { NavRail, buildRailNav } from '@/components/layout/NavRail';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FileText, Settings, BarChart3, Bot, Clock, Star,
  ChevronRight, Plus, Sparkles, Check, X, GripVertical,
  AlertTriangle, TrendingUp, TrendingDown, Target, Lightbulb,
  Download, Send, Eye, Copy, Trash2, Edit2, ArrowRight,
  CheckCircle2, CircleDot, Circle
} from 'lucide-react';
import { PhaseStepperCompact } from '@/components/teaching/PhaseNavBar';

// Types
interface ExamQuestion {
  id: string;
  exam_id: string;
  question_index: number;
  type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  model_answer: string | null;
  scenario_context: string | null;
  blank_sentence: string | null;
  rubric: { points: number; criterion: string }[] | null;
  points: number;
  difficulty: string;
  blooms_level: string;
  auto_mark: boolean;
}

interface Exam {
  id: string;
  session_plan_id: string | null;
  course_id: string | null;
  title: string;
  instructions: string | null;
  duration_minutes: number | null;
  pass_mark_percent: number;
  total_marks: number;
  status: string;
  settings: any;
  opens_at: string | null;
  closes_at: string | null;
}

interface SessionPlan {
  id: string;
  session_title: string;
  session_objective: string;
  activities: any[];
  week_number: number;
  session_number: number;
  syllabus_id: string;
}

interface Submission {
  id: string;
  student_id: string;
  status: string;
  total_score: number;
  total_possible: number;
  percentage: number;
  passed: boolean;
  time_taken_minutes: number | null;
  submitted_at: string | null;
}

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  affected_students: number;
  affected_percent: number;
  suggested_actions: string[];
  applied_to_plan: boolean;
  dismissed: boolean;
}

interface MarkingItem {
  responseId: string;
  studentName: string;
  questionText: string;
  questionType: string;
  studentAnswer: string;
  aiScore: number | null;
  aiConfidence: number | null;
  aiFeedback: string | null;
  maxPoints: number;
  teacherReviewed: boolean;
}

type Section = 'builder' | 'settings' | 'results' | 'marking' | 'insights' | 'past' | 'progress';


const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  mcq: { bg: '#eef2fa', text: '#1a56b0', label: 'MCQ' },
  short_answer: { bg: '#e6f4ea', text: '#1a7340', label: 'Short answer' },
  scenario: { bg: '#fff8e6', text: '#8a5c00', label: 'Scenario' },
  creative: { bg: '#f3eefe', text: '#534AB7', label: 'Creative' },
  true_false: { bg: '#f4f5f7', text: '#4a5264', label: 'True/False' },
  fill_blank: { bg: '#eef2fa', text: '#1a56b0', label: 'Fill blank' },
  translation: { bg: '#e1f5ee', text: '#0F6E56', label: 'Translation' },
};

const TeachingOSAssessment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { sessionId } = useTeachingSession();

  const [activeSection, setActiveSection] = useState<Section>('builder');
  const [builderView, setBuilderView] = useState<'builder' | 'preview' | 'student'>('builder');
  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [courseName, setCourseName] = useState('');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [markingQueue, setMarkingQueue] = useState<MarkingItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Settings form state
  const [examSettings, setExamSettings] = useState({
    title: 'Untitled Exam',
    instructions: '',
    duration_minutes: 30,
    pass_mark_percent: 60,
    randomise_questions: false,
    randomise_options: false,
    max_attempts: 1,
    show_score_immediately: true,
    show_answers_after: 'after_close',
    paged_mode: false,
    notify_on_open: true,
    reminder_hours: 0,
  });

  // Load session plan and exam
  useEffect(() => {
    if (!sessionId) return;
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    if (!sessionId) return;

    // Load session plan
    const { data: sp } = await supabase
      .from('session_plans')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sp) {
      setSessionPlan(sp as any);

      // Load syllabus for course name
      const { data: syl } = await supabase
        .from('syllabi')
        .select('course_name')
        .eq('id', sp.syllabus_id)
        .single();
      if (syl) setCourseName(syl.course_name);

      // Load or create exam
      const { data: existingExam } = await supabase
        .from('teaching_exams' as any)
        .select('*')
        .eq('session_plan_id', sessionId)
        .maybeSingle();

      if (existingExam) {
        setExam(existingExam as any);
        setExamSettings({
          title: (existingExam as any).title || 'Untitled Exam',
          instructions: (existingExam as any).instructions || '',
          duration_minutes: (existingExam as any).duration_minutes || 30,
          pass_mark_percent: (existingExam as any).pass_mark_percent || 60,
          ...(typeof (existingExam as any).settings === 'object' ? (existingExam as any).settings : {}),
          notify_on_open: true,
          reminder_hours: 0,
        });
        loadQuestions((existingExam as any).id);
        loadSubmissions((existingExam as any).id);
        loadInsights((existingExam as any).id);
      } else {
        // Create new exam
        const { data: newExam } = await supabase
          .from('teaching_exams' as any)
          .insert({
            session_plan_id: sessionId,
            title: `Session ${sp.session_number} Assessment`,
            status: 'draft',
          } as any)
          .select()
          .single();
        if (newExam) {
          setExam(newExam as any);
          setExamSettings(prev => ({ ...prev, title: (newExam as any).title }));
        }
      }
    }
  };

  const loadQuestions = async (examId: string) => {
    const { data } = await supabase
      .from('teaching_exam_questions' as any)
      .select('*')
      .eq('exam_id', examId)
      .order('question_index');
    if (data) setQuestions(data as any);
  };

  const loadSubmissions = async (examId: string) => {
    const { data } = await supabase
      .from('teaching_exam_submissions' as any)
      .select('*')
      .eq('exam_id', examId);
    if (data) setSubmissions(data as any);
  };

  const loadInsights = async (examId: string) => {
    const { data } = await supabase
      .from('assessment_insights' as any)
      .select('*')
      .eq('exam_id', examId)
      .eq('dismissed', false);
    if (data) setInsights((data as any).map((d: any) => ({
      ...d,
      suggested_actions: Array.isArray(d.suggested_actions) ? d.suggested_actions : [],
    })));
  };

  // Save question to DB
  const saveQuestion = async (q: ExamQuestion) => {
    await supabase.from('teaching_exam_questions' as any).upsert(q as any);
    if (exam) {
      const totalMarks = questions.reduce((s, x) => s + x.points, 0);
      await supabase.from('teaching_exams' as any).update({ total_marks: totalMarks } as any).eq('id', exam.id);
    }
  };

  // Delete question
  const deleteQuestion = async (id: string) => {
    await supabase.from('teaching_exam_questions' as any).delete().eq('id', id);
    setQuestions(prev => prev.filter(q => q.id !== id));
    toast.success('Question deleted');
  };

  // Duplicate question
  const duplicateQuestion = async (q: ExamQuestion) => {
    const newQ = {
      exam_id: q.exam_id,
      question_index: questions.length,
      type: q.type,
      question_text: q.question_text + ' (copy)',
      options: q.options,
      correct_answer: q.correct_answer,
      model_answer: q.model_answer,
      scenario_context: q.scenario_context,
      blank_sentence: q.blank_sentence,
      rubric: q.rubric,
      points: q.points,
      difficulty: q.difficulty,
      blooms_level: q.blooms_level,
      auto_mark: q.auto_mark,
    };
    const { data } = await supabase.from('teaching_exam_questions' as any).insert(newQ as any).select().single();
    if (data) {
      setQuestions(prev => [...prev, data as any]);
      toast.success('Question duplicated');
    }
  };

  // AI Generate questions
  const generateQuestions = async (count = 5) => {
    if (!exam || !sessionPlan) return;
    setIsGenerating(true);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content-kit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            contentType: 'quiz',
            sessionPlan: sessionPlan,
            courseName,
            subject: 'Arabic',
            level: 'Beginner',
            questionCount: count,
            questionTypes: ['mcq', 'short_answer', 'true_false', 'fill_blank', 'translation'],
            difficulty: 'mixed',
            language: localStorage.getItem('tos-language') || 'en',
          }),
        }
      );

      const json = await response.json().catch(() => ({ error: 'Invalid response' }));
      if (!response.ok) throw new Error(json.error || 'Generation failed');

      const generated = json.data;
      if (!Array.isArray(generated)) throw new Error('AI did not return questions array');

      const newQuestions: any[] = [];
      for (const g of generated) {
        const q = {
          exam_id: exam.id,
          question_index: questions.length + newQuestions.length,
          type: g.type || 'mcq',
          question_text: g.question || g.questionText || g.question_text || '',
          options: g.options || null,
          correct_answer: g.correctAnswer || g.correct_answer || null,
          model_answer: g.modelAnswer || g.model_answer || null,
          scenario_context: g.scenarioContext || g.scenario_context || null,
          blank_sentence: g.blankSentence || g.blank_sentence || null,
          rubric: g.rubric || null,
          points: g.points || 2,
          difficulty: g.difficulty || 'medium',
          blooms_level: g.bloomsLevel || g.blooms_level || 'remember',
          auto_mark: ['mcq', 'true_false', 'fill_blank'].includes(g.type || 'mcq'),
        };
        const { data } = await supabase.from('teaching_exam_questions' as any).insert(q as any).select().single();
        if (data) newQuestions.push(data);
      }
      setQuestions(prev => [...prev, ...newQuestions as any]);
      const totalMarks = [...questions, ...newQuestions].reduce((s: number, x: any) => s + (x.points || 0), 0);
      await supabase.from('teaching_exams' as any).update({ total_marks: totalMarks } as any).eq('id', exam.id);
      toast.success(`Generated ${newQuestions.length} questions`);
    } catch (err) {
      console.error('Question generation failed:', err);
      toast.error('AI generation failed — please try again');
    } finally {
      setIsGenerating(false);
    }
  };

  const getMockQuestion = (type: string, i: number): string => {
    const qs: Record<string, string[]> = {
      mcq: ['What does اسمي mean?', 'Which greeting is used in the morning?', 'What is the Arabic word for "student"?'],
      short_answer: ['Write a short self-introduction in Arabic using اسمي and من أين أنت. Include at least your name and country.', 'Describe your daily routine in 3 Arabic sentences.'],
      true_false: ['"مرحبا" is a formal Arabic greeting. True or False?', '"شكرا" means "please" in Arabic. True or False?'],
      fill_blank: ['Complete: أنا ___ باكستان (I am from Pakistan)', 'Complete: ___ اسمي أحمد (My name is Ahmad)'],
      translation: ['Translate to Arabic: "My name is Ahmad and I am from Egypt"', 'Translate to English: "أنا طالب في المدرسة الإسلامية"'],
      scenario: ['You meet a new student who only speaks Arabic. Introduce yourself and ask about them.'],
    };
    const list = qs[type] || qs.mcq;
    return list[i % list.length];
  };

  // Save settings
  const saveSettings = async () => {
    if (!exam) return;
    const { title, instructions, duration_minutes, pass_mark_percent, ...rest } = examSettings;
    await supabase.from('teaching_exams' as any).update({
      title,
      instructions,
      duration_minutes,
      pass_mark_percent,
      settings: rest,
    } as any).eq('id', exam.id);
    toast.success('Settings saved');
  };

  // Publish / Unpublish exam
  const publishExam = async () => {
    if (!exam) return;
    if (questions.length === 0) {
      toast.error('Add at least one question before publishing');
      return;
    }
    await supabase.from('teaching_exams' as any).update({
      status: 'published',
      published_at: new Date().toISOString(),
    } as any).eq('id', exam.id);
    setExam(prev => prev ? { ...prev, status: 'published' } : null);
    toast.success('Exam published to students');
  };

  const unpublishExam = async () => {
    if (!exam) return;
    await supabase.from('teaching_exams' as any).update({
      status: 'draft',
      published_at: null,
    } as any).eq('id', exam.id);
    setExam(prev => prev ? { ...prev, status: 'draft' } : null);
    toast.success('Exam unpublished — back to draft');
  };

  const togglePublish = () => {
    if (exam?.status === 'published') {
      unpublishExam();
    } else {
      publishExam();
    }
  };

  // Generate mock results for demo
  const generateMockResults = async () => {
    if (!exam || questions.length === 0) return;
    const students = ['Aisha Khan', 'Omar Hassan', 'Fatima Ali', 'Yusuf Ahmed', 'Maryam Siddiq'];
    const newSubmissions: any[] = [];

    for (const name of students) {
      const totalPossible = questions.reduce((s, q) => s + q.points, 0);
      const score = Math.floor(totalPossible * (0.4 + Math.random() * 0.55));
      const pct = Math.round((score / totalPossible) * 100);
      const sub = {
        exam_id: exam.id,
        student_id: crypto.randomUUID(),
        status: 'marked',
        total_score: score,
        total_possible: totalPossible,
        percentage: pct,
        passed: pct >= (exam.pass_mark_percent || 60),
        time_taken_minutes: Math.floor(15 + Math.random() * 30),
        submitted_at: new Date().toISOString(),
      };
      const { data } = await supabase.from('teaching_exam_submissions' as any).insert(sub as any).select().single();
      if (data) newSubmissions.push({ ...(data as any), studentName: name });
    }
    setSubmissions(newSubmissions as any);
    toast.success('Mock results generated');
  };

  // Generate insights
  const generateInsights = async () => {
    if (!exam) return;
    const mockInsights = [
      {
        exam_id: exam.id,
        type: 'weakness',
        title: 'Self-introduction vocabulary gaps',
        description: '60% of students struggled with personal pronouns and possessive forms in Arabic self-introductions.',
        affected_students: 3,
        affected_percent: 60,
        suggested_actions: JSON.stringify(['Review أنا/اسمي forms next session', 'Add pronoun drill to warm-up', 'Create matching exercise for pronouns']),
      },
      {
        exam_id: exam.id,
        type: 'strength',
        title: 'Greeting formulas well mastered',
        description: '90% of students correctly used مرحبا and السلام عليكم in context.',
        affected_students: 4,
        affected_percent: 90,
        suggested_actions: JSON.stringify(['Advance to formal vs informal greetings', 'Introduce regional greeting variations']),
      },
      {
        exam_id: exam.id,
        type: 'recommendation',
        title: 'Increase scenario-based practice',
        description: 'Students performed best on recall (MCQ) but struggled with application (scenarios). Shift focus to real-world dialogues.',
        affected_students: 5,
        affected_percent: 100,
        suggested_actions: JSON.stringify(['Add role-play activity to next session', 'Create dialogue completion exercises', 'Use AI to generate conversation scenarios']),
      },
      {
        exam_id: exam.id,
        type: 'pattern',
        title: 'Common spelling errors in من أين',
        description: '40% of students misspelled "من أين أنت" in fill-in-the-blank questions.',
        affected_students: 2,
        affected_percent: 40,
        suggested_actions: JSON.stringify(['Add spelling drill for interrogative phrases', 'Practice dictation exercise']),
      },
    ];

    const inserted: any[] = [];
    for (const ins of mockInsights) {
      const { data } = await supabase.from('assessment_insights' as any).insert(ins as any).select().single();
      if (data) inserted.push({
        ...(data as any),
        suggested_actions: typeof (data as any).suggested_actions === 'string'
          ? JSON.parse((data as any).suggested_actions)
          : (data as any).suggested_actions || [],
      });
    }
    setInsights(inserted as any);
    toast.success('AI insights generated');
  };

  const totalMarks = questions.reduce((s, q) => s + q.points, 0);
  const submittedCount = submissions.filter(s => s.status === 'submitted' || s.status === 'marked').length;
  const avgPct = submissions.length > 0 ? Math.round(submissions.reduce((s, x) => s + (x.percentage || 0), 0) / submissions.length) : 0;
  const topScore = submissions.length > 0 ? Math.max(...submissions.map(s => s.percentage || 0)) : 0;
  const pendingReview = submissions.filter(s => s.status !== 'marked').length;

  // Question breakdown for results
  const getQuestionStats = () => questions.map((q, i) => {
    const correctPct = Math.floor(40 + Math.random() * 55);
    return { index: i + 1, type: q.type, correctPct, points: q.points };
  });

  const { activeRole } = useAuth();
  const railItems = buildRailNav(activeRole);

  return (
    <div className="flex h-screen bg-[#f4f5f7] overflow-hidden pl-14">
      <NavRail items={railItems} />

      {/* Section Sidebar */}
      <div className="w-[210px] bg-white border-r border-[#e8e9eb] flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-[14px] pb-[10px] border-b border-[#e8e9eb]">
          <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Assessment engine</div>
          <div className="text-[11px] mt-[2px]" style={{ color: '#7a7f8a' }}>
            {courseName || 'Course'} · Session {sessionPlan?.session_number || '—'}
          </div>
        </div>

        {/* Phase stepper */}
        <PhaseStepperCompact currentPhase={5} sessionId={searchParams.get('session_id')} syllabusId={sessionPlan?.syllabus_id} courseId={searchParams.get('course_id')} />

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#aab0bc' }}>Build</div>
          <NavItem icon={FileText} label="Exam builder" active={activeSection === 'builder'} onClick={() => setActiveSection('builder')} badge={questions.length > 0 ? `${questions.length} q` : undefined} badgeColor="#1a56b0" />
          <NavItem icon={Settings} label="Exam settings" active={activeSection === 'settings'} onClick={() => setActiveSection('settings')} />

          <div className="px-4 py-1 mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#aab0bc' }}>Review</div>
          <NavItem icon={BarChart3} label="Results" active={activeSection === 'results'} onClick={() => setActiveSection('results')} badge={submittedCount > 0 ? `${submittedCount} done` : undefined} badgeColor="#1a7340" />
          <NavItem icon={Bot} label="AI marking" active={activeSection === 'marking'} onClick={() => setActiveSection('marking')} badge={pendingReview > 0 ? `${pendingReview} pending` : undefined} badgeColor="#8a5c00" />
          <NavItem icon={Star} label="AI insights" active={activeSection === 'insights'} onClick={() => setActiveSection('insights')} />

          <div className="px-4 py-1 mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#aab0bc' }}>History</div>
          <NavItem icon={Clock} label="Past exams" active={activeSection === 'past'} onClick={() => setActiveSection('past')} />
          <NavItem icon={TrendingUp} label="Student progress" active={activeSection === 'progress'} onClick={() => setActiveSection('progress')} />
        </div>

        {/* Footer */}
        <div className="p-[10px] border-t border-[#e8e9eb]">
          <Button
            onClick={togglePublish}
            className="w-full text-[12px] h-8"
            style={{ backgroundColor: exam?.status === 'published' ? '#1a7340' : '#0f2044', color: '#fff' }}
          >
            {exam?.status === 'published' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            {exam?.status === 'published' ? 'Published ✓ (tap to unpublish)' : 'Publish to students'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white border-b border-[#e8e9eb] flex items-center justify-between px-4 flex-shrink-0">
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>
            Teaching OS › <span style={{ color: '#4a5264' }}>{courseName}</span> › Session {sessionPlan?.session_number || '—'} ›{' '}
            <span style={{ color: '#4a5264' }}>{activeSection === 'builder' ? 'Exam builder' : activeSection === 'settings' ? 'Exam settings' : activeSection === 'results' ? 'Results' : activeSection === 'marking' ? 'AI marking' : activeSection === 'insights' ? 'AI insights' : activeSection === 'past' ? 'Past exams' : 'Student progress'}</span>
          </div>
          <div className="flex items-center gap-2">
            {activeSection === 'builder' && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => generateQuestions(5)} disabled={isGenerating}>
                  <Sparkles className="w-3 h-3 mr-1" />{isGenerating ? 'Generating…' : 'AI generate'}
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7">
                  <Download className="w-3 h-3 mr-1" />Export PDF
                </Button>
                <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: exam?.status === 'published' ? '#b85c1a' : '#1a7340', color: '#fff' }} onClick={togglePublish}>
                  <Send className="w-3 h-3 mr-1" />{exam?.status === 'published' ? 'Unpublish' : 'Publish exam'}
                </Button>
              </>
            )}
            {activeSection === 'results' && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={generateMockResults}>
                  <Sparkles className="w-3 h-3 mr-1" />Generate mock results
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7">
                  <Download className="w-3 h-3 mr-1" />Export CSV
                </Button>
              </>
            )}
            {activeSection === 'insights' && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={generateInsights}>
                  <Sparkles className="w-3 h-3 mr-1" />Generate insights
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7">
                  <ArrowRight className="w-3 h-3 mr-1" />Apply to next session
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Center + Right panel */}
        <div className="flex flex-1 min-h-0">
          {/* Center panel */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'builder' && <ExamBuilderSection
              questions={questions}
              setQuestions={setQuestions}
              builderView={builderView}
              setBuilderView={setBuilderView}
              editingQuestionId={editingQuestionId}
              setEditingQuestionId={setEditingQuestionId}
              deleteQuestion={deleteQuestion}
              duplicateQuestion={duplicateQuestion}
              saveQuestion={saveQuestion}
              exam={exam}
              isGenerating={isGenerating}
              generateQuestions={generateQuestions}
            />}
            {activeSection === 'settings' && <ExamSettingsSection settings={examSettings} setSettings={setExamSettings} onSave={saveSettings} />}
            {activeSection === 'results' && <ResultsSection submissions={submissions} questions={questions} totalMarks={totalMarks} avgPct={avgPct} topScore={topScore} submittedCount={submittedCount} pendingReview={pendingReview} getQuestionStats={getQuestionStats} />}
            {activeSection === 'marking' && <MarkingSection questions={questions} />}
            {activeSection === 'insights' && <InsightsSection insights={insights} />}
            {activeSection === 'past' && <PastExamsSection />}
            {activeSection === 'progress' && <StudentProgressSection />}
          </div>

          {/* Right panel - Question map */}
          <div className="w-[240px] bg-white border-l border-[#e8e9eb] flex-shrink-0 overflow-y-auto">
            <RightPanel activeSection={activeSection} questions={questions} submissions={submissions} insights={insights} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Nav Item ─────────────────────────────────────────────
const NavItem: React.FC<{
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
}> = ({ icon: Icon, label, active, onClick, badge, badgeColor }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2 px-4 py-[7px] text-left transition-colors"
    style={{
      borderLeft: `3px solid ${active ? '#1a56b0' : 'transparent'}`,
      backgroundColor: active ? '#eef2fa' : 'transparent',
      color: active ? '#0f2044' : '#4a5264',
      fontWeight: active ? 500 : 400,
      fontSize: '12px',
    }}
  >
    <Icon className="w-[14px] h-[14px]" style={{ color: active ? '#1a56b0' : '#7a7f8a' }} />
    <span className="flex-1">{label}</span>
    {badge && (
      <span className="text-[10px] px-[6px] py-[1px] rounded-[8px]" style={{ backgroundColor: badgeColor ? `${badgeColor}18` : '#eef2fa', color: badgeColor || '#1a56b0' }}>{badge}</span>
    )}
  </button>
);

// ─── Exam Builder Section ─────────────────────────────────
const ExamBuilderSection: React.FC<{
  questions: ExamQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<ExamQuestion[]>>;
  builderView: string;
  setBuilderView: (v: any) => void;
  editingQuestionId: string | null;
  setEditingQuestionId: (id: string | null) => void;
  deleteQuestion: (id: string) => void;
  duplicateQuestion: (q: ExamQuestion) => void;
  saveQuestion: (q: ExamQuestion) => void;
  exam: Exam | null;
  isGenerating: boolean;
  generateQuestions: (n: number) => void;
}> = ({ questions, builderView, setBuilderView, editingQuestionId, setEditingQuestionId, deleteQuestion, duplicateQuestion, saveQuestion, exam, isGenerating, generateQuestions }) => (
  <div>
    {/* View switcher */}
    <div className="flex gap-1 mb-3">
      {(['builder', 'preview', 'student'] as const).map(v => (
        <button key={v} onClick={() => setBuilderView(v)}
          className="text-[11px] px-3 py-[5px] rounded-[7px] font-medium capitalize transition-colors"
          style={{
            backgroundColor: builderView === v ? '#0f2044' : '#fff',
            color: builderView === v ? '#fff' : '#4a5264',
            border: `0.5px solid ${builderView === v ? '#0f2044' : '#e8e9eb'}`,
          }}>
          {v === 'student' ? 'Student view' : v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>

    {questions.length === 0 ? (
      <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
        <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: '#aab0bc' }} />
        <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>No questions yet</div>
        <div className="text-[11px] mb-4" style={{ color: '#7a7f8a' }}>Generate questions from your session plan or add them manually.</div>
        <Button onClick={() => generateQuestions(8)} disabled={isGenerating} className="text-[12px]" style={{ backgroundColor: '#0f2044', color: '#fff' }}>
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />{isGenerating ? 'Generating…' : 'AI Generate exam questions'}
        </Button>
      </div>
    ) : (
      <div className="space-y-2">
        {questions.map((q, i) => (
          <QuestionCard key={q.id} question={q} index={i} isEditing={editingQuestionId === q.id} onEdit={() => setEditingQuestionId(q.id)} onCancelEdit={() => setEditingQuestionId(null)} onDelete={() => deleteQuestion(q.id)} onDuplicate={() => duplicateQuestion(q)} onSave={saveQuestion} isPreview={builderView === 'preview'} isStudent={builderView === 'student'} />
        ))}
      </div>
    )}
  </div>
);

// ─── Question Card ────────────────────────────────────────
const QuestionCard: React.FC<{
  question: ExamQuestion;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSave: (q: ExamQuestion) => void;
  isPreview: boolean;
  isStudent: boolean;
}> = ({ question, index, isEditing, onEdit, onCancelEdit, onDelete, onDuplicate, onSave, isPreview, isStudent }) => {
  const tc = TYPE_COLORS[question.type] || TYPE_COLORS.mcq;
  const [editState, setEditState] = useState({ ...question });
  const [aiImproving, setAiImproving] = useState(false);

  useEffect(() => { setEditState({ ...question }); }, [question, isEditing]);

  const handleAiImprove = async () => {
    setAiImproving(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const lang = localStorage.getItem('tos-language') || 'en';
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-teaching-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          assistType: 'improve_question',
          language: lang,
          context: JSON.stringify(question),
        }),
      });
      const json = await resp.json().catch(() => null);
      if (json?.data) {
        const improved = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
        const updated: ExamQuestion = {
          ...question,
          question_text: improved.question || improved.question_text || question.question_text,
          options: improved.options || question.options,
          correct_answer: improved.correctAnswer || improved.correct_answer || question.correct_answer,
          model_answer: improved.modelAnswer || improved.model_answer || question.model_answer,
          scenario_context: improved.scenarioContext || improved.scenario_context || question.scenario_context,
          blank_sentence: improved.blankSentence || improved.blank_sentence || question.blank_sentence,
        };
        onSave(updated);
        toast.success('Question improved by AI');
      } else {
        toast.error('AI could not improve this question');
      }
    } catch (err) {
      toast.error('AI improve failed');
    } finally {
      setAiImproving(false);
    }
  };

  // ─── Inline Edit Form ──────────────────────────────
  if (isEditing) {
    return (
      <div className="bg-white border-2 rounded-[10px] overflow-hidden" style={{ borderColor: '#4a90d9' }}>
        <div className="px-4 py-3 border-b bg-[#f0f4ff]" style={{ borderColor: '#b5d0f8' }}>
          <div className="text-[12px] font-medium" style={{ color: '#1a56b0' }}>Editing Q{index + 1} · {tc.label}</div>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <Label className="text-[11px]">Question text</Label>
            <Textarea value={editState.question_text} onChange={e => setEditState(s => ({ ...s, question_text: e.target.value }))} className="mt-1 text-[12px]" rows={2} />
          </div>

          {editState.type === 'mcq' && editState.options && (
            <div>
              <Label className="text-[11px]">Options (one per line, mark correct with ✓ prefix)</Label>
              {(editState.options as string[]).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2 mt-1">
                  <input type="radio" name={`correct-${editState.id}`} checked={opt === editState.correct_answer}
                    onChange={() => setEditState(s => ({ ...s, correct_answer: opt }))} />
                  <Input value={opt} className="text-[12px] h-7 flex-1"
                    onChange={e => {
                      const newOpts = [...(editState.options as string[])];
                      const wasCorrect = newOpts[oi] === editState.correct_answer;
                      newOpts[oi] = e.target.value;
                      setEditState(s => ({ ...s, options: newOpts, correct_answer: wasCorrect ? e.target.value : s.correct_answer }));
                    }} />
                </div>
              ))}
            </div>
          )}

          {editState.type === 'true_false' && (
            <div>
              <Label className="text-[11px]">Correct answer</Label>
              <Select value={editState.correct_answer || 'True'} onValueChange={v => setEditState(s => ({ ...s, correct_answer: v }))}>
                <SelectTrigger className="mt-1 h-7 text-[12px] w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="True">True</SelectItem>
                  <SelectItem value="False">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {['short_answer', 'translation'].includes(editState.type) && (
            <div>
              <Label className="text-[11px]">Model answer (for AI marking)</Label>
              <Textarea value={editState.model_answer || ''} onChange={e => setEditState(s => ({ ...s, model_answer: e.target.value }))} className="mt-1 text-[12px]" rows={2} />
            </div>
          )}

          {editState.type === 'fill_blank' && (
            <div>
              <Label className="text-[11px]">Blank sentence (use ___ for blank)</Label>
              <Input value={editState.blank_sentence || ''} onChange={e => setEditState(s => ({ ...s, blank_sentence: e.target.value }))} className="mt-1 text-[12px] h-7" />
              <Label className="text-[11px] mt-2 block">Correct answer</Label>
              <Input value={editState.correct_answer || ''} onChange={e => setEditState(s => ({ ...s, correct_answer: e.target.value }))} className="mt-1 text-[12px] h-7" />
            </div>
          )}

          {editState.type === 'scenario' && (
            <>
              <div>
                <Label className="text-[11px]">Scenario context</Label>
                <Textarea value={editState.scenario_context || ''} onChange={e => setEditState(s => ({ ...s, scenario_context: e.target.value }))} className="mt-1 text-[12px]" rows={2} />
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px]">Points</Label>
              <Input type="number" value={editState.points} onChange={e => setEditState(s => ({ ...s, points: parseInt(e.target.value) || 1 }))} className="mt-1 text-[12px] h-7" />
            </div>
            <div>
              <Label className="text-[11px]">Difficulty</Label>
              <Select value={editState.difficulty} onValueChange={v => setEditState(s => ({ ...s, difficulty: v }))}>
                <SelectTrigger className="mt-1 h-7 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Bloom's level</Label>
              <Select value={editState.blooms_level} onValueChange={v => setEditState(s => ({ ...s, blooms_level: v }))}>
                <SelectTrigger className="mt-1 h-7 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remember">Remember</SelectItem>
                  <SelectItem value="understand">Understand</SelectItem>
                  <SelectItem value="apply">Apply</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t bg-[#fafbfc]" style={{ borderColor: '#e8e9eb' }}>
          <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={onCancelEdit}>Cancel</Button>
          <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#0f2044' }}
            onClick={() => { onSave(editState); onCancelEdit(); }}>
            <Check className="w-3 h-3 mr-1" /> Save changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-[10px] overflow-hidden group" style={{ borderColor: '#e8e9eb', borderWidth: '0.5px' }}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-[13px] py-[10px] border-b" style={{ borderColor: '#f0f1f3' }}>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-3.5 h-3.5 text-[#aab0bc]" />
        </div>
        <span className="text-[10px] font-medium px-2 py-[2px] rounded-[6px]" style={{ backgroundColor: tc.bg, color: tc.text }}>
          {tc.label} · {question.points} pts
        </span>
        <span className="flex-1 text-[12.5px] font-medium truncate" style={{ color: '#0f2044' }}>
          {question.question_text.slice(0, 60)}{question.question_text.length > 60 ? '…' : ''}
        </span>
        <span className="text-[11px]" style={{ color: '#aab0bc' }}>Q{index + 1}</span>
      </div>

      {/* Card body */}
      <div className="px-[13px] py-[11px]">
        <div className="text-[13px] font-medium mb-2" style={{ color: '#0f2044', lineHeight: 1.5, direction: question.question_text.match(/[\u0600-\u06FF]/) ? 'rtl' : 'ltr' }}>
          {question.question_text}
        </div>

        {/* MCQ options */}
        {question.type === 'mcq' && question.options && (
          <div className="space-y-[5px]">
            {(question.options as string[]).map((opt, oi) => {
              const isCorrect = opt === question.correct_answer;
              const letter = String.fromCharCode(65 + oi);
              return (
                <div key={oi} className="flex items-center gap-2 px-[9px] py-[6px] rounded-[7px] text-[12px] transition-colors" style={{
                  border: `0.5px solid ${isCorrect && !isStudent ? '#86c7a0' : '#e8e9eb'}`,
                  backgroundColor: isCorrect && !isStudent ? '#e6f4ea' : 'transparent',
                  color: isCorrect && !isStudent ? '#1a7340' : '#4a5264',
                  fontWeight: isCorrect && !isStudent ? 500 : 400,
                }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: '#f4f5f7' }}>{letter}</div>
                  {isCorrect && !isStudent && <Check className="w-3 h-3 text-[#1a7340] flex-shrink-0" />}
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* True/False */}
        {question.type === 'true_false' && (
          <div className="flex gap-2">
            {['True', 'False'].map(opt => (
              <div key={opt} className="flex items-center gap-2 px-3 py-[6px] rounded-[7px] text-[12px]" style={{
                border: `0.5px solid ${opt === question.correct_answer && !isStudent ? '#86c7a0' : '#e8e9eb'}`,
                backgroundColor: opt === question.correct_answer && !isStudent ? '#e6f4ea' : 'transparent',
                color: opt === question.correct_answer && !isStudent ? '#1a7340' : '#4a5264',
              }}>
                {opt}
              </div>
            ))}
          </div>
        )}

        {/* Short answer */}
        {question.type === 'short_answer' && (
          <div>
            <div className="bg-[#fafbfc] border border-[#e8e9eb] rounded-[7px] p-[9px] text-[12px] text-[#aab0bc] mb-2">Student writes answer here…</div>
            {question.model_answer && !isStudent && (
              <div className="border-l-[3px] border-[#d0d4dc] rounded-r-[6px] bg-[#f9f9fb] px-[9px] py-[7px]">
                <div className="text-[10px] font-medium mb-1" style={{ color: '#7a7f8a' }}>Model answer (AI marking guide)</div>
                <div className="text-[11px]" style={{ color: '#7a7f8a', direction: 'rtl' }}>{question.model_answer}</div>
              </div>
            )}
          </div>
        )}

        {/* Scenario */}
        {question.type === 'scenario' && (
          <div>
            {question.scenario_context && (
              <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[8px] p-[9px] mb-2">
                <div className="text-[10px] font-medium uppercase mb-1" style={{ color: '#1a56b0' }}>Scenario context</div>
                <div className="text-[12px]" style={{ color: '#0f2044', lineHeight: 1.5 }}>{question.scenario_context}</div>
              </div>
            )}
            <div className="bg-[#fafbfc] border border-[#e8e9eb] rounded-[7px] p-[9px] text-[12px] text-[#aab0bc]">Student writes answer here…</div>
            {question.rubric && !isStudent && (
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-medium uppercase" style={{ color: '#7a7f8a' }}>Marking rubric</div>
                {(question.rubric as any[]).map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2 text-[11px]" style={{ color: '#4a5264' }}>
                    <span className="text-[10px] font-medium px-[5px] py-[1px] rounded bg-[#eef2fa]" style={{ color: '#1a56b0' }}>{r.points}pt</span>
                    {r.criterion}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fill blank */}
        {question.type === 'fill_blank' && question.blank_sentence && (
          <div className="text-[13px] p-3 bg-[#fafbfc] rounded-[7px]" style={{ color: '#0f2044', direction: 'rtl' }}>
            {question.blank_sentence.replace(/___/g, '________')}
          </div>
        )}

        {/* Translation */}
        {question.type === 'translation' && (
          <div className="bg-[#fafbfc] border border-[#e8e9eb] rounded-[7px] p-[9px] text-[12px] text-[#aab0bc]">Student writes translation here…</div>
        )}
      </div>

      {/* Card footer */}
      {!isStudent && (
        <div className="flex items-center justify-between px-[13px] py-[8px] border-t bg-[#fafbfc]" style={{ borderColor: '#f0f1f3' }}>
          <div className="flex items-center gap-1">
            <button onClick={handleAiImprove} disabled={aiImproving}
              className="text-[10px] px-2 py-[3px] rounded border flex items-center gap-1 hover:bg-[#f0f4ff] transition-colors disabled:opacity-50"
              style={{ borderColor: '#e8e9eb', color: '#1a56b0' }}>
              {aiImproving ? <span className="w-3 h-3 border border-[#1a56b0] border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {aiImproving ? 'Improving…' : 'AI improve'}
            </button>
            <button onClick={onEdit} className="text-[10px] px-2 py-[3px] rounded border flex items-center gap-1 hover:bg-[#f9f9fb] transition-colors" style={{ borderColor: '#e8e9eb', color: '#4a5264' }}>
              <Edit2 className="w-3 h-3" />Edit
            </button>
            <button onClick={onDuplicate} className="text-[10px] px-2 py-[3px] rounded border flex items-center gap-1 hover:bg-[#f9f9fb] transition-colors" style={{ borderColor: '#e8e9eb', color: '#4a5264' }}>
              <Copy className="w-3 h-3" />Duplicate
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: '#aab0bc' }}>{question.points} pts · {question.auto_mark ? 'Auto-marked' : 'AI-marked'}</span>
            <button onClick={onDelete} className="text-[10px] p-1 rounded hover:bg-red-50 transition-colors" style={{ color: '#b42a2a' }}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Exam Settings Section ────────────────────────────────
const ExamSettingsSection: React.FC<{
  settings: any;
  setSettings: (fn: (s: any) => any) => void;
  onSave: () => void;
}> = ({ settings, setSettings, onSave }) => {
  const update = (key: string, value: any) => setSettings((s: any) => ({ ...s, [key]: value }));

  return (
    <div className="max-w-[580px] space-y-4">
      <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4 space-y-4">
        <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>General settings</div>
        <div className="space-y-3">
          <div>
            <Label className="text-[11px]">Exam title</Label>
            <Input value={settings.title} onChange={e => update('title', e.target.value)} className="mt-1 text-[12px] h-8" />
          </div>
          <div>
            <Label className="text-[11px]">Instructions for students</Label>
            <Textarea value={settings.instructions} onChange={e => update('instructions', e.target.value)} className="mt-1 text-[12px]" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]">Duration</Label>
              <Select value={String(settings.duration_minutes)} onValueChange={v => update('duration_minutes', parseInt(v))}>
                <SelectTrigger className="mt-1 h-8 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90, 0].map(m => (
                    <SelectItem key={m} value={String(m)} className="text-[12px]">{m === 0 ? 'Untimed' : `${m} minutes`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Pass mark (%)</Label>
              <Input type="number" value={settings.pass_mark_percent} onChange={e => update('pass_mark_percent', parseInt(e.target.value))} className="mt-1 text-[12px] h-8" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4 space-y-3">
        <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Question settings</div>
        <ToggleRow label="Randomise question order" checked={settings.randomise_questions} onChange={v => update('randomise_questions', v)} />
        <ToggleRow label="Randomise MCQ option order" checked={settings.randomise_options} onChange={v => update('randomise_options', v)} />
        <ToggleRow label="One question at a time (paged)" checked={settings.paged_mode} onChange={v => update('paged_mode', v)} />
        <ToggleRow label="Show score immediately after submit" checked={settings.show_score_immediately} onChange={v => update('show_score_immediately', v)} />
        <div>
          <Label className="text-[11px]">Show correct answers after</Label>
          <Select value={settings.show_answers_after} onValueChange={v => update('show_answers_after', v)}>
            <SelectTrigger className="mt-1 h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="never" className="text-[12px]">Never</SelectItem>
              <SelectItem value="after_close" className="text-[12px]">After exam closes</SelectItem>
              <SelectItem value="immediately" className="text-[12px]">Immediately</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Max attempts</Label>
          <Select value={String(settings.max_attempts)} onValueChange={v => update('max_attempts', parseInt(v))}>
            <SelectTrigger className="mt-1 h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 0].map(a => (
                <SelectItem key={a} value={String(a)} className="text-[12px]">{a === 0 ? 'Unlimited' : a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={onSave} className="text-[12px]" style={{ backgroundColor: '#0f2044', color: '#fff' }}>Save settings</Button>
    </div>
  );
};

const ToggleRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <Label className="text-[12px] font-normal" style={{ color: '#4a5264' }}>{label}</Label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

// ─── Results Section ──────────────────────────────────────
const ResultsSection: React.FC<{
  submissions: Submission[];
  questions: ExamQuestion[];
  totalMarks: number;
  avgPct: number;
  topScore: number;
  submittedCount: number;
  pendingReview: number;
  getQuestionStats: () => any[];
}> = ({ submissions, questions, totalMarks, avgPct, topScore, submittedCount, pendingReview, getQuestionStats }) => {
  const stats = getQuestionStats();
  const mockNames = ['Aisha Khan', 'Omar Hassan', 'Fatima Ali', 'Yusuf Ahmed', 'Maryam Siddiq'];

  const getGrade = (pct: number) => {
    if (pct >= 80) return { label: 'Excellent', color: '#1a7340', bg: '#e6f4ea' };
    if (pct >= 60) return { label: 'Good', color: '#8a5c00', bg: '#fff8e6' };
    if (pct >= 50) return { label: 'Needs work', color: '#8a5c00', bg: '#fff8e6' };
    return { label: 'At risk', color: '#b42a2a', bg: '#fde8e8' };
  };

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Submitted', value: submittedCount, color: '#1a56b0' },
          { label: 'Class average', value: `${avgPct}%`, color: avgPct >= 60 ? '#1a7340' : '#b42a2a' },
          { label: 'Top score', value: `${topScore}%`, color: '#1a7340' },
          { label: 'Pending review', value: pendingReview, color: '#8a5c00' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-[#e8e9eb] rounded-[10px] p-3">
            <div className="text-[20px] font-medium" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: '#7a7f8a' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 text-[#aab0bc]" />
          <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>No submissions yet</div>
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>Results will appear here once students submit their exams.</div>
        </div>
      ) : (
        <>
          {/* Results table */}
          <div className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#f0f1f3] bg-[#fafbfc]">
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>Student</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>Score</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>%</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>Grade</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>Time</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, i) => {
                  const grade = getGrade(sub.percentage);
                  const name = mockNames[i % mockNames.length];
                  const initials = name.split(' ').map(n => n[0]).join('');
                  return (
                    <tr key={sub.id} className="border-b border-[#f0f1f3] hover:bg-[#f9f9fb] transition-colors cursor-pointer">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-medium bg-[#eef2fa] text-[#1a56b0]">{initials}</div>
                          <span style={{ color: '#0f2044' }}>{name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2" style={{ color: '#4a5264' }}>{sub.total_score}/{sub.total_possible}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: sub.percentage >= 80 ? '#1a7340' : sub.percentage >= 60 ? '#8a5c00' : '#b42a2a' }}>{Math.round(sub.percentage)}%</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] px-2 py-[2px] rounded-full font-medium" style={{ backgroundColor: grade.bg, color: grade.color }}>{grade.label}</span>
                      </td>
                      <td className="px-3 py-2" style={{ color: '#7a7f8a' }}>{sub.time_taken_minutes || '—'} min</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] px-2 py-[2px] rounded-full" style={{ backgroundColor: '#e6f4ea', color: '#1a7340' }}>Marked</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Question breakdown */}
          <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-4">
            <div className="text-[12px] font-medium mb-3" style={{ color: '#0f2044' }}>Per-question breakdown</div>
            <div className="flex items-end gap-[6px]" style={{ height: 100 }}>
              {stats.map((s: any) => (
                <div key={s.index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-[3px] transition-all" style={{
                    height: `${s.correctPct}%`,
                    backgroundColor: s.correctPct > 70 ? '#1a7340' : s.correctPct > 40 ? '#8a5c00' : '#b42a2a',
                    minHeight: 4,
                  }} title={`Q${s.index}: ${s.correctPct}% correct`} />
                  <span className="text-[9px]" style={{ color: '#aab0bc' }}>Q{s.index}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── AI Marking Section ───────────────────────────────────
const MarkingSection: React.FC<{ questions: ExamQuestion[] }> = ({ questions }) => {
  const aiMarkedCount = questions.filter(q => !q.auto_mark).length;

  return (
    <div className="space-y-3">
      <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[9px] p-3 flex items-center gap-3">
        <div className="w-[28px] h-[28px] rounded-[8px] bg-[#1a56b0] flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>AI marking queue</div>
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>{aiMarkedCount} questions require AI + teacher review</div>
        </div>
        <Button variant="outline" size="sm" className="text-[11px] h-7">
          <Check className="w-3 h-3 mr-1" />Approve all
        </Button>
      </div>

      {/* Placeholder marking cards */}
      {['Aisha Khan — Short answer response', 'Omar Hassan — Scenario response', 'Fatima Ali — Creative writing'].map((item, i) => (
        <div key={i} className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
          <div className="flex items-center gap-2 px-[13px] py-[10px] border-b border-[#f0f1f3]">
            <span className="text-[10px] px-2 py-[2px] rounded-[6px]" style={{ backgroundColor: i === 0 ? '#e6f4ea' : i === 1 ? '#fff8e6' : '#f3eefe', color: i === 0 ? '#1a7340' : i === 1 ? '#8a5c00' : '#534AB7' }}>
              {i === 0 ? 'Short answer' : i === 1 ? 'Scenario' : 'Creative'}
            </span>
            <span className="text-[12px] font-medium flex-1" style={{ color: '#0f2044' }}>{item}</span>
            <span className="text-[11px]" style={{ color: '#1a56b0' }}>AI: {3 + i}/{5 + i}</span>
          </div>
          <div className="px-[13px] py-[11px] space-y-2">
            <div>
              <div className="text-[10px] font-medium uppercase mb-1" style={{ color: '#7a7f8a' }}>Student answer</div>
              <div className="bg-[#fafbfc] border border-[#e8e9eb] rounded-[6px] p-2 text-[12px] arabic-text" style={{ color: '#0f2044' }}>
                {i === 0 ? 'اسمي عائشة. أنا من باكستان.' : i === 1 ? 'السلام عليكم! اسمي عمر وأنا طالب جديد.' : 'مرحبا، اسمي فاطمة وأحب التعلم.'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase mb-1" style={{ color: '#1a56b0' }}>AI feedback</div>
              <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[6px] p-2 text-[12px]" style={{ color: '#0f2044' }}>
                {i === 0 ? 'Good use of اسمي for self-introduction. Consider adding more details like age or profession for full marks.' : i === 1 ? 'Excellent greeting and introduction. The response uses appropriate formal language.' : 'Creative expression showing good vocabulary. Minor grammar improvements needed.'}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px]" style={{ color: '#7a7f8a' }}>AI confidence:</span>
                <span className="text-[10px] font-medium" style={{ color: (75 + i * 8) >= 85 ? '#1a7340' : '#8a5c00' }}>{75 + i * 8}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-[13px] py-[8px] border-t bg-[#fafbfc] border-[#f0f1f3]">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 + i }, (_, pi) => (
                <button key={pi} className="w-6 h-6 rounded text-[10px] font-medium transition-colors" style={{
                  backgroundColor: pi === 2 + i ? '#eef2fa' : 'transparent',
                  color: pi === 2 + i ? '#1a56b0' : '#aab0bc',
                  border: `0.5px solid ${pi === 2 + i ? '#1a56b0' : '#e8e9eb'}`,
                }}>{pi + 1}</button>
              ))}
            </div>
            <Button size="sm" className="text-[10px] h-6 px-3" style={{ backgroundColor: '#1a7340', color: '#fff' }}>
              <Check className="w-3 h-3 mr-1" />Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── AI Insights Section ──────────────────────────────────
const InsightsSection: React.FC<{ insights: Insight[] }> = ({ insights }) => {
  const iconMap: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
    weakness: { icon: TrendingDown, bg: '#fde8e8', color: '#b42a2a' },
    strength: { icon: TrendingUp, bg: '#e6f4ea', color: '#1a7340' },
    recommendation: { icon: Lightbulb, bg: '#f0f4ff', color: '#1a56b0' },
    pattern: { icon: Target, bg: '#fff8e6', color: '#8a5c00' },
  };

  if (insights.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
        <Star className="w-8 h-8 mx-auto mb-3 text-[#aab0bc]" />
        <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>No insights yet</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>Generate AI insights after students have submitted their exams.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map(ins => {
        const meta = iconMap[ins.type] || iconMap.recommendation;
        const Icon = meta.icon;
        return (
          <div key={ins.id} className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden">
            <div className="flex items-start gap-3 px-[13px] py-[11px]">
              <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 mt-[2px]" style={{ backgroundColor: meta.bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium px-2 py-[1px] rounded-full capitalize" style={{ backgroundColor: meta.bg, color: meta.color }}>{ins.type}</span>
                  <span className="text-[12.5px] font-medium" style={{ color: '#0f2044' }}>{ins.title}</span>
                </div>
                <div className="text-[12px] mb-2" style={{ color: '#4a5264', lineHeight: 1.5 }}>{ins.description}</div>
                <div className="text-[10px] mb-2" style={{ color: '#7a7f8a' }}>{ins.affected_students} students · {Math.round(ins.affected_percent)}% of class</div>
                {ins.suggested_actions.length > 0 && (
                  <div className="space-y-[3px]">
                    <div className="text-[10px] font-medium uppercase" style={{ color: '#aab0bc' }}>Suggested actions</div>
                    {ins.suggested_actions.map((action: string, ai: number) => (
                      <div key={ai} className="flex items-start gap-[6px] text-[11px]" style={{ color: '#4a5264' }}>
                        <div className="w-[5px] h-[5px] rounded-full mt-[5px] flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        {action}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 px-[13px] py-[7px] border-t bg-[#fafbfc] border-[#f0f1f3]">
              <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">
                <ArrowRight className="w-3 h-3 mr-1" />Add to next session plan
              </Button>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-[#aab0bc]">Dismiss</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Placeholder sections ─────────────────────────────────
const PastExamsSection: React.FC = () => (
  <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
    <Clock className="w-8 h-8 mx-auto mb-3 text-[#aab0bc]" />
    <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>Past exams</div>
    <div className="text-[11px]" style={{ color: '#7a7f8a' }}>Previous assessment history will appear here once exams are completed.</div>
  </div>
);

const StudentProgressSection: React.FC = () => (
  <div className="bg-white border border-dashed border-[#d0d4dc] rounded-[10px] p-8 text-center">
    <TrendingUp className="w-8 h-8 mx-auto mb-3 text-[#aab0bc]" />
    <div className="text-[13px] font-medium mb-1" style={{ color: '#0f2044' }}>Student progress</div>
    <div className="text-[11px]" style={{ color: '#7a7f8a' }}>Track individual student improvement across multiple assessments.</div>
  </div>
);

// ─── Right Panel ──────────────────────────────────────────
const RightPanel: React.FC<{
  activeSection: Section;
  questions: ExamQuestion[];
  submissions: Submission[];
  insights: Insight[];
}> = ({ activeSection, questions, submissions, insights }) => (
  <div className="p-3">
    {activeSection === 'builder' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Question map</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>{questions.length} questions · {questions.reduce((s, q) => s + q.points, 0)} pts</div>
        <div className="space-y-[4px]">
          {questions.map((q, i) => {
            const tc = TYPE_COLORS[q.type] || TYPE_COLORS.mcq;
            return (
              <div key={q.id} className="flex items-center gap-2 p-[6px] rounded-[6px] hover:bg-[#f9f9fb] cursor-pointer transition-colors">
                <span className="text-[10px] font-medium w-5" style={{ color: '#aab0bc' }}>Q{i + 1}</span>
                <span className="text-[9px] px-[5px] py-[1px] rounded" style={{ backgroundColor: tc.bg, color: tc.text }}>{tc.label}</span>
                <span className="flex-1 text-[10px] truncate" style={{ color: '#4a5264' }}>{q.question_text.slice(0, 25)}…</span>
                <span className="text-[9px]" style={{ color: '#aab0bc' }}>{q.points}pt</span>
              </div>
            );
          })}
        </div>
      </>
    )}

    {activeSection === 'results' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Student list</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>{submissions.length} submissions</div>
        <div className="space-y-[4px]">
          {submissions.map((s, i) => {
            const names = ['Aisha K.', 'Omar H.', 'Fatima A.', 'Yusuf A.', 'Maryam S.'];
            return (
              <div key={s.id} className="flex items-center gap-2 p-[6px] rounded-[6px] hover:bg-[#f9f9fb] cursor-pointer">
                <div className="w-5 h-5 rounded-full bg-[#eef2fa] flex items-center justify-center text-[8px] font-medium text-[#1a56b0]">{names[i % 5][0]}</div>
                <span className="flex-1 text-[11px]" style={{ color: '#0f2044' }}>{names[i % 5]}</span>
                <span className="text-[10px] font-medium" style={{ color: s.percentage >= 60 ? '#1a7340' : '#b42a2a' }}>{Math.round(s.percentage)}%</span>
              </div>
            );
          })}
        </div>
      </>
    )}

    {activeSection === 'insights' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Insight summary</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>{insights.length} insights</div>
        <div className="space-y-[4px]">
          {insights.map(ins => (
            <div key={ins.id} className="flex items-center gap-2 p-[6px] rounded-[6px] hover:bg-[#f9f9fb] cursor-pointer">
              <div className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{
                backgroundColor: ins.type === 'weakness' ? '#b42a2a' : ins.type === 'strength' ? '#1a7340' : ins.type === 'recommendation' ? '#1a56b0' : '#8a5c00',
              }} />
              <span className="flex-1 text-[10px] truncate" style={{ color: '#4a5264' }}>{ins.title}</span>
            </div>
          ))}
        </div>
      </>
    )}

    {(activeSection === 'settings' || activeSection === 'marking' || activeSection === 'past' || activeSection === 'progress') && (
      <div className="text-center py-6">
        <div className="text-[11px]" style={{ color: '#aab0bc' }}>Context panel</div>
      </div>
    )}
  </div>
);

export default TeachingOSAssessment;
