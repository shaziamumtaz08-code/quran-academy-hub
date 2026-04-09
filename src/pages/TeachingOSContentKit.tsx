import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NavRail, buildRailNav } from "@/components/layout/NavRail";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Star, ChevronRight, Download, Share2, Presentation, HelpCircle,
  BookOpen, Layers, FileText, Upload, FolderOpen, LayoutTemplate,
  Loader2, Square, Check, Sparkles, Printer, Shuffle, ArrowLeft,
  ArrowRight, X
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PhaseStepperCompact, PhaseBreadcrumb } from '@/components/teaching/PhaseNavBar';

// ─── Types ────────────────────────────────────────────
interface Activity {
  phase: string;
  title: string;
  description: string;
  durationMinutes: number;
  activityType: string;
  materials?: string;
}

interface SessionPlan {
  id: string;
  syllabus_id: string;
  week_number: number;
  session_number: number;
  session_title: string;
  session_objective: string;
  total_minutes: number;
  activities: Activity[];
  teacher_notes?: string;
}

interface SlideData {
  id?: string;
  activityIndex: number;
  phase: string;
  layoutType: string;
  title: string;
  arabicText?: string | null;
  transliteration?: string | null;
  bullets: string[];
  teacherNote?: string | null;
  activityInstruction?: string | null;
}

interface QuizQuestion {
  id?: string;
  type: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  bloomsLevel: string;
}

interface Flashcard {
  id?: string;
  arabic: string;
  english: string;
  transliteration: string;
  partOfSpeech: string;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
}

interface WorksheetExercise {
  type: string;
  title: string;
  instructions: string;
  items: { question: string; answer: string; blankedSentence?: string | null }[];
}

type ActiveTool = "slides" | "quiz" | "flashcards" | "worksheet" | "materials" | "templates" | "upload";

// ─── Helpers ──────────────────────────────────────────
const phaseColors: Record<string, { bg: string; text: string }> = {
  Opening: { bg: "bg-blue-50", text: "text-blue-700" },
  Input: { bg: "bg-green-50", text: "text-green-700" },
  Practice: { bg: "bg-amber-50", text: "text-amber-700" },
  Production: { bg: "bg-purple-50", text: "text-purple-700" },
  "Wrap-up": { bg: "bg-red-50", text: "text-red-700" },
  Quiz: { bg: "bg-red-50", text: "text-red-700" },
};

function getPhaseStyle(phase: string) {
  return phaseColors[phase] || { bg: "bg-gray-50", text: "text-gray-600" };
}

async function streamAIContent(
  contentType: string,
  sessionPlan: any,
  courseName: string,
  subject: string,
  level: string,
  extraParams: Record<string, any> = {},
  onChunk: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content-kit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ contentType, sessionPlan, courseName, subject, level, language: localStorage.getItem('tos-language') || 'en', ...extraParams }),
      signal: abortSignal,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Generation failed" }));
    throw new Error(err.error || "Generation failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const j = JSON.parse(payload);
        const token = j.choices?.[0]?.delta?.content || "";
        if (token) {
          full += token;
          onChunk(full);
        }
      } catch {}
    }
  }
  return full;
}

function parseJSONFromStream(raw: string): any {
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  // Strip [ARABIC]...[/ARABIC] tags that break JSON
  cleaned = cleaned.replace(/\[ARABIC\]\s*([\s\S]*?)\s*\[\/ARABIC\]/gi, "$1");
  cleaned = cleaned.replace(/\[\/?ARABIC\]/gi, "");
  cleaned = cleaned.trim();
  
  const startArr = cleaned.indexOf("[");
  const startObj = cleaned.indexOf("{");
  const start = startArr >= 0 && (startArr < startObj || startObj < 0) ? startArr : startObj;
  if (start < 0) return null;
  cleaned = cleaned.slice(start);
  const endArr = cleaned.lastIndexOf("]");
  const endObj = cleaned.lastIndexOf("}");
  const end = Math.max(endArr, endObj);
  if (end < 0) return null;
  cleaned = cleaned.slice(0, end + 1);
  
  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  
  try { return JSON.parse(cleaned); } catch (e) {
    console.error("JSON parse failed:", e, "Raw (first 500):", cleaned.slice(0, 500));
    return null;
  }
}

// ─── Main Component ──────────────────────────────────
const TeachingOSContentKit: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const railItems = buildRailNav(activeRole);
  const sessionId = searchParams.get("session_id");

  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null);
  const [courseName, setCourseName] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<ActiveTool>("slides");

  // Content state
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [worksheetExercises, setWorksheetExercises] = useState<WorksheetExercise[]>([]);
  const [worksheetTitle, setWorksheetTitle] = useState("");

  // Generation state
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [genProgress, setGenProgress] = useState<Record<string, string>>({});
  const [kitId, setKitId] = useState<string | null>(null);

  // UI state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAnswers, setShowAnswers] = useState(true);
  const [studyMode, setStudyMode] = useState(false);
  const [studyCardIndex, setStudyCardIndex] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Load session plan
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      setLoading(true);
      const { data: sp } = await supabase
        .from("session_plans")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (!sp) { setLoading(false); return; }

      const activities = Array.isArray(sp.activities)
        ? (sp.activities as any[]).map(a => ({
            phase: a.phase || "Input",
            title: a.title || "",
            description: a.description || "",
            durationMinutes: a.durationMinutes || 10,
            activityType: a.activityType || "teacher-led",
            materials: a.materials,
          }))
        : [];

      setSessionPlan({ ...sp, activities } as any);

      // Load syllabus for course info
      if (sp.syllabus_id) {
        const { data: syl } = await supabase
          .from("syllabi")
          .select("course_name, subject, level")
          .eq("id", sp.syllabus_id)
          .single();
        if (syl) {
          setCourseName(syl.course_name || "");
          setSubject(syl.subject || "");
          setLevel(syl.level || "");
        }
      }

      // Load existing kit
      const { data: kits } = await supabase
        .from("content_kits")
        .select("id")
        .eq("session_plan_id", sp.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (kits && kits.length > 0) {
        const kid = kits[0].id;
        setKitId(kid);
        await loadExistingContent(kid);
      }

      setLoading(false);
    })();
  }, [sessionId]);

  const loadExistingContent = async (kid: string) => {
    const [slidesRes, quizRes, flashRes, worksheetRes] = await Promise.all([
      supabase.from("slides").select("*").eq("kit_id", kid).order("slide_index"),
      supabase.from("quiz_questions").select("*").eq("kit_id", kid).order("question_index"),
      supabase.from("flashcards").select("*").eq("kit_id", kid).order("card_index"),
      supabase.from("worksheets").select("*").eq("kit_id", kid).limit(1),
    ]);

    if (slidesRes.data?.length) {
      setSlides(slidesRes.data.map((s: any) => ({
        id: s.id, activityIndex: s.slide_index, phase: s.phase || "",
        layoutType: s.layout_type || "title-bullets", title: s.title || "",
        arabicText: s.arabic_text, transliteration: s.transliteration,
        bullets: (s.bullets as any) || [], teacherNote: s.teacher_note,
        activityInstruction: s.activity_instruction,
      })));
    }
    if (quizRes.data?.length) {
      setQuizQuestions(quizRes.data.map((q: any) => ({
        id: q.id, type: q.type, question: q.question,
        options: q.options as any, correctAnswer: q.correct_answer || "",
        explanation: q.explanation || "", difficulty: q.difficulty || "medium",
        bloomsLevel: q.blooms_level || "remember",
      })));
    }
    if (flashRes.data?.length) {
      setFlashcards(flashRes.data.map((f: any) => ({
        id: f.id, arabic: f.arabic, english: f.english,
        transliteration: f.transliteration || "", partOfSpeech: f.part_of_speech || "",
        exampleSentence: f.example_sentence, exampleTranslation: f.example_translation,
      })));
    }
    if (worksheetRes.data?.length) {
      const w = worksheetRes.data[0];
      setWorksheetTitle(w.title || "");
      setWorksheetExercises((w.exercises as any) || []);
    }
  };

  // ─── Generate content ────────────────────────────────
  const generateContent = useCallback(async (type: ActiveTool) => {
    if (!sessionPlan || generating[type]) return;

    setGenerating(prev => ({ ...prev, [type]: true }));
    setGenProgress(prev => ({ ...prev, [type]: `Generating ${type}...` }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const raw = await streamAIContent(
        type, sessionPlan, courseName, subject, level,
        type === "quiz" ? { questionCount: 10, questionTypes: ["mcq", "short_answer", "true_false"], difficulty: "Mixed" } : {},
        (text) => setGenProgress(prev => ({ ...prev, [type]: `Streaming ${type}...` })),
        abort.signal
      );

      const parsed = parseJSONFromStream(raw);
      if (!parsed) throw new Error("Failed to parse AI response");

      // Ensure kit exists
      let currentKitId = kitId;
      if (!currentKitId) {
        const { data: newKit } = await supabase
          .from("content_kits")
          .insert({ session_plan_id: sessionPlan.id, status: "generating" })
          .select("id")
          .single();
        if (newKit) { currentKitId = newKit.id; setKitId(newKit.id); }
      }
      if (!currentKitId) throw new Error("Failed to create kit");

      // Save based on type
      if (type === "slides" && Array.isArray(parsed)) {
        await supabase.from("slides").delete().eq("kit_id", currentKitId);
        const rows = parsed.map((s: any, i: number) => ({
          kit_id: currentKitId, slide_index: i, phase: s.phase || "",
          layout_type: s.layoutType || "title-bullets", title: s.title || "",
          arabic_text: s.arabicText, transliteration: s.transliteration,
          bullets: s.bullets || [], teacher_note: s.teacherNote,
          activity_instruction: s.activityInstruction,
        }));
        await supabase.from("slides").insert(rows);
        setSlides(parsed.map((s: any, i: number) => ({ ...s, activityIndex: i })));
      } else if (type === "quiz" && Array.isArray(parsed)) {
        await supabase.from("quiz_questions").delete().eq("kit_id", currentKitId);
        const rows = parsed.map((q: any, i: number) => ({
          kit_id: currentKitId, question_index: i, type: q.type || "mcq",
          question: q.question, options: q.options, correct_answer: q.correctAnswer,
          explanation: q.explanation, difficulty: q.difficulty || "medium",
          blooms_level: q.bloomsLevel || "remember",
        }));
        await supabase.from("quiz_questions").insert(rows);
        setQuizQuestions(parsed);
      } else if (type === "flashcards" && Array.isArray(parsed)) {
        await supabase.from("flashcards").delete().eq("kit_id", currentKitId);
        const rows = parsed.map((f: any, i: number) => ({
          kit_id: currentKitId, card_index: i, arabic: f.arabic,
          english: f.english, transliteration: f.transliteration || "",
          part_of_speech: f.partOfSpeech || "", example_sentence: f.exampleSentence,
          example_translation: f.exampleTranslation,
        }));
        await supabase.from("flashcards").insert(rows);
        setFlashcards(parsed);
      } else if (type === "worksheet" && parsed.exercises) {
        await supabase.from("worksheets").delete().eq("kit_id", currentKitId);
        await supabase.from("worksheets").insert({
          kit_id: currentKitId, title: parsed.title || sessionPlan.session_title,
          exercises: parsed.exercises,
        });
        setWorksheetTitle(parsed.title || "");
        setWorksheetExercises(parsed.exercises);
      }

      await supabase.from("content_kits").update({ status: "ready", generated_at: new Date().toISOString() }).eq("id", currentKitId);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} generated successfully`);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message || `Failed to generate ${type}`);
      }
    } finally {
      setGenerating(prev => ({ ...prev, [type]: false }));
      setGenProgress(prev => { const n = { ...prev }; delete n[type]; return n; });
    }
  }, [sessionPlan, courseName, subject, level, kitId, generating]);

  const generateFullKit = useCallback(async () => {
    const types: ActiveTool[] = ["slides", "quiz", "flashcards", "worksheet"];
    await Promise.allSettled(types.map(t => generateContent(t)));
    toast.success("Full kit generation complete!");
  }, [generateContent]);

  // ─── Tool sidebar items ─────────────────────────────
  const toolItems: { key: ActiveTool; label: string; icon: React.ReactNode; count?: number; section: string }[] = [
    { key: "slides", label: "Slides", icon: <Presentation className="w-4 h-4" />, count: slides.length, section: "GENERATE" },
    { key: "quiz", label: "Quiz", icon: <HelpCircle className="w-4 h-4" />, count: quizQuestions.length, section: "GENERATE" },
    { key: "flashcards", label: "Flashcards", icon: <Layers className="w-4 h-4" />, count: flashcards.length, section: "GENERATE" },
    { key: "worksheet", label: "Worksheet", icon: <FileText className="w-4 h-4" />, count: worksheetExercises.length > 0 ? 1 : 0, section: "GENERATE" },
    { key: "materials", label: "All materials", icon: <FolderOpen className="w-4 h-4" />, section: "LIBRARY" },
    { key: "templates", label: "Templates", icon: <LayoutTemplate className="w-4 h-4" />, section: "LIBRARY" },
    { key: "upload", label: "Upload file", icon: <Upload className="w-4 h-4" />, section: "LIBRARY" },
  ];

  const genBarInfo: Record<string, { title: string; desc: string }> = {
    slides: { title: "AI slide deck generator", desc: `${sessionPlan?.activities?.length || 0} activities → ${slides.length || "?"} slides auto-generated from session plan` },
    quiz: { title: "AI quiz generator", desc: `${quizQuestions.length} questions · MCQ + short answer from session objectives` },
    flashcards: { title: "AI flashcard generator", desc: `Arabic terms from this session with transliteration` },
    worksheet: { title: "AI worksheet generator", desc: `Printable exercises aligned to session objectives` },
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <NavRail items={railItems} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const currentSlide = slides[activeSlideIndex];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f5f7]">
      <NavRail items={railItems} />

      {/* Tool Sidebar */}
      <div className="w-[200px] bg-white border-r border-[#e8e9eb] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-[#e8e9eb]">
          <div className="text-[13px] font-medium text-[#0f2044]">Content kit</div>
          <div className="text-[11px] text-[#7a7f8a]">Session {sessionPlan?.session_number} · Week {sessionPlan?.week_number}</div>
          {/* Phase stepper */}
          <PhaseStepperCompact currentPhase={4} sessionId={sessionId} syllabusId={sessionPlan?.syllabus_id} />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {["GENERATE", "LIBRARY"].map(section => (
            <div key={section}>
              <div className="px-3.5 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium">{section}</div>
              {toolItems.filter(t => t.section === section).map(item => (
                <button
                  key={item.key}
                  onClick={() => setActiveTool(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12px] border-l-[3px] transition-colors ${
                    activeTool === item.key
                      ? "border-l-[#1a56b0] bg-[#eef2fa] text-[#0f2044] font-medium"
                      : "border-l-transparent text-[#4a5264] hover:bg-[#f9f9fb]"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.count != null && item.count > 0 && (
                    <span className="text-[10px] bg-[#eef2fa] text-[#1a56b0] px-1.5 py-0.5 rounded-lg font-medium">
                      {item.count}
                    </span>
                  )}
                  {generating[item.key] && <Loader2 className="w-3 h-3 animate-spin text-[#1a56b0]" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#e8e9eb]">
          <Button
            onClick={generateFullKit}
            disabled={Object.values(generating).some(Boolean)}
            className="w-full bg-[#0f2044] hover:bg-[#1a2d5a] text-white text-[12px] gap-1.5"
            size="sm"
          >
            {Object.values(generating).some(Boolean) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            Generate full kit
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 bg-white border-b border-[#e8e9eb] flex items-center px-4 gap-3 shrink-0">
          <div className="flex-1 text-[11px] text-[#7a7f8a]">
            <PhaseBreadcrumb courseName={courseName} sectionLabel={`Session ${sessionPlan?.session_number} · Content Kit`} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[11px] gap-1 h-7 border-[#d0d4dc]">
                <Download className="w-3 h-3" /> Export all
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportAsCSV()}>Export slides as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportQuizAsCSV()}>Export quiz as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("PDF export coming soon")}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="text-[11px] gap-1 h-7 border-[#d0d4dc]" onClick={() => setShowShareModal(true)}>
            <Share2 className="w-3 h-3" /> Share to students
          </Button>

         <Button size="sm" className="text-[11px] gap-1 h-7 bg-[#0f2044] hover:bg-[#1a2d5a]" onClick={() => navigate(`/teaching-os/assessment?session_id=${sessionId}`)}>
           Phase 5: Assessment <ChevronRight className="w-3 h-3" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center */}
          <div className="flex-1 overflow-y-auto p-3.5">
            {/* Generator bar */}
            {["slides", "quiz", "flashcards", "worksheet"].includes(activeTool) && (
              <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[9px] p-3 flex items-center gap-3 mb-3">
                <div className="w-[30px] h-[30px] rounded-lg bg-[#1a56b0] flex items-center justify-center shrink-0">
                  <Star className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[#0f2044]">{genBarInfo[activeTool]?.title}</div>
                  <div className="text-[11px] text-[#7a7f8a]">{genBarInfo[activeTool]?.desc}</div>
                </div>
                <Button
                  size="sm"
                  className="text-[11px] h-7 bg-[#0f2044] hover:bg-[#1a2d5a]"
                  onClick={() => generateContent(activeTool)}
                  disabled={generating[activeTool]}
                >
                  {generating[activeTool] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {generating[activeTool] ? "Generating..." : slides.length > 0 || quizQuestions.length > 0 || flashcards.length > 0 || worksheetExercises.length > 0 ? "Regenerate all" : "Generate"}
                </Button>
              </div>
            )}

            {/* Generation progress */}
            {Object.keys(genProgress).length > 0 && (
              <div className="bg-[#fff8e6] border border-[#e8d980] rounded-lg p-2.5 mb-3 flex items-center gap-2 text-[11px]">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                <span className="text-[#8a5c00] flex-1">{Object.values(genProgress).join(" · ")}</span>
                <button onClick={() => abortRef.current?.abort()} className="text-[#b42a2a] text-[10px]">Stop</button>
              </div>
            )}

            {/* SLIDES VIEW */}
            {activeTool === "slides" && (
              slides.length === 0 ? (
                <EmptyState icon={<Presentation className="w-9 h-9 stroke-[#d0d4dc]" />} title="No slides yet" sub="Generate slides from your session activities" onGenerate={() => generateContent("slides")} generating={generating.slides} />
              ) : (
                <div>
                  {/* Slide canvas */}
                  <div className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden mb-3">
                    <div className="aspect-video p-6 flex flex-col justify-center relative" style={{ minHeight: 320 }}>
                      {currentSlide && <SlideContent slide={currentSlide} />}
                    </div>
                    <div className="px-3 py-2 bg-[#f4f5f7] border-t border-[#e8e9eb] flex items-center justify-between">
                      <span className="text-[10px] text-[#aab0bc]">Slide {activeSlideIndex + 1} of {slides.length} · {currentSlide?.phase}</span>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={() => generateContent("slides")} disabled={generating.slides}>
                          <Sparkles className="w-3 h-3 mr-1" /> AI regen
                        </Button>
                      </div>
                    </div>
                  </div>
                  {/* Slide nav */}
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" className="h-7" disabled={activeSlideIndex === 0} onClick={() => setActiveSlideIndex(i => i - 1)}>
                      <ArrowLeft className="w-3 h-3" />
                    </Button>
                    <span className="text-[11px] text-[#7a7f8a]">{activeSlideIndex + 1} / {slides.length}</span>
                    <Button variant="outline" size="sm" className="h-7" disabled={activeSlideIndex === slides.length - 1} onClick={() => setActiveSlideIndex(i => i + 1)}>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )
            )}

            {/* QUIZ VIEW */}
            {activeTool === "quiz" && (
              quizQuestions.length === 0 ? (
                <EmptyState icon={<HelpCircle className="w-9 h-9 stroke-[#d0d4dc]" />} title="No quiz questions" sub="Generate quiz from session objectives" onGenerate={() => generateContent("quiz")} generating={generating.quiz} />
              ) : (
                <div className="space-y-2">
                  {quizQuestions.map((q, i) => (
                    <QuizCard key={i} q={q} index={i} total={quizQuestions.length} showAnswer={showAnswers} />
                  ))}
                </div>
              )
            )}

            {/* FLASHCARDS VIEW */}
            {activeTool === "flashcards" && (
              flashcards.length === 0 ? (
                <EmptyState icon={<Layers className="w-9 h-9 stroke-[#d0d4dc]" />} title="No flashcards" sub="Generate Arabic vocabulary from session" onGenerate={() => generateContent("flashcards")} generating={generating.flashcards} />
              ) : studyMode ? (
                <StudyMode cards={flashcards} index={studyCardIndex} flipped={studyFlipped}
                  onFlip={() => setStudyFlipped(!studyFlipped)}
                  onNext={() => { setStudyCardIndex(i => Math.min(i + 1, flashcards.length - 1)); setStudyFlipped(false); }}
                  onPrev={() => { setStudyCardIndex(i => Math.max(i - 1, 0)); setStudyFlipped(false); }}
                  onShuffle={() => { setFlashcards([...flashcards].sort(() => Math.random() - 0.5)); setStudyCardIndex(0); setStudyFlipped(false); }}
                  onExit={() => setStudyMode(false)}
                />
              ) : (
                <div>
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => { setStudyMode(true); setStudyCardIndex(0); setStudyFlipped(false); }}>
                      <BookOpen className="w-3 h-3 mr-1" /> Study mode
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {flashcards.map((f, i) => <FlashcardItem key={i} card={f} />)}
                  </div>
                </div>
              )
            )}

            {/* WORKSHEET VIEW */}
            {activeTool === "worksheet" && (
              worksheetExercises.length === 0 ? (
                <EmptyState icon={<FileText className="w-9 h-9 stroke-[#d0d4dc]" />} title="No worksheet" sub="Generate printable exercises" onGenerate={() => generateContent("worksheet")} generating={generating.worksheet} />
              ) : (
                <div className="max-w-[640px] mx-auto">
                  <div className="flex justify-end gap-2 mb-2">
                    <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => window.print()}>
                      <Printer className="w-3 h-3 mr-1" /> Print
                    </Button>
                  </div>
                  <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-5">
                    <div className="text-center mb-4">
                      <div className="text-[15px] font-medium text-[#0f2044]">{courseName} — {worksheetTitle || sessionPlan?.session_title}</div>
                      <div className="text-[11px] text-[#7a7f8a]">{level} · {subject}</div>
                      <div className="mt-2 text-right text-[12px] text-[#4a5264]">Name: _________________________</div>
                    </div>
                    {worksheetExercises.map((ex, i) => (
                      <div key={i} className="mb-5">
                        <div className="text-[13px] font-medium text-[#0f2044] mb-1">Exercise {i + 1}: {ex.title}</div>
                        <div className="text-[11px] text-[#7a7f8a] italic mb-2">{ex.instructions}</div>
                        {ex.items.map((item, j) => (
                          <div key={j} className="mb-2 pl-3">
                            <div className="text-[12px] text-[#0f2044]">{j + 1}. {item.blankedSentence || item.question}</div>
                            {showAnswers && item.answer && (
                              <div className="text-[10px] text-green-700 mt-0.5">Answer: {item.answer}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <button onClick={() => setShowAnswers(!showAnswers)} className="text-[10px] text-[#1a56b0] underline">
                      {showAnswers ? "Hide answers" : "Show answer key"}
                    </button>
                  </div>
                </div>
              )
            )}

            {/* LIBRARY placeholders */}
            {["materials", "templates", "upload"].includes(activeTool) && (
              <EmptyState icon={<FolderOpen className="w-9 h-9 stroke-[#d0d4dc]" />} title={`${activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}`} sub="Coming soon" />
            )}
          </div>

          {/* Right Panel */}
          <div className="w-[240px] bg-white border-l border-[#e8e9eb] flex flex-col shrink-0">
            <div className="p-3 border-b border-[#e8e9eb]">
              <div className="text-[12px] font-medium text-[#0f2044]">
                {activeTool === "slides" ? "Slide deck" : activeTool === "quiz" ? "Questions" : activeTool === "flashcards" ? "Cards" : "Exercises"}
              </div>
              <div className="text-[11px] text-[#7a7f8a]">
                {activeTool === "slides" ? `${slides.length} slides generated` : activeTool === "quiz" ? `${quizQuestions.length} questions` : activeTool === "flashcards" ? `${flashcards.length} cards` : `${worksheetExercises.length} exercises`}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeTool === "slides" && slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlideIndex(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] transition-colors ${
                    i === activeSlideIndex ? "bg-[#eef2fa]" : "hover:bg-[#f9f9fb]"
                  }`}
                >
                  <span className="text-[10px] font-medium text-[#aab0bc] w-4">{i + 1}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${getPhaseStyle(s.phase).bg} ${getPhaseStyle(s.phase).text}`}>{s.phase?.split("-")[0]}</span>
                  <span className="text-[11px] text-[#0f2044] truncate flex-1">{s.title}</span>
                </button>
              ))}
              {activeTool === "quiz" && quizQuestions.map((q, i) => (
                <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                  <span className="text-[10px] font-medium text-[#aab0bc]">Q{i + 1}</span>
                  <span className="text-[11px] text-[#0f2044] truncate flex-1">{q.question.slice(0, 40)}…</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${q.difficulty === "easy" ? "bg-green-500" : q.difficulty === "hard" ? "bg-red-500" : "bg-amber-500"}`} />
                </button>
              ))}
              {activeTool === "flashcards" && flashcards.map((f, i) => (
                <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                  <span className="text-[12px] text-[#0f2044] font-medium" dir="rtl">{f.arabic}</span>
                  <span className="text-[10px] text-[#7a7f8a] flex-1 truncate">{f.english}</span>
                </button>
              ))}
              {activeTool === "worksheet" && worksheetExercises.map((ex, i) => (
                <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                  <span className="text-[10px] font-medium text-[#aab0bc]">{i + 1}</span>
                  <span className="text-[11px] text-[#0f2044] truncate flex-1">{ex.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal open={showShareModal} onClose={() => setShowShareModal(false)} kitId={kitId} />
    </div>
  );

  function exportAsCSV() {
    if (!slides.length) return;
    const csv = "Slide,Phase,Title,Bullets\n" + slides.map((s, i) => `${i + 1},"${s.phase}","${s.title}","${(s.bullets || []).join("; ")}"`).join("\n");
    downloadFile(csv, `${courseName}-slides.csv`, "text/csv");
  }

  function exportQuizAsCSV() {
    if (!quizQuestions.length) return;
    const csv = "Q#,Type,Question,Answer,Difficulty\n" + quizQuestions.map((q, i) => `${i + 1},"${q.type}","${q.question}","${q.correctAnswer}","${q.difficulty}"`).join("\n");
    downloadFile(csv, `${courseName}-quiz.csv`, "text/csv");
  }
};

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────

function EmptyState({ icon, title, sub, onGenerate, generating }: { icon: React.ReactNode; title: string; sub: string; onGenerate?: () => void; generating?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon}
      <div className="text-[14px] text-[#7a7f8a] mt-3">{title}</div>
      <div className="text-[12px] text-[#aab0bc] mt-1">{sub}</div>
      {onGenerate && (
        <Button size="sm" className="mt-4 bg-[#0f2044] hover:bg-[#1a2d5a] text-[12px]" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Star className="w-3 h-3 mr-1" />}
          Generate with AI
        </Button>
      )}
    </div>
  );
}

function SlideContent({ slide }: { slide: SlideData }) {
  const ps = getPhaseStyle(slide.phase);
  return (
    <div className="flex flex-col gap-3">
      <span className={`text-[9px] uppercase tracking-wider font-medium ${ps.text}`}>{slide.phase} · Session</span>
      <div className="text-[20px] font-medium text-[#0f2044] leading-tight">{slide.title}</div>
      {slide.arabicText && (
        <div className="text-[28px] text-[#0f2044] text-center my-2" dir="rtl">{slide.arabicText}</div>
      )}
      {slide.transliteration && (
        <div className="text-[13px] text-[#7a7f8a] italic text-center">{slide.transliteration}</div>
      )}
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className="space-y-1.5 mt-2">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-[#4a5264]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1a56b0] mt-1.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
      {slide.activityInstruction && (
        <div className="mt-2 p-2.5 bg-[#f9f9fb] rounded-lg border-l-[3px] border-[#d0d4dc] text-[11px] text-[#7a7f8a]">
          {slide.activityInstruction}
        </div>
      )}
    </div>
  );
}

function QuizCard({ q, index, total, showAnswer }: { q: QuizQuestion; index: number; total: number; showAnswer: boolean }) {
  const diffColor = q.difficulty === "easy" ? "text-green-700 bg-green-50" : q.difficulty === "hard" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";
  return (
    <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-3.5">
      <div className="text-[10px] uppercase font-medium text-[#1a56b0] mb-1.5">Question {index + 1} of {total} · {q.type.replace("_", " ")}</div>
      <div className="text-[13px] font-medium text-[#0f2044] mb-2 leading-snug">{q.question}</div>
      {q.type === "mcq" && q.options && (
        <div className="space-y-1.5 mb-2">
          {q.options.map((opt, i) => {
            const isCorrect = opt === q.correctAnswer;
            return (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] border text-[12px] ${
                showAnswer && isCorrect ? "bg-green-50 border-green-300 text-green-800 font-medium" : "border-[#e8e9eb] text-[#4a5264]"
              }`}>
                <span className="w-5 h-5 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[10px] font-medium shrink-0">
                  {showAnswer && isCorrect ? "✓" : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      )}
      {showAnswer && q.type !== "mcq" && (
        <div className="text-[11px] text-green-700 bg-green-50 p-2 rounded-lg">
          <span className="font-medium">Answer:</span> {q.correctAnswer}
        </div>
      )}
      {showAnswer && q.explanation && (
        <div className="text-[10px] text-[#7a7f8a] mt-1.5 italic">{q.explanation}</div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${diffColor}`}>{q.difficulty}</span>
        <span className="text-[9px] text-[#aab0bc]">{q.bloomsLevel}</span>
      </div>
    </div>
  );
}

function FlashcardItem({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(!flipped)} className="bg-white border border-[#e8e9eb] rounded-[10px] overflow-hidden cursor-pointer hover:border-[#b0bcd4] transition-colors" style={{ minHeight: 100 }}>
      {!flipped ? (
        <div className="p-4 flex items-center justify-center h-full">
          <div className="text-[22px] text-[#0f2044] text-center" dir="rtl">{card.arabic}</div>
        </div>
      ) : (
        <div className="p-4 flex flex-col items-center justify-center h-full gap-1">
          <div className="text-[14px] text-[#0f2044] text-center">{card.english}</div>
          <div className="text-[11px] text-[#7a7f8a] italic">{card.transliteration}</div>
          <span className="text-[9px] text-[#aab0bc] mt-1">{card.partOfSpeech}</span>
          {card.exampleSentence && (
            <div className="text-[11px] text-[#4a5264] mt-1 text-center" dir="rtl">{card.exampleSentence}</div>
          )}
        </div>
      )}
    </div>
  );
}

function StudyMode({ cards, index, flipped, onFlip, onNext, onPrev, onShuffle, onExit }: {
  cards: Flashcard[]; index: number; flipped: boolean;
  onFlip: () => void; onNext: () => void; onPrev: () => void;
  onShuffle: () => void; onExit: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); onFlip(); }
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onFlip, onNext, onPrev, onExit]);

  const card = cards[index];
  if (!card) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] text-[#7a7f8a]">Card {index + 1} of {cards.length}</span>
        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={onShuffle}><Shuffle className="w-3 h-3 mr-1" /> Shuffle</Button>
        <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={onExit}><X className="w-3 h-3 mr-1" /> Exit</Button>
      </div>
      <div onClick={onFlip} className="bg-white border-2 border-[#e8e9eb] rounded-2xl w-[400px] h-[260px] flex items-center justify-center cursor-pointer hover:border-[#1a56b0] transition-all shadow-sm">
        {!flipped ? (
          <div className="text-[36px] text-[#0f2044]" dir="rtl">{card.arabic}</div>
        ) : (
          <div className="text-center px-6">
            <div className="text-[20px] text-[#0f2044] mb-1">{card.english}</div>
            <div className="text-[14px] text-[#7a7f8a] italic">{card.transliteration}</div>
            {card.exampleSentence && <div className="text-[13px] text-[#4a5264] mt-3" dir="rtl">{card.exampleSentence}</div>}
            {card.exampleTranslation && <div className="text-[11px] text-[#7a7f8a] mt-1">{card.exampleTranslation}</div>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={index === 0}><ArrowLeft className="w-3 h-3" /></Button>
        <span className="text-[11px] text-[#aab0bc]">Space to flip · Arrows to navigate</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={index === cards.length - 1}><ArrowRight className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function ShareModal({ open, onClose, kitId }: { open: boolean; onClose: () => void; kitId: string | null }) {
  const [shareSlides, setShareSlides] = useState(true);
  const [shareFlashcards, setShareFlashcards] = useState(true);
  const [shareQuiz, setShareQuiz] = useState(false);
  const [shareWorksheet, setShareWorksheet] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleShare = async () => {
    if (!kitId) { toast.error("No content kit to share"); return; }
    setSending(true);
    const types = [];
    if (shareSlides) types.push("slides");
    if (shareFlashcards) types.push("flashcards");
    if (shareQuiz) types.push("quiz");
    if (shareWorksheet) types.push("worksheet");

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("kit_shares").insert({
      kit_id: kitId,
      shared_by: user?.id || "",
      shared_with: "all",
      content_types: types,
      delivery_channels: ["lms"],
      message,
      sent_at: new Date().toISOString(),
    });
    setSending(false);
    toast.success("Materials shared with students");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle className="text-[14px]">Share materials with students</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-[#4a5264]">Content to share</label>
            <div className="space-y-1.5">
              {[
                { label: "Slide deck (view only)", checked: shareSlides, set: setShareSlides },
                { label: "Flashcards (interactive study mode)", checked: shareFlashcards, set: setShareFlashcards },
                { label: "Quiz (student submission mode)", checked: shareQuiz, set: setShareQuiz },
                { label: "Worksheet (download PDF)", checked: shareWorksheet, set: setShareWorksheet },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={item.checked} onCheckedChange={(v) => item.set(!!v)} />
                  <span className="text-[12px] text-[#0f2044]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#4a5264]">Message (optional)</label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note to students…" className="mt-1 text-[12px]" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="bg-[#0f2044]" onClick={handleShare} disabled={sending}>
              {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Share2 className="w-3 h-3 mr-1" />} Share
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TeachingOSContentKit;
