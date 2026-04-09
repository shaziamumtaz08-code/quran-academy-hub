import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseArabicTags } from '@/lib/languageUtils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { NavRail, buildRailNav } from '@/components/layout/NavRail';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Mic, MicOff, Volume2, ChevronRight, CheckCircle2, CircleDot, Star,
  Play, MessageSquare, Headphones, ClipboardList, BarChart3, BookOpen,
  ScrollText, ExternalLink, Send, Sparkles, ArrowRight, Users, Clock,
  Calendar, Plus, Check, AlertTriangle, TrendingUp, Lightbulb, X
} from 'lucide-react';

type Section = 'drill' | 'conversation' | 'shadowing' | 'assign' | 'progress' | 'library' | 'scripts';

interface DrillPhrase {
  id: string;
  phrase_arabic: string;
  romanised: string;
  english: string;
  difficulty: number;
  position: number;
  lastScore?: number;
  status?: string;
}

const PHASE_STEPS = [
  { key: 'syllabus', label: 'Syllabus' }, { key: 'planner', label: 'Planner' },
  { key: 'board', label: 'Board' }, { key: 'kit', label: 'Kit' },
  { key: 'assess', label: 'Assess' }, { key: 'video', label: 'Video' },
  { key: 'speaking', label: 'Speaking' },
];

const MOCK_PHRASES: DrillPhrase[] = [
  { id: 'p1', phrase_arabic: 'اسمي أحمد، أنا من باكستان', romanised: 'is-mee Ah-mad, ana min Ba-kis-tan', english: 'My name is Ahmad, I am from Pakistan', difficulty: 1, position: 1, lastScore: 87, status: 'improving' },
  { id: 'p2', phrase_arabic: 'أنا من', romanised: 'ana min', english: 'I am from', difficulty: 1, position: 2, lastScore: 74, status: 'practising' },
  { id: 'p3', phrase_arabic: 'السلام عليكم', romanised: 'as-sa-laa-mu a-lay-kum', english: 'Peace be upon you', difficulty: 1, position: 3, lastScore: 94, status: 'mastered' },
  { id: 'p4', phrase_arabic: 'وعليكم السلام', romanised: 'wa a-lay-kum as-sa-laam', english: 'And upon you peace', difficulty: 1, position: 4, lastScore: 91, status: 'mastered' },
  { id: 'p5', phrase_arabic: 'من أين أنت', romanised: 'min ay-na ant', english: 'Where are you from', difficulty: 2, position: 5, lastScore: 68, status: 'practising' },
  { id: 'p6', phrase_arabic: 'تشرفنا', romanised: 'ta-shar-raf-na', english: 'Nice to meet you', difficulty: 1, position: 6 },
  { id: 'p7', phrase_arabic: 'باكستان', romanised: 'ba-kis-tan', english: 'Pakistan', difficulty: 1, position: 7, lastScore: 61, status: 'practising' },
  { id: 'p8', phrase_arabic: 'مصر', romanised: 'misr', english: 'Egypt', difficulty: 1, position: 8, lastScore: 61, status: 'practising' },
  { id: 'p9', phrase_arabic: 'أهلاً', romanised: 'ah-lan', english: 'Welcome', difficulty: 1, position: 9, lastScore: 88, status: 'improving' },
  { id: 'p10', phrase_arabic: 'شكراً', romanised: 'shuk-ran', english: 'Thank you', difficulty: 1, position: 10 },
  { id: 'p11', phrase_arabic: 'ما اسمك', romanised: 'ma is-muk', english: 'What is your name', difficulty: 2, position: 11 },
  { id: 'p12', phrase_arabic: 'مع السلامة', romanised: 'ma-a as-sa-la-ma', english: 'Goodbye', difficulty: 1, position: 12 },
];

const MOCK_WORD_BREAKDOWN = [
  { arabic: 'اسمي', status: 'perfect' as const, issue: null, correction: null },
  { arabic: 'أحمد،', status: 'perfect' as const, issue: null, correction: null },
  { arabic: 'أنا', status: 'improve' as const, issue: 'Stress on first syllable needed', correction: "Stress: 'A-na, not a-NA'" },
  { arabic: 'من', status: 'perfect' as const, issue: null, correction: null },
  { arabic: 'باكستان', status: 'improve' as const, issue: 'Final syllable rushed', correction: "Slow down: Ba-kis-TAAN" },
];

const scoreColor = (s: number) => s >= 85 ? '#1a7340' : s >= 70 ? '#1a56b0' : s >= 55 ? '#8a5c00' : '#b42a2a';

const TeachingOSSpeakingTutor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const railItems = buildRailNav(activeRole);
  const sessionId = searchParams.get('session_id');

  const [activeSection, setActiveSection] = useState<Section>('drill');
  const [courseName, setCourseName] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [currentPhraseIdx, setCurrentPhraseIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState({ overall: 0, pronunciation: 0, fluency: 0 });
  const [animatedScores, setAnimatedScores] = useState({ overall: 0, pronunciation: 0, fluency: 0 });
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(32).fill(0).map(() => 4 + Math.random() * 8));
  const animFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; arabic?: string; score?: number }[]>([
    { role: 'assistant', content: 'مرحباً! أنا معلمك. ما اسمك؟ (Hello! I am your teacher. What is your name?)', arabic: 'مرحباً! أنا معلمك. ما اسمك؟' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const currentPhrase = MOCK_PHRASES[currentPhraseIdx];

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: sp } = await supabase.from('session_plans').select('*').eq('id', sessionId).single();
      if (sp) {
        setSessionTitle((sp as any).session_title || '');
        const { data: syl } = await supabase.from('syllabi').select('course_name').eq('id', (sp as any).syllabus_id).single();
        if (syl) setCourseName(syl.course_name);
      }
    })();
  }, [sessionId]);

  // Score animation
  useEffect(() => {
    if (!showScore) return;
    const start = performance.now();
    const duration = 600;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimatedScores({
        overall: Math.round(scores.overall * ease),
        pronunciation: Math.round(scores.pronunciation * ease),
        fluency: Math.round(scores.fluency * ease),
      });
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [showScore, scores]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      setIsRecording(true);
      setShowScore(false);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateBars = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from({ length: 32 }, (_, i) => {
          const val = dataArray[Math.min(i, dataArray.length - 1)] || 0;
          return 4 + (val / 255) * 28;
        });
        setWaveformBars(bars);
        animFrameRef.current = requestAnimationFrame(updateBars);
      };
      updateBars();

      // Auto-stop after 5s
      setTimeout(() => stopRecording(), 5000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    setIsRecording(false);
    setIsProcessing(true);
    setWaveformBars(Array(32).fill(0).map(() => 4 + Math.random() * 8));

    // Simulate AI scoring
    setTimeout(() => {
      setIsProcessing(false);
      setScores({ overall: 87, pronunciation: 91, fluency: 72 });
      setShowScore(true);
      toast.success('Score: 87/100', { style: { backgroundColor: '#0f2044', color: '#fff' } });
    }, 1500);
  };

  const nextPhrase = () => {
    setCurrentPhraseIdx(i => (i + 1) % MOCK_PHRASES.length);
    setShowScore(false);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    const input = chatInput;
    setChatInput('');
    // Mock AI response
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'أهلاً! اسمي جميل. من أين أنت؟ (Hello! Nice name. Where are you from?)',
        arabic: 'أهلاً! اسمي جميل. من أين أنت؟'
      }]);
    }, 1200);
  };

  const sectionLabel: Record<Section, string> = {
    drill: 'Pronunciation drill', conversation: 'AI conversation', shadowing: 'Shadowing mode',
    assign: 'Assign practice', progress: 'Student progress', library: 'Drill library', scripts: 'Conversation scripts',
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f4f5f7' }}>
      <NavRail items={railItems} />

      {/* Section Sidebar */}
      <div className="w-[220px] bg-white border-r flex flex-col flex-shrink-0" style={{ borderColor: '#e8e9eb' }}>
        <div className="px-4 pt-[14px] pb-[10px] border-b" style={{ borderColor: '#e8e9eb' }}>
          <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>Speaking tutor</div>
          <div className="text-[11px] mt-[2px]" style={{ color: '#7a7f8a' }}>Teaching OS · Phase 7</div>
        </div>

        <div className="flex items-center gap-[3px] px-3 py-2 border-b flex-wrap" style={{ borderColor: '#f0f1f3' }}>
          {PHASE_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 && <ChevronRight className="w-[10px] h-[10px] text-[#aab0bc]" />}
              <div className="flex items-center gap-[2px]">
                {i < 6 ? <CheckCircle2 className="w-[12px] h-[12px] text-[#1a7340]" /> : <CircleDot className="w-[12px] h-[12px] text-[#0f2044]" />}
                <span className={`text-[8px] font-medium ${i === 6 ? 'text-[#0f2044]' : 'text-[#7a7f8a]'}`}>{step.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <SideLabel>Practice Modes</SideLabel>
          <SideNavItem icon={Mic} label="Pronunciation drill" active={activeSection === 'drill'} onClick={() => setActiveSection('drill')} badge="Active" badgeColor="#1a56b0" />
          <SideNavItem icon={MessageSquare} label="AI conversation" active={activeSection === 'conversation'} onClick={() => setActiveSection('conversation')} />
          <SideNavItem icon={Headphones} label="Shadowing mode" active={activeSection === 'shadowing'} onClick={() => setActiveSection('shadowing')} />

          <SideLabel>Manage</SideLabel>
          <SideNavItem icon={ClipboardList} label="Assign practice" active={activeSection === 'assign'} onClick={() => setActiveSection('assign')} badge="3" badgeColor="#1a56b0" />
          <SideNavItem icon={BarChart3} label="Student progress" active={activeSection === 'progress'} onClick={() => setActiveSection('progress')} />

          <SideLabel>Library</SideLabel>
          <SideNavItem icon={BookOpen} label="Drill library" active={activeSection === 'library'} onClick={() => setActiveSection('library')} />
          <SideNavItem icon={ScrollText} label="Conversation scripts" active={activeSection === 'scripts'} onClick={() => setActiveSection('scripts')} />
        </div>

        <div className="p-[10px] border-t" style={{ borderColor: '#e8e9eb' }}>
          <Button className="w-full text-[12px] h-8" style={{ backgroundColor: '#0f2044', color: '#fff' }} onClick={() => navigate('/teaching-os/analytics')}>
            Phase 8: Analytics <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white border-b flex items-center justify-between px-4 flex-shrink-0" style={{ borderColor: '#e8e9eb' }}>
          <div className="text-[11px]" style={{ color: '#7a7f8a' }}>
            Teaching OS › <span style={{ color: '#4a5264' }}>{courseName || 'Course'}</span> › <span style={{ color: '#4a5264' }}>{sectionLabel[activeSection]}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-[11px] h-7"><ClipboardList className="w-3 h-3 mr-1" />Assign to students</Button>
            <Button variant="outline" size="sm" className="text-[11px] h-7"><BarChart3 className="w-3 h-3 mr-1" />Export report</Button>
            <Button size="sm" className="text-[11px] h-7" style={{ backgroundColor: '#0f2044', color: '#fff' }} onClick={() => navigate('/teaching-os/analytics')}>
              Phase 8: Analytics <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Center */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeSection === 'drill' && (
              <PronunciationDrill
                phrase={currentPhrase}
                sessionTitle={sessionTitle}
                isRecording={isRecording}
                isProcessing={isProcessing}
                showScore={showScore}
                scores={animatedScores}
                waveformBars={waveformBars}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onNextPhrase={nextPhrase}
              />
            )}
            {activeSection === 'conversation' && (
              <ConversationMode
                messages={chatMessages}
                input={chatInput}
                setInput={setChatInput}
                onSend={sendChat}
                sessionTitle={sessionTitle}
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
              />
            )}
            {activeSection === 'shadowing' && <ShadowingMode phrases={MOCK_PHRASES} />}
            {activeSection === 'assign' && <AssignPractice />}
            {activeSection === 'progress' && <StudentProgress />}
            {activeSection === 'library' && <DrillLibrary />}
            {activeSection === 'scripts' && <ConversationScripts />}
          </div>

          {/* Right panel */}
          <div className="w-[240px] bg-white border-l flex-shrink-0 overflow-y-auto" style={{ borderColor: '#e8e9eb' }}>
            <RightPanel activeSection={activeSection} phrases={MOCK_PHRASES} currentPhraseIdx={currentPhraseIdx} onSelectPhrase={setCurrentPhraseIdx} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar helpers ──────────────────────────────────────
const SideLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-1 mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: '#aab0bc' }}>{children}</div>
);

const SideNavItem: React.FC<{ icon: React.ElementType; label: string; active: boolean; onClick: () => void; badge?: string; badgeColor?: string }> = ({ icon: Icon, label, active, onClick, badge, badgeColor }) => (
  <button onClick={onClick} className="w-full flex items-center gap-2 px-4 py-[7px] text-left transition-colors" style={{
    borderLeft: `3px solid ${active ? '#1a56b0' : 'transparent'}`,
    backgroundColor: active ? '#eef2fa' : 'transparent',
    color: active ? '#0f2044' : '#4a5264',
    fontWeight: active ? 500 : 400, fontSize: '12px',
  }}>
    <Icon className="w-[14px] h-[14px]" style={{ color: active ? '#1a56b0' : '#7a7f8a' }} />
    <span className="flex-1">{label}</span>
    {badge && <span className="text-[10px] px-[6px] py-[1px] rounded-[8px]" style={{ backgroundColor: badgeColor ? `${badgeColor}18` : '#eef2fa', color: badgeColor || '#1a56b0' }}>{badge}</span>}
  </button>
);

// ─── Pronunciation Drill ──────────────────────────────────
const PronunciationDrill: React.FC<{
  phrase: DrillPhrase; sessionTitle: string;
  isRecording: boolean; isProcessing: boolean; showScore: boolean;
  scores: { overall: number; pronunciation: number; fluency: number };
  waveformBars: number[];
  onStartRecording: () => void; onStopRecording: () => void; onNextPhrase: () => void;
}> = ({ phrase, sessionTitle, isRecording, isProcessing, showScore, scores, waveformBars, onStartRecording, onStopRecording, onNextPhrase }) => (
  <div className="max-w-[640px] mx-auto space-y-3">
    {/* Phrase prompt card */}
    <div className="rounded-[10px] p-[13px]" style={{ backgroundColor: '#f0f4ff', border: '0.5px solid #b5d0f8' }}>
      <div className="text-[10px] font-medium uppercase mb-2" style={{ color: '#1a56b0' }}>
        Say this phrase — {sessionTitle || 'Session 2 Vocabulary'}
      </div>
      <div className="text-[26px] font-medium leading-[1.3] mb-2" style={{ color: '#0f2044', direction: 'rtl', textAlign: 'right' }}>
        {phrase.phrase_arabic}
      </div>
      <div className="text-[12px] italic mb-1" style={{ color: '#7a7f8a' }}>{phrase.romanised}</div>
      <div className="text-[12px]" style={{ color: '#4a5264' }}>{phrase.english}</div>
      <div className="flex items-center gap-2 mt-3">
        <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={() => {
          if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(phrase.phrase_arabic);
            u.lang = 'ar'; speechSynthesis.speak(u);
          }
        }}><Volume2 className="w-3 h-3" />Hear model</Button>
        <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={onNextPhrase}><ArrowRight className="w-3 h-3" />Next phrase</Button>
        <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1"><Star className="w-3 h-3" />Harder</Button>
      </div>
    </div>

    {/* Audio recorder */}
    <div className="rounded-[9px] p-[12px] flex items-center gap-3" style={{ backgroundColor: '#0f2044' }}>
      <button
        onClick={isRecording ? onStopRecording : onStartRecording}
        className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor: isProcessing ? '#4a5264' : isRecording ? '#b42a2a' : '#1a56b0',
          animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      >
        {isProcessing ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Mic className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Waveform */}
      <div className="flex-1 flex items-center justify-center gap-[2px] h-[32px]">
        {waveformBars.map((h, i) => (
          <div key={i} className="rounded-[2px] transition-all" style={{
            width: 3, height: h,
            backgroundColor: isRecording ? '#fff' : 'rgba(255,255,255,0.15)',
            transition: 'height 80ms ease',
          }} />
        ))}
      </div>

      <div className="text-[11px] min-w-[100px] text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {isProcessing ? 'Analysing…' : isRecording ? 'Recording…' : showScore ? `Done! Score: ${scores.overall}` : 'Click mic to record'}
      </div>
    </div>

    {/* Score cards */}
    {showScore && (
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Overall score', value: scores.overall },
          { label: 'Pronunciation', value: scores.pronunciation },
          { label: 'Fluency', value: scores.fluency },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-[9px] p-[11px] text-center" style={{ borderColor: '#e8e9eb' }}>
            <div className="text-[24px] font-medium" style={{ color: scoreColor(s.value) }}>{s.value}</div>
            <div className="w-full h-[3px] rounded-full mt-1" style={{ backgroundColor: '#e8e9eb' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${s.value}%`, backgroundColor: scoreColor(s.value) }} />
            </div>
            <div className="text-[10px] mt-1" style={{ color: '#7a7f8a' }}>{s.label}</div>
          </div>
        ))}
      </div>
    )}

    {/* Word-by-word feedback */}
    {showScore && (
      <div className="bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: '#e8e9eb' }}>
        <div className="px-[13px] py-[10px] border-b flex items-center gap-2" style={{ borderColor: '#f0f1f3' }}>
          <span className="text-[10px] font-medium px-2 py-[1px] rounded-full" style={{ backgroundColor: '#eef2fa', color: '#1a56b0' }}>AI feedback</span>
          <span className="text-[12.5px] font-medium" style={{ color: '#0f2044' }}>Word-by-word breakdown</span>
        </div>
        <div className="px-[13px] py-[11px]">
          {/* Arabic word chips */}
          <div className="flex flex-wrap gap-[6px] mb-3" style={{ direction: 'rtl' }}>
            {MOCK_WORD_BREAKDOWN.map((w, i) => {
              const bg = w.status === 'perfect' ? '#e6f4ea' : w.status === 'improve' ? '#fff8e6' : '#fde8e8';
              const color = w.status === 'perfect' ? '#1a7340' : w.status === 'improve' ? '#8a5c00' : '#b42a2a';
              return (
                <span key={i} className="text-[14px] px-[8px] py-[3px] rounded-[6px] font-medium" style={{ backgroundColor: bg, color, border: `0.5px solid ${color}30` }}>
                  {w.arabic}
                </span>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mb-3">
            {[{ icon: '✓', label: 'Perfect', color: '#1a7340' }, { icon: '⚡', label: 'Improve', color: '#8a5c00' }, { icon: '✗', label: 'Retry', color: '#b42a2a' }].map(l => (
              <span key={l.label} className="text-[10px] flex items-center gap-1 font-medium" style={{ color: l.color }}>
                {l.icon} {l.label}
              </span>
            ))}
          </div>

          {/* Feedback rows */}
          <div className="space-y-[6px]">
            {MOCK_WORD_BREAKDOWN.filter(w => w.status !== 'perfect').map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center flex-shrink-0 mt-[1px]" style={{
                  backgroundColor: w.status === 'improve' ? '#fff8e6' : '#fde8e8',
                }}>
                  <span className="text-[10px]" style={{ color: w.status === 'improve' ? '#8a5c00' : '#b42a2a' }}>
                    {w.status === 'improve' ? '⚡' : '✗'}
                  </span>
                </div>
                <div>
                  <span className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{w.arabic}</span>
                  <span className="text-[11px] ml-2" style={{ color: '#4a5264' }}>— {w.correction}</span>
                </div>
              </div>
            ))}
            {/* General feedback */}
            <div className="flex items-start gap-2 pt-2 mt-2 border-t" style={{ borderColor: '#f0f1f3' }}>
              <CheckCircle2 className="w-4 h-4 mt-[1px] flex-shrink-0" style={{ color: '#1a7340' }} />
              <div className="text-[12px]" style={{ color: '#4a5264', lineHeight: 1.5 }}>
                <span className="font-medium" style={{ color: '#0f2044' }}>اسمي</span> and <span className="font-medium" style={{ color: '#0f2044' }}>أحمد</span> — excellent pronunciation, correct stress on first syllable.
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

// ─── AI Conversation Mode ─────────────────────────────────
const ConversationMode: React.FC<{
  messages: { role: string; content: string; arabic?: string; score?: number }[];
  input: string; setInput: (v: string) => void; onSend: () => void;
  sessionTitle: string; isRecording: boolean;
  onStartRecording: () => void; onStopRecording: () => void;
}> = ({ messages, input, setInput, onSend, sessionTitle, isRecording, onStartRecording, onStopRecording }) => (
  <div className="max-w-[640px] mx-auto space-y-3">
    {/* AI persona */}
    <div className="flex items-center gap-3 bg-white border rounded-[10px] p-3" style={{ borderColor: '#e8e9eb' }}>
      <div className="w-[56px] h-[56px] rounded-full flex items-center justify-center relative flex-shrink-0" style={{ backgroundColor: '#eef2fa' }}>
        <MessageSquare className="w-6 h-6" style={{ color: '#1a56b0' }} />
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: '#1a7340' }} />
      </div>
      <div>
        <div className="text-[13px] font-medium" style={{ color: '#0f2044' }}>AI conversation partner</div>
        <div className="text-[11px]" style={{ color: '#7a7f8a' }}>{sessionTitle || 'Session 2 — Introductions'} · Beginner level</div>
      </div>
    </div>

    {/* Chat thread */}
    <div className="bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: '#e8e9eb' }}>
      <div className="h-[360px] overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] rounded-[10px] px-3 py-2" style={{
              backgroundColor: m.role === 'user' ? '#0f2044' : '#f0f4ff',
              color: m.role === 'user' ? '#fff' : '#0f2044',
              border: m.role === 'assistant' ? '0.5px solid #b5d0f8' : undefined,
              borderTopLeftRadius: m.role === 'assistant' ? 2 : undefined,
              borderTopRightRadius: m.role === 'user' ? 2 : undefined,
            }}>
              <div className={`text-[12px] ${localStorage.getItem('tos-language') === 'ur' ? 'lang-ur' : localStorage.getItem('tos-language') === 'ar' ? 'lang-ar' : 'lang-en'}`} style={{ lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: parseArabicTags(m.content) }} />
              {m.score && <span className="text-[10px] mt-1 inline-block px-[5px] py-[1px] rounded" style={{ backgroundColor: `${scoreColor(m.score)}20`, color: scoreColor(m.score) }}>Score: {m.score}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: '#f0f1f3' }}>
        <button onClick={isRecording ? onStopRecording : onStartRecording} className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isRecording ? '#b42a2a' : '#1a56b0' }}>
          <Mic className="w-4 h-4 text-white" />
        </button>
        <Input value={input} onChange={e => setInput(e.target.value)} className="flex-1 text-[12px] h-8 border-0 bg-[#f9f9fb]" placeholder="Type Arabic or English…" onKeyDown={e => e.key === 'Enter' && onSend()} />
        <Button size="sm" className="h-8 w-8 p-0" style={{ backgroundColor: '#0f2044' }} onClick={onSend}><Send className="w-3.5 h-3.5 text-white" /></Button>
      </div>
    </div>
  </div>
);

// ─── Shadowing Mode ───────────────────────────────────────
const ShadowingMode: React.FC<{ phrases: DrillPhrase[] }> = ({ phrases }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<'listen' | 'countdown' | 'record' | 'done'>('listen');
  const [countdown, setCountdown] = useState(3);

  const startShadow = () => {
    setPhase('listen');
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(phrases[activeIdx].phrase_arabic);
      u.lang = 'ar';
      u.onend = () => {
        setPhase('countdown');
        let c = 3;
        const timer = setInterval(() => {
          c--;
          setCountdown(c);
          if (c <= 0) { clearInterval(timer); setPhase('record'); setTimeout(() => { setPhase('done'); }, 3000); }
        }, 800);
      };
      speechSynthesis.speak(u);
    }
  };

  return (
    <div className="max-w-[560px] mx-auto space-y-2">
      {phrases.slice(0, 8).map((p, i) => (
        <div key={p.id} className="flex items-center gap-3 p-[10px] rounded-[10px] transition-all cursor-pointer" style={{
          backgroundColor: i === activeIdx ? '#eef2fa' : '#fff',
          border: `0.5px solid ${i === activeIdx ? '#b5d0f8' : '#e8e9eb'}`,
        }} onClick={() => { setActiveIdx(i); setPhase('listen'); }}>
          <span className="text-[10px] font-medium w-5 text-center" style={{ color: '#aab0bc' }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-medium truncate" style={{ color: '#0f2044', direction: 'rtl' }}>{p.phrase_arabic}</div>
            <div className="text-[10px]" style={{ color: '#7a7f8a' }}>{p.romanised}</div>
          </div>
          <div>
            {p.lastScore ? (
              <span className="text-[10px] font-medium px-[6px] py-[1px] rounded-full" style={{ backgroundColor: `${scoreColor(p.lastScore)}15`, color: scoreColor(p.lastScore) }}>{p.lastScore}%</span>
            ) : (
              <span className="text-[9px] px-[5px] py-[1px] rounded-full bg-[#f4f5f7] text-[#aab0bc]">Pending</span>
            )}
          </div>
        </div>
      ))}

      {/* Active phrase controls */}
      <div className="bg-white border rounded-[10px] p-4 text-center mt-3" style={{ borderColor: '#e8e9eb' }}>
        {phase === 'listen' && (
          <Button onClick={startShadow} className="h-9 text-[12px]" style={{ backgroundColor: '#1a56b0', color: '#fff' }}>
            <Play className="w-3.5 h-3.5 mr-1.5" />Play model
          </Button>
        )}
        {phase === 'countdown' && (
          <div className="flex items-center justify-center gap-2">
            {[3, 2, 1].map(n => (
              <div key={n} className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{
                backgroundColor: countdown >= n ? '#1a56b0' : '#e8e9eb',
                color: countdown >= n ? '#fff' : '#aab0bc',
              }}>{n}</div>
            ))}
            <span className="text-[12px] ml-2" style={{ color: '#0f2044' }}>Now you — record!</span>
          </div>
        )}
        {phase === 'record' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#b42a2a' }} />
            <span className="text-[12px] font-medium" style={{ color: '#b42a2a' }}>Recording…</span>
          </div>
        )}
        {phase === 'done' && (
          <div className="flex items-center justify-center gap-2">
            <Check className="w-4 h-4" style={{ color: '#1a7340' }} />
            <span className="text-[12px] font-medium" style={{ color: '#1a7340' }}>Score: 82% — Great!</span>
            <Button variant="outline" size="sm" className="text-[10px] h-6 ml-2" onClick={() => { setActiveIdx(i => (i + 1) % phrases.length); setPhase('listen'); }}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Assign Practice ──────────────────────────────────────
const AssignPractice: React.FC = () => {
  const assignments = [
    { title: 'Session 2 — Pronunciation Drill', mode: 'drill', due: 'Apr 10, 2026', done: 3, total: 8 },
    { title: 'Greeting Conversation Practice', mode: 'conversation', due: 'Apr 12, 2026', done: 5, total: 8 },
    { title: 'Shadowing — Self Introduction', mode: 'shadow', due: 'Apr 14, 2026', done: 1, total: 8 },
  ];
  const modeIcon: Record<string, React.ElementType> = { drill: Mic, conversation: MessageSquare, shadow: Headphones };

  return (
    <div className="max-w-[600px] mx-auto space-y-3">
      <div className="rounded-[9px] p-3 flex items-center gap-2" style={{ backgroundColor: '#f0f4ff', border: '0.5px solid #b5d0f8' }}>
        <ClipboardList className="w-4 h-4" style={{ color: '#1a56b0' }} />
        <span className="text-[12px]" style={{ color: '#0f2044' }}><strong>3</strong> active assignments · Students practice on their dashboard · AI scores automatically</span>
      </div>
      {assignments.map((a, i) => {
        const Icon = modeIcon[a.mode] || Mic;
        return (
          <div key={i} className="bg-white border rounded-[10px] p-3 flex items-center gap-3" style={{ borderColor: '#e8e9eb' }}>
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: '#eef2fa' }}>
              <Icon className="w-4 h-4" style={{ color: '#1a56b0' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{a.title}</div>
              <div className="text-[10px]" style={{ color: '#7a7f8a' }}>Due {a.due}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium" style={{ color: '#4a5264' }}>{a.done}/{a.total} done</div>
              <div className="w-[50px] h-[3px] rounded-full bg-[#e8e9eb] mt-1">
                <div className="h-full rounded-full" style={{ width: `${(a.done / a.total) * 100}%`, backgroundColor: '#1a7340' }} />
              </div>
            </div>
          </div>
        );
      })}
      <Button variant="outline" className="w-full text-[12px] h-9 border-dashed" style={{ borderColor: '#d0d4dc', color: '#4a5264' }}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />New assignment
      </Button>
    </div>
  );
};

// ─── Student Progress ─────────────────────────────────────
const StudentProgress: React.FC = () => {
  const stats = [
    { label: 'Completed', value: '24', color: '#1a7340' },
    { label: 'Class avg', value: '78%', color: '#1a56b0' },
    { label: 'Top score', value: '96%', color: '#0f2044' },
    { label: 'Most missed', value: 'باكستان', color: '#b42a2a' },
  ];
  const students = [
    { name: 'Aisha Khan', overall: 89, pronunciation: 91, fluency: 85, attempts: 12, last: '2h ago' },
    { name: 'Omar Hassan', overall: 76, pronunciation: 80, fluency: 68, attempts: 8, last: '5h ago' },
    { name: 'Fatima Ali', overall: 82, pronunciation: 85, fluency: 78, attempts: 15, last: '1h ago' },
    { name: 'Yusuf Ahmed', overall: 64, pronunciation: 70, fluency: 55, attempts: 6, last: '1d ago' },
    { name: 'Maryam Siddiq', overall: 91, pronunciation: 94, fluency: 88, attempts: 18, last: '30m ago' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-white border rounded-[10px] p-3" style={{ borderColor: '#e8e9eb' }}>
            <div className="text-[20px] font-medium" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: '#7a7f8a' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-[10px] overflow-hidden" style={{ borderColor: '#e8e9eb' }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b bg-[#fafbfc]" style={{ borderColor: '#f0f1f3' }}>
              {['Student', 'Overall', 'Pronunciation', 'Fluency', 'Attempts', 'Last'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium text-[10px] uppercase" style={{ color: '#7a7f8a' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.name} className="border-b hover:bg-[#f9f9fb]" style={{ borderColor: '#f0f1f3' }}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#eef2fa] flex items-center justify-center text-[8px] font-medium text-[#1a56b0]">{s.name[0]}</div>
                    <span className="font-medium" style={{ color: '#0f2044' }}>{s.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-medium" style={{ color: scoreColor(s.overall) }}>{s.overall}%</td>
                <td className="px-3 py-2" style={{ color: scoreColor(s.pronunciation) }}>{s.pronunciation}%</td>
                <td className="px-3 py-2" style={{ color: scoreColor(s.fluency) }}>{s.fluency}%</td>
                <td className="px-3 py-2" style={{ color: '#4a5264' }}>{s.attempts}</td>
                <td className="px-3 py-2" style={{ color: '#7a7f8a' }}>{s.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Word heatmap */}
      <div className="bg-white border rounded-[10px] p-3" style={{ borderColor: '#e8e9eb' }}>
        <div className="text-[12px] font-medium mb-2" style={{ color: '#0f2044' }}>Class word mastery heatmap</div>
        <div className="flex flex-wrap gap-[5px]">
          {MOCK_PHRASES.map(p => {
            const avg = p.lastScore || 50;
            return (
              <span key={p.id} className="text-[11px] font-medium px-[7px] py-[3px] rounded-[6px] cursor-pointer" style={{
                backgroundColor: `${scoreColor(avg)}15`,
                color: scoreColor(avg),
                border: `0.5px solid ${scoreColor(avg)}30`,
              }}>{p.phrase_arabic}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Drill Library ────────────────────────────────────────
const DrillLibrary: React.FC = () => {
  const sets = [
    { title: 'Greetings & Salutations', count: 12, level: 'Beginner', color: '#1a7340', sample: 'السلام عليكم' },
    { title: 'Numbers 1-20', count: 20, level: 'Beginner', color: '#1a56b0', sample: 'واحد' },
    { title: 'Family Members', count: 15, level: 'Beginner', color: '#8a5c00', sample: 'أب' },
    { title: 'Daily Routines', count: 10, level: 'Intermediate', color: '#534AB7', sample: 'أستيقظ' },
    { title: 'Islamic Phrases', count: 18, level: 'All levels', color: '#1a7340', sample: 'بسم الله' },
    { title: 'Food & Drink', count: 14, level: 'Beginner', color: '#b42a2a', sample: 'ماء' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {sets.map((s, i) => (
          <div key={i} className="bg-white border rounded-[10px] overflow-hidden cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: '#e8e9eb' }}>
            <div className="h-[6px]" style={{ backgroundColor: s.color }} />
            <div className="p-3">
              <div className="text-[18px] mb-1" style={{ color: '#0f2044', direction: 'rtl', textAlign: 'center' }}>{s.sample}</div>
              <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{s.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px]" style={{ color: '#7a7f8a' }}>{s.count} phrases</span>
                <span className="text-[9px] px-[5px] py-[1px] rounded-full" style={{ backgroundColor: `${s.color}15`, color: s.color }}>{s.level}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full text-[12px] h-9 border-dashed" style={{ borderColor: '#d0d4dc', color: '#4a5264' }}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />Create custom drill
      </Button>
    </div>
  );
};

// ─── Conversation Scripts ─────────────────────────────────
const ConversationScripts: React.FC = () => {
  const scripts = [
    { title: 'Meeting at the Masjid', speakers: 2, lines: 8, level: 'Beginner' },
    { title: 'At the Market', speakers: 2, lines: 6, level: 'Beginner' },
    { title: 'Visiting a Friend', speakers: 2, lines: 10, level: 'Intermediate' },
    { title: 'First Day at School', speakers: 3, lines: 12, level: 'Beginner' },
  ];

  return (
    <div className="max-w-[560px] mx-auto space-y-2">
      {scripts.map((s, i) => (
        <div key={i} className="bg-white border rounded-[10px] p-3 flex items-center gap-3" style={{ borderColor: '#e8e9eb' }}>
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: '#eef2fa' }}>
            <ScrollText className="w-4 h-4" style={{ color: '#1a56b0' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium" style={{ color: '#0f2044' }}>{s.title}</div>
            <div className="text-[10px]" style={{ color: '#7a7f8a' }}>{s.speakers} speakers · {s.lines} lines · {s.level}</div>
          </div>
          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2">Use in AI chat</Button>
        </div>
      ))}
      <Button variant="outline" className="w-full text-[12px] h-9 border-dashed" style={{ borderColor: '#d0d4dc', color: '#4a5264' }}>
        <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate new script
      </Button>
    </div>
  );
};

// ─── Right Panel ──────────────────────────────────────────
const RightPanel: React.FC<{ activeSection: Section; phrases: DrillPhrase[]; currentPhraseIdx: number; onSelectPhrase: (i: number) => void }> = ({ activeSection, phrases, currentPhraseIdx, onSelectPhrase }) => (
  <div className="p-3">
    {activeSection === 'drill' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Session phrases</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>{phrases.length} practice items</div>
        <div className="space-y-[3px]">
          {phrases.map((p, i) => (
            <button key={p.id} onClick={() => onSelectPhrase(i)} className="w-full flex items-center gap-2 p-[6px] rounded-[6px] text-left transition-colors" style={{
              backgroundColor: i === currentPhraseIdx ? '#eef2fa' : 'transparent',
            }}>
              <span className="flex-1 min-w-0">
                <div className="text-[11px] truncate" style={{ color: '#0f2044', direction: 'rtl' }}>{p.phrase_arabic}</div>
                <div className="text-[9px] truncate" style={{ color: '#7a7f8a' }}>{p.english}</div>
              </span>
              {p.lastScore ? (
                <span className="text-[10px] font-medium" style={{ color: scoreColor(p.lastScore) }}>{p.lastScore}%</span>
              ) : (
                <span className="text-[9px]" style={{ color: '#aab0bc' }}>—</span>
              )}
            </button>
          ))}
        </div>
      </>
    )}
    {activeSection === 'conversation' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Vocabulary used</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>Track session words in conversation</div>
        <div className="flex flex-wrap gap-[4px]">
          {phrases.slice(0, 8).map((p, i) => (
            <span key={p.id} className="text-[10px] px-[6px] py-[2px] rounded-[5px]" style={{
              backgroundColor: i < 3 ? '#e6f4ea' : '#f4f5f7',
              color: i < 3 ? '#1a7340' : '#aab0bc',
              border: `0.5px solid ${i < 3 ? '#86c7a030' : '#e8e9eb'}`,
            }}>{p.phrase_arabic}</span>
          ))}
        </div>
        <div className="mt-3 text-[11px]" style={{ color: '#7a7f8a' }}>3 of {phrases.length} words used</div>
        <div className="w-full h-[3px] rounded-full bg-[#e8e9eb] mt-1">
          <div className="h-full rounded-full" style={{ width: '37.5%', backgroundColor: '#1a7340' }} />
        </div>
      </>
    )}
    {activeSection === 'shadowing' && (
      <>
        <div className="text-[12px] font-medium mb-1" style={{ color: '#0f2044' }}>Session progress</div>
        <div className="text-[11px] mb-3" style={{ color: '#7a7f8a' }}>3 of 8 phrases mastered</div>
        <div className="w-full h-[4px] rounded-full bg-[#e8e9eb] mb-3">
          <div className="h-full rounded-full" style={{ width: '37.5%', backgroundColor: '#1a7340' }} />
        </div>
        <div className="bg-[#fff8e6] border border-[#e8d980] rounded-[8px] p-[9px]">
          <div className="text-[11px] font-medium" style={{ color: '#8a5c00' }}>🔥 Streak: 3</div>
          <div className="text-[10px] mt-[2px]" style={{ color: '#8a5c00' }}>3 consecutive phrases scored ≥ 80%</div>
        </div>
      </>
    )}
    {(activeSection !== 'drill' && activeSection !== 'conversation' && activeSection !== 'shadowing') && (
      <div className="text-center py-6"><div className="text-[11px]" style={{ color: '#aab0bc' }}>Context panel</div></div>
    )}
  </div>
);

export default TeachingOSSpeakingTutor;
