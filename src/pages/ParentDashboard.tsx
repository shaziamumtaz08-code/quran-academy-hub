import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Home, FileText, Calendar, FolderOpen, CreditCard, MessageSquare,
  Bell, Download, ChevronRight, Star, CheckCircle2, AlertTriangle,
  Clock, Send, Paperclip, Sparkles, ExternalLink, TrendingUp,
  TrendingDown, BookOpen, Mic, Play, FileIcon, Monitor, ChevronDown,
  Globe, User, ArrowRight, Eye, X
} from 'lucide-react';

type Lang = 'en' | 'ur' | 'ar';
type Section = 'overview' | 'ai-report' | 'sessions' | 'materials' | 'fees' | 'messages';

const i18n: Record<Lang, Record<string, string>> = {
  en: {
    portal: 'Parent portal', myChildren: 'MY CHILDREN', overview: 'Overview',
    aiReport: 'AI progress report', sessions: 'Sessions & attendance',
    materials: 'Materials & resources', fees: 'Fees & payments', messages: 'Message teacher',
    downloadPdf: 'Download report PDF', notifications: 'Notifications', exportPdf: 'Export PDF',
    messageTeacher: 'Message teacher', latestAssessment: 'Latest assessment',
    attendanceRate: 'Attendance rate', speakingScore: 'Speaking score',
    progressTrend: 'Progress trend', aiNote: 'AI note for parents',
    fullReport: 'Full report →', learningProgress: "Learning progress",
    nextSession: 'Next session', vocabMastered: 'Vocabulary mastered',
    assignments: 'Assignments', teacherNote: 'Teacher note',
    sessionsAttended: 'Sessions attended', missedSessions: 'Missed sessions',
    lateArrivals: 'Late arrivals', monthlyFee: 'Monthly fee',
    amountDue: 'Amount due now', paidToDate: 'Paid to date',
    overdueMonths: 'Overdue months', sendMessage: 'Send',
    month: 'Month', amount: 'Amount', date: 'Date', status: 'Status',
    paid: 'Paid', due: 'Due', overdue: 'Overdue', attended: 'Attended',
    missed: 'Missed', excused: 'Excused', late: 'Late',
    submittedOnTime: 'Submitted on time', speakingDrills: 'Speaking drills',
    videosWatched: 'Videos watched', wordsComplete: 'complete',
    declining: 'Declining this month', improving: 'Improving',
    needsImprovement: 'Needs improvement', draftMessage: 'Draft message ↗',
    aiDraft: 'Not sure how to phrase something? Describe what you want to say and AI will draft it.',
    overallSummary: 'OVERALL SUMMARY', whatLearning: 'WHAT THEY ARE LEARNING',
    areasSupport: 'AREAS NEEDING SUPPORT AT HOME', recommendedActions: 'RECOMMENDED ACTIONS FOR PARENTS',
    generateReport: 'Generate report', regenerate: 'Regenerate',
  },
  ur: {
    portal: 'والدین کا پورٹل', myChildren: 'میرے بچے', overview: 'جائزہ',
    aiReport: 'اے آئی پیش رفت رپورٹ', sessions: 'سیشنز اور حاضری',
    materials: 'مواد اور وسائل', fees: 'فیس اور ادائیگیاں', messages: 'استاد کو پیغام',
    downloadPdf: 'رپورٹ PDF ڈاؤنلوڈ', notifications: 'اطلاعات', exportPdf: 'PDF ایکسپورٹ',
    messageTeacher: 'استاد کو پیغام', latestAssessment: 'تازہ ترین تشخیص',
    attendanceRate: 'حاضری کی شرح', speakingScore: 'بولنے کا اسکور',
    progressTrend: 'ترقی کا رجحان', aiNote: 'والدین کے لیے اے آئی نوٹ',
    fullReport: '← مکمل رپورٹ', learningProgress: 'سیکھنے کی پیش رفت',
    nextSession: 'اگلا سیشن', vocabMastered: 'الفاظ سیکھے',
    assignments: 'اسائنمنٹس', teacherNote: 'استاد کا نوٹ',
    sessionsAttended: 'سیشنز حاضر', missedSessions: 'غیر حاضری',
    lateArrivals: 'تاخیر سے آمد', monthlyFee: 'ماہانہ فیس',
    amountDue: 'واجب الادا رقم', paidToDate: 'ادا شدہ رقم',
    overdueMonths: 'بقایا مہینے', sendMessage: 'بھیجیں',
    month: 'مہینہ', amount: 'رقم', date: 'تاریخ', status: 'حالت',
    paid: 'ادا شدہ', due: 'واجب', overdue: 'بقایا', attended: 'حاضر',
    missed: 'غیر حاضر', excused: 'معذرت', late: 'تاخیر',
    submittedOnTime: 'وقت پر جمع', speakingDrills: 'بولنے کی مشق',
    videosWatched: 'ویڈیوز دیکھیں', wordsComplete: 'مکمل',
    declining: 'اس ماہ کمی', improving: 'بہتری',
    needsImprovement: 'بہتری ضروری', draftMessage: '↗ پیغام تحریر کریں',
    aiDraft: 'اگر الفاظ نہیں آ رہے تو بتائیں کہ آپ کیا کہنا چاہتے ہیں، اے آئی تحریر کرے گا۔',
    overallSummary: 'مجموعی خلاصہ', whatLearning: 'وہ کیا سیکھ رہے ہیں',
    areasSupport: 'گھر پر مدد کی ضرورت', recommendedActions: 'والدین کے لیے تجاویز',
    generateReport: 'رپورٹ بنائیں', regenerate: 'دوبارہ بنائیں',
  },
  ar: {
    portal: 'بوابة الوالدين', myChildren: 'أطفالي', overview: 'نظرة عامة',
    aiReport: 'تقرير التقدم بالذكاء الاصطناعي', sessions: 'الجلسات والحضور',
    materials: 'المواد والموارد', fees: 'الرسوم والمدفوعات', messages: 'مراسلة المعلم',
    downloadPdf: 'تحميل التقرير PDF', notifications: 'الإشعارات', exportPdf: 'تصدير PDF',
    messageTeacher: 'مراسلة المعلم', latestAssessment: 'آخر تقييم',
    attendanceRate: 'نسبة الحضور', speakingScore: 'درجة التحدث',
    progressTrend: 'اتجاه التقدم', aiNote: 'ملاحظة AI للوالدين',
    fullReport: '← التقرير الكامل', learningProgress: 'تقدم التعلم',
    nextSession: 'الجلسة القادمة', vocabMastered: 'المفردات المتقنة',
    assignments: 'الواجبات', teacherNote: 'ملاحظة المعلم',
    sessionsAttended: 'الجلسات المحضورة', missedSessions: 'الغياب',
    lateArrivals: 'التأخر', monthlyFee: 'الرسوم الشهرية',
    amountDue: 'المبلغ المستحق', paidToDate: 'المدفوع', overdueMonths: 'أشهر متأخرة',
    sendMessage: 'إرسال', month: 'الشهر', amount: 'المبلغ', date: 'التاريخ',
    status: 'الحالة', paid: 'مدفوع', due: 'مستحق', overdue: 'متأخر',
    attended: 'حضر', missed: 'غاب', excused: 'معذور', late: 'متأخر',
    submittedOnTime: 'سلم في الوقت', speakingDrills: 'تمارين التحدث',
    videosWatched: 'مقاطع شوهدت', wordsComplete: 'مكتملة',
    declining: 'تراجع هذا الشهر', improving: 'تحسن',
    needsImprovement: 'يحتاج تحسين', draftMessage: '↗ صياغة رسالة',
    aiDraft: 'لست متأكداً من الصياغة؟ صف ما تريد قوله وسيقوم الذكاء الاصطناعي بالصياغة.',
    overallSummary: 'ملخص عام', whatLearning: 'ماذا يتعلمون',
    areasSupport: 'مجالات تحتاج دعماً منزلياً', recommendedActions: 'توصيات للوالدين',
    generateReport: 'إنشاء التقرير', regenerate: 'إعادة إنشاء',
  }
};

// Mock children data
const MOCK_CHILDREN = [
  { id: 'c1', name: 'Zara Farooq', initials: 'ZF', course: 'Arabic L1', score: 74, courseId: 'course-1' },
  { id: 'c2', name: 'Omar Farooq', initials: 'OF', course: 'Hifz', score: 88, courseId: 'course-2' },
];

const MOCK_SESSIONS = [
  { date: 'APR 15', title: 'Arabic L1 — Session 3', time: 'Tuesday 6:00 PM · 45 min', teacher: 'Madiha Ali', status: 'attended' as const },
  { date: 'APR 13', title: 'Arabic L1 — Session 2', time: 'Sunday 6:00 PM · 45 min', teacher: 'Madiha Ali', status: 'attended' as const },
  { date: 'APR 10', title: 'Arabic L1 — Session 1', time: 'Thursday 6:00 PM · 45 min', teacher: 'Madiha Ali', status: 'late' as const },
  { date: 'APR 8', title: 'Arabic L1 — Review', time: 'Tuesday 6:00 PM · 45 min', teacher: 'Madiha Ali', status: 'missed' as const },
];

const MOCK_RESOURCES = [
  { type: 'flashcard', title: 'Arabic Prepositions Flashcards', desc: '18 cards · Set 3', progress: '12 of 18 mastered', icon: BookOpen, color: '#1a56b0' },
  { type: 'video', title: 'Conversation Practice - Greetings', desc: '12 min video', progress: 'Watched ✓', icon: Play, color: '#1a7340' },
  { type: 'drill', title: 'Pronunciation Drill - ع and غ', desc: 'Speaking exercise', progress: 'Score 72%', icon: Mic, color: '#8a5c00' },
  { type: 'worksheet', title: 'Week 3 Grammar Worksheet', desc: 'PDF worksheet', progress: 'Download', icon: FileIcon, color: '#534AB7' },
  { type: 'slides', title: 'Session 3 Slides', desc: '14 slides', progress: 'View', icon: Monitor, color: '#0f2044' },
];

const MOCK_FEES = [
  { month: 'April 2026', amount: 'PKR 8,000', date: '–', status: 'due' as const },
  { month: 'March 2026', amount: 'PKR 8,000', date: 'Mar 5', status: 'paid' as const },
  { month: 'February 2026', amount: 'PKR 8,000', date: 'Feb 3', status: 'paid' as const },
  { month: 'January 2026', amount: 'PKR 8,000', date: 'Jan 8', status: 'paid' as const },
];

const MOCK_MESSAGES = [
  { id: 1, sender: 'teacher', name: 'Madiha Ali', text: 'Assalamu alaikum! Zara did very well in today\'s session. She mastered 3 new prepositions. Please encourage her to practice the flashcards at home.', time: 'Apr 15, 6:45 PM', read: true },
  { id: 2, sender: 'parent', name: 'You', text: 'Wa alaikum assalam! Thank you for the update. We will make sure she practices. JazakAllah khair.', time: 'Apr 15, 7:10 PM', read: true },
  { id: 3, sender: 'teacher', name: 'Madiha Ali', text: 'Zara has a pronunciation drill due before the next session. Please remind her to complete it on the student app.', time: 'Apr 13, 6:30 PM', read: false },
];

const ParentDashboard = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');
  const [activeChild, setActiveChild] = useState(MOCK_CHILDREN[0]);
  const [section, setSection] = useState<Section>('overview');
  const [msgInput, setMsgInput] = useState('');
  const [draftIntent, setDraftIntent] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const t = i18n[lang];
  const isRtl = lang === 'ur' || lang === 'ar';

  const scoreColor = (s: number) => s >= 80 ? '#1a7340' : s >= 60 ? '#8a5c00' : '#b42a2a';
  const statusColor = (s: string) => s === 'paid' || s === 'attended' ? '#1a7340' : s === 'due' || s === 'late' || s === 'excused' ? '#8a5c00' : '#b42a2a';

  const generateAiReport = async () => {
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-parent-report', {
        body: {
          studentName: activeChild.name,
          courseName: activeChild.course,
          language: lang,
          assessmentAvg: activeChild.score,
          attendanceRate: 75,
          speakingAvg: 68,
          assignmentCompletion: '4/5',
          vocabMastered: '9/18',
          weakestSkill: 'Arabic prepositions',
          teacherNote: 'Zara participates well but needs more practice at home with prepositions.',
          atRisk: false,
        }
      });
      if (error) throw error;
      setAiReport(data);
      toast.success(lang === 'ur' ? 'رپورٹ تیار ہو گئی' : 'Report generated');
    } catch (e) {
      // Fallback mock report
      setAiReport({
        summary: lang === 'ur'
          ? 'زارا نے اس ماہ اچھی پیش رفت کی ہے۔ اس کی حاضری مستقل ہے اور وہ کلاس میں فعال طور پر حصہ لیتی ہے۔ عربی حروف جار میں مزید مشق سے فائدہ ہو سکتا ہے۔'
          : 'Zara has made good progress this month. Her attendance is consistent and she actively participates in class. She could benefit from more practice with Arabic prepositions at home.',
        learningUpdate: lang === 'ur'
          ? 'اس ہفتے ہم نے عربی حروف جار اور سادہ جملے سیکھے۔ اگلے ہفتے ہم بات چیت کی مشق کریں گے۔'
          : 'This week we covered Arabic prepositions and simple sentence construction. Next week we will move to conversational practice and listening exercises.',
        needsSupport: lang === 'ur'
          ? 'زارا کو حرف جار "حَوْلَ" اور "بَيْنَ" میں مشکل ہو رہی ہے۔ روزانہ 5 منٹ فلیش کارڈز سے مشق کرائیں۔'
          : 'Zara is struggling with the prepositions "حَوْلَ" (around) and "بَيْنَ" (between). These keep appearing in assessments. Encourage daily 5-min flashcard practice at home.',
        homeSuggestions: lang === 'ur'
          ? ['روزانہ 5 منٹ فلیش کارڈز کی مشق', 'سونے سے پہلے عربی کہانی سنائیں', 'ایپ پر تلفظ کی مشق مکمل کروائیں']
          : ['Practice flashcards for 5 minutes daily after Maghrib', 'Listen to Arabic stories before bedtime', 'Complete the pronunciation drill on the student app'],
        badges: ['✓ Good participation', '✓ Vocabulary growing', '⭐ Most improved: listening'],
        overallTone: 'positive'
      });
      toast.success(lang === 'ur' ? 'رپورٹ تیار ہو گئی' : 'Report generated');
    }
    setGeneratingReport(false);
  };

  const sidebarNav: { key: Section; label: string; icon: any; badge?: string; badgeColor?: string }[] = [
    { key: 'overview', label: t.overview, icon: Home },
    { key: 'ai-report', label: t.aiReport, icon: FileText, badge: 'New', badgeColor: '#1a56b0' },
    { key: 'sessions', label: t.sessions, icon: Calendar },
    { key: 'materials', label: t.materials, icon: FolderOpen },
    { key: 'fees', label: t.fees, icon: CreditCard, badge: 'Due', badgeColor: '#8a5c00' },
    { key: 'messages', label: t.messages, icon: MessageSquare, badge: '2', badgeColor: '#b42a2a' },
  ];

  // Mobile bottom nav
  const mobileNav: { key: Section; label: string; icon: any }[] = [
    { key: 'overview', label: 'Home', icon: Home },
    { key: 'ai-report', label: 'Report', icon: FileText },
    { key: 'sessions', label: 'Sessions', icon: Calendar },
    { key: 'fees', label: 'Fees', icon: CreditCard },
    { key: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  const StatCard = ({ label, value, sub, color, border }: { label: string; value: string; sub?: string; color?: string; border?: string }) => (
    <div className="bg-white rounded-[10px] p-3 sm:p-4" style={{ border: `0.5px solid ${border || '#e8e9eb'}` }}>
      <div style={{ fontSize: 24, fontWeight: 500, color: color || '#0f2044' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#7a7f8a', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color || '#aab0bc', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-4 sm:space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t.latestAssessment} value="74%" sub={`${activeChild.course} · Session 2`} color={scoreColor(74)} />
        <StatCard label={t.attendanceRate} value="75%" sub="3 of 4 sessions" />
        <StatCard label={t.speakingScore} value="68%" sub={t.needsImprovement} color="#8a5c00" />
        <StatCard label={t.progressTrend} value="-4%" sub={t.declining} color="#b42a2a" border="#b42a2a" />
      </div>

      {/* AI Note */}
      <div className="rounded-[9px] p-4" style={{ background: '#f0f4ff', border: '1px solid #b5d0f8' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Star className="w-4 h-4 mt-0.5" style={{ color: '#1a56b0' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>
                {t.aiNote} — April 2026
              </div>
              <div style={{ fontSize: 13, color: '#3d4152', marginTop: 4 }} className={isRtl ? 'urdu-text' : ''}>
                {lang === 'ur' ? 'زارا محنت کر رہی ہے لیکن عربی حروف جار میں اضافی مدد کی ضرورت ہے اس ہفتے' :
                 'Zara is working hard but needs extra support with Arabic prepositions this week'}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSection('ai-report')}
            style={{ borderColor: '#1a56b0', color: '#1a56b0', borderRadius: 7, fontSize: 12, whiteSpace: 'nowrap' }}>
            {t.fullReport}
          </Button>
        </div>
      </div>

      {/* Two column - Progress + Next session */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Learning progress */}
        <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044', marginBottom: 12 }}>{t.learningProgress}</div>
          {[
            { label: 'Assessment', value: 74, color: '#8a5c00' },
            { label: 'Attendance', value: 75, color: '#8a5c00' },
            { label: 'Speaking', value: 68, color: '#b42a2a' },
            { label: 'Assignments', value: 88, color: '#1a7340' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-3 mb-2.5">
              <span style={{ fontSize: 12, color: '#7a7f8a', width: 90 }}>{b.label}</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 5, background: '#f0f1f3' }}>
                <div style={{ width: `${b.value}%`, height: '100%', background: b.color, borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: b.color, width: 36, textAlign: 'right' }}>{b.value}%</span>
            </div>
          ))}
        </div>

        {/* Next session */}
        <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044', marginBottom: 12 }}>{t.nextSession}</div>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center justify-center rounded-lg" style={{ width: 44, height: 44, background: '#f4f5f7', border: '0.5px solid #e8e9eb' }}>
              <span style={{ fontSize: 9, color: '#7a7f8a', fontWeight: 500 }}>APR</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#0f2044' }}>15</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>Arabic L1 — Session 3</div>
              <div style={{ fontSize: 11, color: '#7a7f8a' }}>Tuesday 6:00 PM · 45 min · Madiha Ali</div>
            </div>
          </div>
          <div className="mt-3 rounded-lg p-2.5" style={{ background: '#eef2fa', border: '0.5px solid #b5d0f8' }}>
            <div className="flex items-start gap-2" style={{ fontSize: 12, color: '#1a56b0' }}>
              <span>📚</span>
              <span>Zara has a pronunciation drill due before this session. Remind her to complete it on the student app.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Three column - Vocab, assignments, teacher note */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Vocab */}
        <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044', marginBottom: 12 }}>{t.vocabMastered}</div>
          <div className="flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f0f1f3" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#8a5c00" strokeWidth="6"
                strokeDasharray={`${(9/18)*213.6} 213.6`} strokeLinecap="round" transform="rotate(-90 40 40)" />
              <text x="40" y="36" textAnchor="middle" style={{ fontSize: 18, fontWeight: 600, fill: '#0f2044' }}>9</text>
              <text x="40" y="50" textAnchor="middle" style={{ fontSize: 10, fill: '#7a7f8a' }}>of 18</text>
            </svg>
          </div>
          <div className="text-center mt-1" style={{ fontSize: 11, color: '#7a7f8a' }}>words mastered · 50% {t.wordsComplete}</div>
        </div>

        {/* Assignments */}
        <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044', marginBottom: 12 }}>{t.assignments}</div>
          <div className="space-y-2">
            {[
              { label: t.submittedOnTime, value: '4/5', color: '#1a7340' },
              { label: t.speakingDrills, value: '2/3', color: '#8a5c00' },
              { label: t.videosWatched, value: '3/3', color: '#1a7340' },
            ].map(a => (
              <div key={a.label} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                <span style={{ color: '#3d4152' }}>{a.label}</span>
                <span style={{ fontWeight: 600, color: a.color }}>{a.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md p-2" style={{ background: '#fde8e8', fontSize: 11, color: '#b42a2a' }}>
            1 speaking drill overdue · due Apr 14
          </div>
        </div>

        {/* Teacher note */}
        <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044', marginBottom: 12 }}>{t.teacherNote}</div>
          <div className="flex items-start gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: '#1a56b0', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>MA</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#0f2044' }}>Madiha Ali</div>
              <div style={{ fontSize: 10, color: '#aab0bc' }}>Arabic teacher · Apr 13</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#3d4152', lineHeight: 1.6 }} className={lang === 'ur' ? 'urdu-text' : ''}>
            {lang === 'ur' 
              ? '"زارا کلاس میں اچھی طرح حصہ لیتی ہے۔ اسے حرف جار کی مشق کرنے کی ضرورت ہے — یہ بار بار تشخیص میں آ رہے ہیں۔ روزانہ 5 منٹ ایپ پر مشق کروائیں۔"'
              : '"Zara participates well in class. She needs to practise the preposition حَوْلَ at home — it keeps appearing in assessments. Encourage daily 5-min app practice."'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAiReport = () => (
    <div className="space-y-4">
      {/* Generate banner */}
      <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <Star className="w-4 h-4 mt-0.5" style={{ color: '#534AB7' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#0f2044' }}>
                {t.aiReport} — {activeChild.name} · April 2026
              </div>
              <div style={{ fontSize: 12, color: '#7a7f8a', marginTop: 2 }}>
                Generated from assessments, attendance, speaking and assignments · {activeChild.course}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.success('PDF exported')}
              style={{ borderRadius: 7, fontSize: 12 }}>
              <Download className="w-3.5 h-3.5 mr-1" /> {t.exportPdf}
            </Button>
            <Button size="sm" onClick={generateAiReport} disabled={generatingReport}
              style={{ background: '#1a56b0', color: '#fff', borderRadius: 7, fontSize: 12 }}>
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {aiReport ? t.regenerate : t.generateReport}
            </Button>
          </div>
        </div>
      </div>

      {generatingReport && (
        <div className="bg-white rounded-[10px] p-8 text-center" style={{ border: '0.5px solid #e8e9eb' }}>
          <div className="w-8 h-8 border-3 border-[#1a56b0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div style={{ fontSize: 13, color: '#7a7f8a' }}>Generating AI report...</div>
        </div>
      )}

      {aiReport && !generatingReport && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#1a56b0', letterSpacing: 0.5, marginBottom: 8 }}>{t.overallSummary}</div>
            <p style={{ fontSize: 14, color: '#3d4152', lineHeight: 1.7 }} className={isRtl ? 'urdu-text' : ''}>{aiReport.summary}</p>
            {aiReport.badges && (
              <div className="flex flex-wrap gap-2 mt-3">
                {aiReport.badges.map((b: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 rounded-full" style={{ fontSize: 11, background: i === 2 ? '#f3eefe' : '#e6f4ea', color: i === 2 ? '#534AB7' : '#1a7340' }}>{b}</span>
                ))}
              </div>
            )}
          </div>

          {/* What they are learning */}
          <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#1a56b0', letterSpacing: 0.5, marginBottom: 8 }}>{t.whatLearning}</div>
            <p style={{ fontSize: 14, color: '#3d4152', lineHeight: 1.7 }} className={isRtl ? 'urdu-text' : ''}>{aiReport.learningUpdate}</p>
          </div>

          {/* Areas needing support */}
          {aiReport.needsSupport && (
            <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb', borderLeft: '3px solid #b42a2a' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#b42a2a', letterSpacing: 0.5, marginBottom: 8 }}>{t.areasSupport}</div>
              <p style={{ fontSize: 14, color: '#3d4152', lineHeight: 1.7 }} className={isRtl ? 'urdu-text' : ''}>{aiReport.needsSupport}</p>
            </div>
          )}

          {/* Recommended actions */}
          {aiReport.homeSuggestions && (
            <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#1a7340', letterSpacing: 0.5, marginBottom: 8 }}>{t.recommendedActions}</div>
              <div className="space-y-2">
                {aiReport.homeSuggestions.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg p-2.5" style={{ background: '#f9fafb' }}>
                    <span className="flex items-center justify-center rounded-full" style={{ width: 22, height: 22, background: '#e6f4ea', color: '#1a7340', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: '#3d4152', lineHeight: 1.5 }} className={isRtl ? 'urdu-text' : ''}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!aiReport && !generatingReport && (
        <div className="bg-white rounded-[10px] p-8 text-center" style={{ border: '0.5px solid #e8e9eb' }}>
          <Star className="w-8 h-8 mx-auto mb-3" style={{ color: '#aab0bc' }} />
          <div style={{ fontSize: 14, color: '#7a7f8a' }}>Click "Generate report" to create an AI progress report</div>
        </div>
      )}
    </div>
  );

  const renderSessions = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t.sessionsAttended} value="3" sub="of 4 this month" />
        <StatCard label={t.attendanceRate} value="75%" color="#8a5c00" />
        <StatCard label={t.missedSessions} value="1" color="#b42a2a" />
        <StatCard label={t.lateArrivals} value="1" color="#8a5c00" />
      </div>

      <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>Session history</span>
          <Button variant="ghost" size="sm" style={{ fontSize: 11, color: '#1a56b0' }}>
            <Download className="w-3 h-3 mr-1" /> Download attendance record
          </Button>
        </div>
        <div className="space-y-2">
          {MOCK_SESSIONS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-[#fafbfc] transition-colors">
              <div className="flex flex-col items-center justify-center rounded-lg" style={{ width: 40, height: 40, background: '#f4f5f7', border: '0.5px solid #e8e9eb', flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: '#7a7f8a', fontWeight: 500 }}>{s.date.split(' ')[0]}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f2044' }}>{s.date.split(' ')[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#7a7f8a' }}>{s.time} · {s.teacher}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full" style={{
                fontSize: 11, fontWeight: 500,
                background: s.status === 'attended' ? '#e6f4ea' : s.status === 'missed' ? '#fde8e8' : '#fff8e6',
                color: statusColor(s.status)
              }}>
                {t[s.status] || s.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMaterials = () => (
    <div className="space-y-4">
      <div className="rounded-lg p-3 mb-3" style={{ background: '#fff8e6', border: '1px solid #f5d485', fontSize: 12, color: '#8a5c00' }}>
        ⚠ 1 pending task: Pronunciation Drill - ع and غ (due Apr 14)
      </div>
      <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb' }}>
        <div className="space-y-2">
          {MOCK_RESOURCES.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-3 hover:bg-[#fafbfc] transition-colors" style={{ border: '0.5px solid #f0f1f3' }}>
              <div className="flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: `${r.color}15`, flexShrink: 0 }}>
                <r.icon className="w-4 h-4" style={{ color: r.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#7a7f8a' }}>{r.desc}</div>
              </div>
              <span style={{ fontSize: 11, color: r.progress.includes('✓') ? '#1a7340' : '#7a7f8a' }}>{r.progress}</span>
              <Button variant="outline" size="sm" style={{ borderRadius: 7, fontSize: 11, padding: '4px 10px' }}>Open →</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t.monthlyFee} value="PKR 8,000" />
        <StatCard label={t.amountDue} value="PKR 8,000" color="#8a5c00" border="#8a5c00" />
        <StatCard label={t.paidToDate} value="PKR 24,000" color="#1a7340" />
        <StatCard label={t.overdueMonths} value="0" color="#1a7340" />
      </div>

      <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: '0.5px solid #e8e9eb' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {[t.month, t.amount, t.date, t.status, ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5" style={{ fontSize: 11, fontWeight: 500, color: '#7a7f8a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_FEES.map((f, i) => (
              <tr key={i} className="hover:bg-[#fafbfc]" style={{ borderTop: '0.5px solid #f0f1f3' }}>
                <td className="px-4 py-3" style={{ fontSize: 13, color: '#0f2044' }}>{f.month}</td>
                <td className="px-4 py-3" style={{ fontSize: 13, color: '#0f2044' }}>{f.amount}</td>
                <td className="px-4 py-3" style={{ fontSize: 13, color: '#7a7f8a' }}>{f.date}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full" style={{
                    fontSize: 11, fontWeight: 500,
                    background: f.status === 'paid' ? '#e6f4ea' : f.status === 'due' ? '#fff8e6' : '#fde8e8',
                    color: statusColor(f.status)
                  }}>{t[f.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {f.status !== 'paid' && (
                    <Button size="sm" style={{ background: '#1a7340', color: '#fff', borderRadius: 7, fontSize: 11, padding: '4px 12px' }}>
                      Pay now
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-4">
      {/* Teacher card */}
      <div className="bg-white rounded-[10px] p-3 flex items-center gap-3" style={{ border: '0.5px solid #e8e9eb' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: '#1a56b0', fontSize: 12, fontWeight: 500 }}>MA</div>
        <div className="flex-1">
          <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>Madiha Ali</div>
          <div style={{ fontSize: 11, color: '#7a7f8a' }}>Arabic · ● Online</div>
        </div>
      </div>

      {/* Chat thread */}
      <div className="bg-white rounded-[10px] p-4" style={{ border: '0.5px solid #e8e9eb', maxHeight: 340, overflowY: 'auto' }}>
        <div className="space-y-3">
          {MOCK_MESSAGES.map(m => (
            <div key={m.id} className={`flex ${m.sender === 'parent' ? (isRtl ? 'justify-start' : 'justify-end') : (isRtl ? 'justify-end' : 'justify-start')}`}>
              <div className="max-w-[80%] rounded-xl px-3 py-2" style={{
                background: m.sender === 'parent' ? '#0f2044' : '#f4f5f7',
                color: m.sender === 'parent' ? '#fff' : '#3d4152'
              }}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
                <div className="text-right mt-1" style={{ fontSize: 10, color: m.sender === 'parent' ? '#aab0bc' : '#aab0bc' }}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" style={{ borderRadius: 7 }}><Paperclip className="w-4 h-4" /></Button>
        <Input
          value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          placeholder={lang === 'ur' ? 'پیغام لکھیں...' : 'Type your message...'}
          style={{ borderRadius: 7, fontSize: 13 }}
          className={isRtl ? 'text-right' : ''}
        />
        <Button size="sm" onClick={() => { toast.success('Message sent'); setMsgInput(''); }}
          style={{ background: '#1a7340', color: '#fff', borderRadius: 7 }}>
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* AI draft helper */}
      <div className="rounded-lg p-3" style={{ background: '#f0f4ff', border: '1px solid #b5d0f8' }}>
        <div style={{ fontSize: 12, color: '#1a56b0', marginBottom: 6 }} className={isRtl ? 'urdu-text' : ''}>{t.aiDraft}</div>
        {showDraft ? (
          <div className="flex gap-2">
            <Input value={draftIntent} onChange={e => setDraftIntent(e.target.value)} placeholder="e.g. Ask about homework schedule"
              style={{ borderRadius: 7, fontSize: 12 }} />
            <Button size="sm" onClick={() => { toast.success('AI drafted your message'); setShowDraft(false); }}
              style={{ background: '#1a56b0', color: '#fff', borderRadius: 7, fontSize: 11 }}>Draft</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowDraft(true)}
            style={{ borderColor: '#1a56b0', color: '#1a56b0', borderRadius: 7, fontSize: 11 }}>
            <Sparkles className="w-3 h-3 mr-1" /> {t.draftMessage}
          </Button>
        )}
      </div>
    </div>
  );

  const sectionContent: Record<Section, () => JSX.Element> = {
    overview: renderOverview,
    'ai-report': renderAiReport,
    sessions: renderSessions,
    materials: renderMaterials,
    fees: renderFees,
    messages: renderMessages,
  };

  return (
    <div className={`h-screen flex flex-col ${isRtl ? 'direction-rtl' : ''}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-4 bg-white shrink-0" style={{ borderBottom: '0.5px solid #e8e9eb' }}>
        <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#7a7f8a' }}>
          <button onClick={() => setSection('overview')} className="hover:underline cursor-pointer">{t.portal}</button>
          <span>›</span>
          <button onClick={() => setSection('overview')} className="hover:underline cursor-pointer" style={{ color: '#0f2044' }}>{activeChild.name}</button>
          {section !== 'overview' && (
            <>
              <span>›</span>
              <span style={{ color: '#0f2044' }}>{t[section === 'ai-report' ? 'aiReport' : section]}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="relative" onClick={() => setShowNotif(!showNotif)}>
            <Bell className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: '#b42a2a' }} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success('PDF exported')} className="hidden sm:flex"
            style={{ borderRadius: 7, fontSize: 11 }}>
            <Download className="w-3 h-3 mr-1" /> {t.exportPdf}
          </Button>
          <Button size="sm" onClick={() => navigate('/communication')} className="hidden sm:flex"
            style={{ background: '#1a7340', color: '#fff', borderRadius: 7, fontSize: 11 }}>
            <MessageSquare className="w-3 h-3 mr-1" /> {t.messageTeacher}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - desktop */}
        <div className="hidden md:flex flex-col shrink-0" style={{ width: 220, background: '#fff', borderRight: isRtl ? 'none' : '0.5px solid #e8e9eb', borderLeft: isRtl ? '0.5px solid #e8e9eb' : 'none' }}>
          {/* Parent header */}
          <div className="p-3 flex items-center gap-2.5" style={{ borderBottom: '0.5px solid #f0f1f3' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#eef2fa', color: '#1a56b0', fontSize: 12, fontWeight: 600 }}>FM</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }}>Fatima Mumtaz</div>
              <div style={{ fontSize: 10, color: '#aab0bc' }}>{t.portal}</div>
            </div>
          </div>

          {/* Children */}
          <div className="p-3">
            <div style={{ fontSize: 10, fontWeight: 600, color: '#aab0bc', letterSpacing: 0.5, marginBottom: 8 }}>{t.myChildren}</div>
            {MOCK_CHILDREN.map(c => (
              <button key={c.id} onClick={() => setActiveChild(c)}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 mb-1 transition-colors"
                style={{ background: activeChild.id === c.id ? '#eef2fa' : 'transparent' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{
                  background: activeChild.id === c.id ? '#1a56b0' : '#f0f1f3',
                  color: activeChild.id === c.id ? '#fff' : '#7a7f8a', fontSize: 10, fontWeight: 600
                }}>{c.initials}</div>
                <div className="flex-1 text-left min-w-0">
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#0f2044' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#aab0bc' }}>{c.course}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(c.score) }}>{c.score}%</span>
              </button>
            ))}
          </div>

          {/* Section nav */}
          <div className="px-3 flex-1">
            <div style={{ fontSize: 10, fontWeight: 600, color: '#aab0bc', letterSpacing: 0.5, marginBottom: 6 }}>
              {activeChild.name.split(' ')[0].toUpperCase()}
            </div>
            {sidebarNav.map(n => (
              <button key={n.key} onClick={() => n.key === 'messages' ? navigate('/communication') : setSection(n.key)}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 mb-0.5 transition-colors"
                style={{ background: section === n.key ? '#eef2fa' : 'transparent' }}>
                <n.icon className="w-4 h-4" style={{ color: section === n.key ? '#1a56b0' : '#7a7f8a' }} />
                <span className="flex-1 text-left" style={{ fontSize: 12, color: section === n.key ? '#1a56b0' : '#3d4152', fontWeight: section === n.key ? 500 : 400 }}>
                  {n.label}
                </span>
                {n.badge && (
                  <span className="px-1.5 py-0.5 rounded-full" style={{
                    fontSize: 10, fontWeight: 500, background: `${n.badgeColor}18`, color: n.badgeColor
                  }}>{n.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Language + download */}
          <div className="p-3" style={{ borderTop: '0.5px solid #f0f1f3' }}>
            <div className="flex gap-1.5 mb-3">
              {(['en', 'ur', 'ar'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className="flex-1 py-1.5 rounded-full text-center transition-colors"
                  style={{
                    fontSize: 11, fontWeight: 500, border: '0.5px solid #e8e9eb',
                    background: lang === l ? '#0f2044' : '#fff',
                    color: lang === l ? '#fff' : '#7a7f8a',
                  }}>
                  {l === 'en' ? 'EN' : l === 'ur' ? 'اردو' : 'عربي'}
                </button>
              ))}
            </div>
            <Button className="w-full" size="sm" onClick={() => toast.success('Downloading PDF...')}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 8, fontSize: 12 }}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> {t.downloadPdf}
            </Button>
          </div>
        </div>

        {/* Mobile child selector */}
        <div className="md:hidden absolute top-12 left-0 right-0 z-10 bg-white px-3 py-2 flex items-center gap-2" style={{ borderBottom: '0.5px solid #e8e9eb' }}>
          {MOCK_CHILDREN.map(c => (
            <button key={c.id} onClick={() => setActiveChild(c)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
              style={{ border: '0.5px solid #e8e9eb', background: activeChild.id === c.id ? '#eef2fa' : '#fff', fontSize: 12 }}>
              <span style={{ fontWeight: 500, color: '#0f2044' }}>{c.name.split(' ')[0]}</span>
              <span style={{ fontWeight: 600, color: scoreColor(c.score) }}>{c.score}%</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#f4f5f7' }}>
          <div className="p-4 sm:p-5 pb-20 md:pb-5 mt-10 md:mt-0">
            {sectionContent[section]()}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden flex items-center justify-around bg-white shrink-0" style={{ height: 52, borderTop: '0.5px solid #e8e9eb' }}>
        {mobileNav.map(n => (
          <button key={n.key} onClick={() => setSection(n.key)} className="flex flex-col items-center gap-0.5 py-1"
            style={{ color: section === n.key ? '#1a56b0' : '#aab0bc' }}>
            <n.icon className="w-5 h-5" />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Notification drawer */}
      {showNotif && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowNotif(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white h-full" style={{ width: 300, borderLeft: '0.5px solid #e8e9eb' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3" style={{ borderBottom: '0.5px solid #e8e9eb' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#0f2044' }}>{t.notifications}</span>
              <Button variant="ghost" size="sm" onClick={() => setShowNotif(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-3 space-y-2">
              {[
                { icon: FileText, text: 'Monthly AI report generated for Zara', time: '2h ago', color: '#534AB7' },
                { icon: Calendar, text: 'Zara missed Session 2 on Apr 8', time: '5d ago', color: '#b42a2a' },
                { icon: CreditCard, text: 'April fee due in 3 days', time: '1d ago', color: '#8a5c00' },
                { icon: MessageSquare, text: 'New message from Madiha Ali', time: '2d ago', color: '#1a56b0' },
              ].map((n, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg p-2.5 hover:bg-[#fafbfc] cursor-pointer transition-colors">
                  <n.icon className="w-4 h-4 mt-0.5" style={{ color: n.color }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, color: '#3d4152' }}>{n.text}</div>
                    <div style={{ fontSize: 10, color: '#aab0bc' }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
