import React, { useState, useEffect, useCallback, useRef } from "react";
import PptxGenJS from "pptxgenjs";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NavRail, buildRailNav } from "@/components/layout/NavRail";
import { useTeachingSession } from "@/hooks/useTeachingSession";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Star, ChevronRight, Download, Share2, Presentation, HelpCircle,
  BookOpen, Layers, FileText, Upload, FolderOpen, LayoutTemplate,
  Loader2, Square, Check, Sparkles, Printer, Shuffle, ArrowLeft,
  ArrowRight, X, BarChart3, GitBranch, Palette
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
import { detectScriptClass } from '@/lib/scriptFont';

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

interface InfographicSection {
  heading: string;
  icon: string;
  points: string[];
  highlight?: string | null;
}

interface InfographicData {
  title: string;
  subtitle: string;
  sections: InfographicSection[];
  centerFact: string;
  footer: string;
}

interface MindMapNode {
  label: string;
  detail?: string | null;
  children?: MindMapNode[];
}

interface MindMapBranch {
  label: string;
  color: string;
  children: MindMapNode[];
}

interface MindMapData {
  centralTopic: string;
  branches: MindMapBranch[];
}

type ActiveTool = "slides" | "quiz" | "flashcards" | "worksheet" | "infographic" | "mindmap" | "materials" | "templates" | "upload";

// ─── Visual Templates ─────────────────────────────────
type VisualTemplateKey = "classic" | "minimal" | "heritage" | "vibrant" | "dark";

interface VisualTemplate {
  key: VisualTemplateKey;
  label: string;
  desc: string;
  colors: { primary: string; accent: string; bg: string; cardBg: string; text: string; muted: string };
  slideOverrides: Record<string, { bg: string; accent: string; titleColor: string; bodyColor: string; gradientFrom: string; gradientTo: string }>;
  pptxColors: { bg: string; accent: string; titleColor: string; bodyColor: string };
  fontClass: string;
  chipColors: string;
}

const VISUAL_TEMPLATES: Record<VisualTemplateKey, VisualTemplate> = {
  classic: {
    key: "classic", label: "Academy Classic", desc: "Navy + gold, premium serif",
    colors: { primary: "#0f2044", accent: "#c8a438", bg: "#f8f6f0", cardBg: "#ffffff", text: "#0f2044", muted: "#7a7f8a" },
    slideOverrides: {
      Opening: { bg: "#0f2044", accent: "#c8a438", titleColor: "#ffffff", bodyColor: "#c8d6e5", gradientFrom: "#0f2044", gradientTo: "#1a2d5a" },
      Input: { bg: "#fffdf5", accent: "#c8a438", titleColor: "#0f2044", bodyColor: "#4a5264", gradientFrom: "#fffdf5", gradientTo: "#fff9e6" },
      Practice: { bg: "#fdf8f0", accent: "#b85c1a", titleColor: "#0f2044", bodyColor: "#4a5264", gradientFrom: "#fdf8f0", gradientTo: "#fff3e6" },
      Production: { bg: "#f5f0ff", accent: "#534AB7", titleColor: "#0f2044", bodyColor: "#4a5264", gradientFrom: "#f5f0ff", gradientTo: "#ede8ff" },
      "Wrap-up": { bg: "#1a2d5a", accent: "#c8a438", titleColor: "#ffffff", bodyColor: "#b0c4de", gradientFrom: "#1a2d5a", gradientTo: "#243a6e" },
      Quiz: { bg: "#fff5f5", accent: "#b42a2a", titleColor: "#0f2044", bodyColor: "#4a5264", gradientFrom: "#fff5f5", gradientTo: "#ffe8e8" },
    },
    pptxColors: { bg: "0f2044", accent: "C8A438", titleColor: "FFFFFF", bodyColor: "C8D6E5" },
    fontClass: "font-serif",
    chipColors: "bg-[#0f2044] text-[#c8a438]",
  },
  minimal: {
    key: "minimal", label: "Modern Minimal", desc: "Clean white, thin borders",
    colors: { primary: "#0f172a", accent: "#3b82f6", bg: "#ffffff", cardBg: "#f8fafc", text: "#0f172a", muted: "#94a3b8" },
    slideOverrides: {
      Opening: { bg: "#0f172a", accent: "#3b82f6", titleColor: "#ffffff", bodyColor: "#cbd5e1", gradientFrom: "#0f172a", gradientTo: "#1e293b" },
      Input: { bg: "#ffffff", accent: "#3b82f6", titleColor: "#0f172a", bodyColor: "#475569", gradientFrom: "#ffffff", gradientTo: "#f8fafc" },
      Practice: { bg: "#ffffff", accent: "#f59e0b", titleColor: "#0f172a", bodyColor: "#475569", gradientFrom: "#ffffff", gradientTo: "#fffbeb" },
      Production: { bg: "#ffffff", accent: "#8b5cf6", titleColor: "#0f172a", bodyColor: "#475569", gradientFrom: "#ffffff", gradientTo: "#f5f3ff" },
      "Wrap-up": { bg: "#1e293b", accent: "#3b82f6", titleColor: "#ffffff", bodyColor: "#cbd5e1", gradientFrom: "#1e293b", gradientTo: "#0f172a" },
      Quiz: { bg: "#ffffff", accent: "#ef4444", titleColor: "#0f172a", bodyColor: "#475569", gradientFrom: "#ffffff", gradientTo: "#fef2f2" },
    },
    pptxColors: { bg: "FFFFFF", accent: "3B82F6", titleColor: "0F172A", bodyColor: "475569" },
    fontClass: "font-sans",
    chipColors: "bg-[#f1f5f9] text-[#0f172a] border border-[#e2e8f0]",
  },
  heritage: {
    key: "heritage", label: "Islamic Heritage", desc: "Warm parchment, ornamental",
    colors: { primary: "#5c3d2e", accent: "#8b6914", bg: "#faf5eb", cardBg: "#fff9f0", text: "#3d2b1f", muted: "#8b7355" },
    slideOverrides: {
      Opening: { bg: "#3d2b1f", accent: "#d4a944", titleColor: "#faf5eb", bodyColor: "#d4c4a8", gradientFrom: "#3d2b1f", gradientTo: "#5c3d2e" },
      Input: { bg: "#faf5eb", accent: "#8b6914", titleColor: "#3d2b1f", bodyColor: "#5c4a3a", gradientFrom: "#faf5eb", gradientTo: "#f5ecd8" },
      Practice: { bg: "#faf5eb", accent: "#a0522d", titleColor: "#3d2b1f", bodyColor: "#5c4a3a", gradientFrom: "#faf5eb", gradientTo: "#f0e4d0" },
      Production: { bg: "#f5ecd8", accent: "#6b4c8a", titleColor: "#3d2b1f", bodyColor: "#5c4a3a", gradientFrom: "#f5ecd8", gradientTo: "#ede0c8" },
      "Wrap-up": { bg: "#5c3d2e", accent: "#d4a944", titleColor: "#faf5eb", bodyColor: "#d4c4a8", gradientFrom: "#5c3d2e", gradientTo: "#3d2b1f" },
      Quiz: { bg: "#faf5eb", accent: "#8b2500", titleColor: "#3d2b1f", bodyColor: "#5c4a3a", gradientFrom: "#faf5eb", gradientTo: "#f5e6dc" },
    },
    pptxColors: { bg: "FAF5EB", accent: "8B6914", titleColor: "3D2B1F", bodyColor: "5C4A3A" },
    fontClass: "font-serif",
    chipColors: "bg-[#f5ecd8] text-[#5c3d2e] border border-[#d4c4a8]",
  },
  vibrant: {
    key: "vibrant", label: "Vibrant Learning", desc: "Colorful gradients, playful",
    colors: { primary: "#6d28d9", accent: "#f59e0b", bg: "#faf5ff", cardBg: "#ffffff", text: "#1e1b4b", muted: "#7c6fa0" },
    slideOverrides: {
      Opening: { bg: "#4c1d95", accent: "#f59e0b", titleColor: "#ffffff", bodyColor: "#ddd6fe", gradientFrom: "#4c1d95", gradientTo: "#6d28d9" },
      Input: { bg: "#faf5ff", accent: "#059669", titleColor: "#1e1b4b", bodyColor: "#4c3a72", gradientFrom: "#faf5ff", gradientTo: "#ecfdf5" },
      Practice: { bg: "#fff7ed", accent: "#ea580c", titleColor: "#1e1b4b", bodyColor: "#4c3a72", gradientFrom: "#fff7ed", gradientTo: "#ffedd5" },
      Production: { bg: "#eff6ff", accent: "#2563eb", titleColor: "#1e1b4b", bodyColor: "#4c3a72", gradientFrom: "#eff6ff", gradientTo: "#dbeafe" },
      "Wrap-up": { bg: "#6d28d9", accent: "#fbbf24", titleColor: "#ffffff", bodyColor: "#ddd6fe", gradientFrom: "#6d28d9", gradientTo: "#4c1d95" },
      Quiz: { bg: "#fef2f2", accent: "#dc2626", titleColor: "#1e1b4b", bodyColor: "#4c3a72", gradientFrom: "#fef2f2", gradientTo: "#fee2e2" },
    },
    pptxColors: { bg: "4C1D95", accent: "F59E0B", titleColor: "FFFFFF", bodyColor: "DDD6FE" },
    fontClass: "font-sans",
    chipColors: "bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white",
  },
  dark: {
    key: "dark", label: "Dark Scholar", desc: "Dark backgrounds, cyan accents",
    colors: { primary: "#0f172a", accent: "#06b6d4", bg: "#0f172a", cardBg: "#1e293b", text: "#e2e8f0", muted: "#64748b" },
    slideOverrides: {
      Opening: { bg: "#020617", accent: "#06b6d4", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#020617", gradientTo: "#0f172a" },
      Input: { bg: "#0f172a", accent: "#06b6d4", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#0f172a", gradientTo: "#1e293b" },
      Practice: { bg: "#1e293b", accent: "#f59e0b", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#1e293b", gradientTo: "#0f172a" },
      Production: { bg: "#1e293b", accent: "#a78bfa", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#1e293b", gradientTo: "#0f172a" },
      "Wrap-up": { bg: "#020617", accent: "#06b6d4", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#020617", gradientTo: "#0f172a" },
      Quiz: { bg: "#1e293b", accent: "#f43f5e", titleColor: "#f0f9ff", bodyColor: "#94a3b8", gradientFrom: "#1e293b", gradientTo: "#0f172a" },
    },
    pptxColors: { bg: "0F172A", accent: "06B6D4", titleColor: "F0F9FF", bodyColor: "94A3B8" },
    fontClass: "font-sans",
    chipColors: "bg-[#1e293b] text-[#06b6d4] border border-[#334155]",
  },
};

const TEMPLATE_KEYS: VisualTemplateKey[] = ["classic", "minimal", "heritage", "vibrant", "dark"];

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

async function fetchAIContent(
  contentType: string,
  sessionPlan: any,
  courseName: string,
  subject: string,
  level: string,
  extraParams: Record<string, any> = {},
  abortSignal?: AbortSignal
): Promise<any> {
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

  const json = await res.json().catch(() => ({ error: "Invalid response" }));
  if (!res.ok) {
    throw new Error(json.error || "Generation failed");
  }
  return json.data;
}

// ─── Main Component ──────────────────────────────────
const TeachingOSContentKit: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const railItems = buildRailNav(activeRole);
  const { sessionId } = useTeachingSession();

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
  const [infographic, setInfographic] = useState<InfographicData | null>(null);
  const [mindmap, setMindmap] = useState<MindMapData | null>(null);

  // Generation state
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [genProgress, setGenProgress] = useState<Record<string, string>>({});
  const [kitId, setKitId] = useState<string | null>(null);

  // Custom prompt per tool
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [showPromptBox, setShowPromptBox] = useState<Record<string, boolean>>({});

  // Visual template
  const [activeTemplate, setActiveTemplate] = useState<VisualTemplateKey>(() => {
    return (localStorage.getItem('tos-visual-template') as VisualTemplateKey) || 'classic';
  });
  const [stylePrompt, setStylePrompt] = useState("");
  const [showStylePrompt, setShowStylePrompt] = useState(false);
  const template = VISUAL_TEMPLATES[activeTemplate];

  const handleTemplateChange = (key: VisualTemplateKey) => {
    setActiveTemplate(key);
    localStorage.setItem('tos-visual-template', key);
  };

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
      const extraParams: Record<string, any> = {};
      if (type === "quiz") {
        extraParams.questionCount = 10;
        extraParams.questionTypes = ["mcq", "short_answer", "true_false"];
        extraParams.difficulty = "Mixed";
      }
      if (customPrompts[type]?.trim()) {
        extraParams.customPrompt = customPrompts[type].trim();
      }
      if (stylePrompt?.trim()) {
        extraParams.stylePrompt = stylePrompt.trim();
      }
      const parsed = await fetchAIContent(
        type, sessionPlan, courseName, subject, level,
        extraParams,
        abort.signal
      );
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
      } else if (type === "infographic" && parsed.sections) {
        setInfographic(parsed as InfographicData);
      } else if (type === "mindmap" && parsed.branches) {
        setMindmap(parsed as MindMapData);
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
  }, [sessionPlan, courseName, subject, level, kitId, generating, customPrompts, stylePrompt]);

  const generateFullKit = useCallback(async () => {
    const types: ActiveTool[] = ["slides", "quiz", "flashcards", "worksheet", "infographic", "mindmap"];
    await Promise.allSettled(types.map(t => generateContent(t)));
    toast.success("Full kit generation complete!");
  }, [generateContent]);

  // ─── Tool sidebar items ─────────────────────────────
  const toolItems: { key: ActiveTool; label: string; icon: React.ReactNode; count?: number; section: string }[] = [
    { key: "slides", label: "Slides", icon: <Presentation className="w-4 h-4" />, count: slides.length, section: "GENERATE" },
    { key: "quiz", label: "Quiz", icon: <HelpCircle className="w-4 h-4" />, count: quizQuestions.length, section: "GENERATE" },
    { key: "flashcards", label: "Flashcards", icon: <Layers className="w-4 h-4" />, count: flashcards.length, section: "GENERATE" },
    { key: "worksheet", label: "Worksheet", icon: <FileText className="w-4 h-4" />, count: worksheetExercises.length > 0 ? 1 : 0, section: "GENERATE" },
    { key: "infographic", label: "Infographic", icon: <BarChart3 className="w-4 h-4" />, count: infographic ? 1 : 0, section: "GENERATE" },
    { key: "mindmap", label: "Mind Map", icon: <GitBranch className="w-4 h-4" />, count: mindmap ? 1 : 0, section: "GENERATE" },
    { key: "materials", label: "All materials", icon: <FolderOpen className="w-4 h-4" />, section: "LIBRARY" },
    { key: "templates", label: "Templates", icon: <LayoutTemplate className="w-4 h-4" />, section: "LIBRARY" },
    { key: "upload", label: "Upload file", icon: <Upload className="w-4 h-4" />, section: "LIBRARY" },
  ];

  const genBarInfo: Record<string, { title: string; desc: string }> = {
    slides: { title: "AI slide deck generator", desc: `${sessionPlan?.activities?.length || 0} activities → ${slides.length || "?"} slides auto-generated from session plan` },
    quiz: { title: "AI quiz generator", desc: `${quizQuestions.length} questions · MCQ + short answer from session objectives` },
    flashcards: { title: "AI flashcard generator", desc: `Arabic terms from this session with transliteration` },
    worksheet: { title: "AI worksheet generator", desc: `Printable exercises aligned to session objectives` },
    infographic: { title: "AI infographic generator", desc: `Visual summary of key concepts from this session` },
    mindmap: { title: "AI mind map generator", desc: `Hierarchical concept map of session topics` },
  };

  if (loading) {
    return (
      <div className="flex h-screen pl-14">
        <NavRail items={railItems} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const currentSlide = slides[activeSlideIndex];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f5f7] pl-14">
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
              <DropdownMenuItem onClick={() => exportAsPDF()}>Export as PDF</DropdownMenuItem>
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
            {/* Template selector strip */}
            {["slides", "quiz", "flashcards", "worksheet", "infographic", "mindmap"].includes(activeTool) && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-3.5 h-3.5 text-[#7a7f8a]" />
                  <span className="text-[11px] font-medium text-[#4a5264]">Visual Template</span>
                  <button
                    onClick={() => setShowStylePrompt(!showStylePrompt)}
                    className="ml-auto text-[10px] text-[#1a56b0] hover:underline"
                  >
                    {showStylePrompt ? "Hide style prompt" : "✨ Style prompt"}
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEMPLATE_KEYS.map(key => {
                    const t = VISUAL_TEMPLATES[key];
                    const isActive = activeTemplate === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleTemplateChange(key)}
                        className={`shrink-0 rounded-lg px-3 py-2 border-2 transition-all text-left ${
                          isActive ? "border-[#1a56b0] shadow-md scale-[1.02]" : "border-transparent hover:border-[#d0d4dc]"
                        }`}
                        style={{ 
                          background: `linear-gradient(135deg, ${t.colors.bg}, ${t.colors.cardBg})`,
                          minWidth: 130 
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colors.accent }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colors.primary }} />
                        </div>
                        <div className="text-[11px] font-semibold" style={{ color: t.colors.text }}>{t.label}</div>
                        <div className="text-[9px]" style={{ color: t.colors.muted }}>{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
                {showStylePrompt && (
                  <div className="mt-2">
                    <Textarea
                      placeholder='Describe your desired style... e.g. "Green and gold Islamic theme" or "Kid-friendly with lots of color"'
                      value={stylePrompt}
                      onChange={e => setStylePrompt(e.target.value)}
                      className="text-[12px] min-h-[50px] bg-white border-[#d0d4dc] resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Generator bar */}
            {["slides", "quiz", "flashcards", "worksheet", "infographic", "mindmap"].includes(activeTool) && (
              <div className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[9px] p-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-[30px] h-[30px] rounded-lg bg-[#1a56b0] flex items-center justify-center shrink-0">
                    <Star className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#0f2044]">{genBarInfo[activeTool]?.title}</div>
                    <div className="text-[11px] text-[#7a7f8a]">{genBarInfo[activeTool]?.desc}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-7 text-[#1a56b0]"
                    onClick={() => setShowPromptBox(prev => ({ ...prev, [activeTool]: !prev[activeTool] }))}
                  >
                    {showPromptBox[activeTool] ? "Hide specs" : "Add specs"}
                  </Button>
                  <Button
                    size="sm"
                    className="text-[11px] h-7 bg-[#0f2044] hover:bg-[#1a2d5a]"
                    onClick={() => generateContent(activeTool)}
                    disabled={generating[activeTool]}
                  >
                    {generating[activeTool] ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    {generating[activeTool] ? "Generating..." : slides.length > 0 || quizQuestions.length > 0 || flashcards.length > 0 || worksheetExercises.length > 0 ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                {showPromptBox[activeTool] && (
                  <div className="mt-2.5">
                    <Textarea
                      placeholder={`Add custom instructions for ${activeTool} generation...\ne.g. "Focus on Surah Al-Fatiha vocabulary" or "Include 5 extra hard questions"`}
                      value={customPrompts[activeTool] || ""}
                      onChange={e => setCustomPrompts(prev => ({ ...prev, [activeTool]: e.target.value }))}
                      className="text-[12px] min-h-[60px] bg-white border-[#d0d4dc] resize-none"
                      rows={3}
                    />
                  </div>
                )}
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
                  <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-[10px] overflow-hidden mb-3 shadow-lg">
                    <div className="aspect-video relative" style={{ minHeight: 320 }}>
                      {currentSlide && <SlideContent slide={currentSlide} courseName={courseName} slideIndex={activeSlideIndex} totalSlides={slides.length} template={template} />}
                    </div>
                    <div className="px-3 py-2 bg-[#111827] border-t border-[#2a2a3e] flex items-center justify-between">
                      <span className="text-[10px] text-[#6b7280]">Slide {activeSlideIndex + 1} of {slides.length} · {currentSlide?.phase}</span>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 border-[#374151] text-[#9ca3af] hover:text-white hover:bg-[#1f2937]" onClick={() => downloadPptx(slides, courseName, subject, level, sessionPlan, template)}>
                          <Download className="w-3 h-3 mr-1" /> PPTX
                        </Button>
                        <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 border-[#374151] text-[#9ca3af] hover:text-white hover:bg-[#1f2937]" onClick={() => generateContent("slides")} disabled={generating.slides}>
                          <Sparkles className="w-3 h-3 mr-1" /> Regenerate
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
                    <QuizCard key={i} q={q} index={i} total={quizQuestions.length} showAnswer={showAnswers} template={template} />
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
                    {flashcards.map((f, i) => <FlashcardItem key={i} card={f} template={template} />)}
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

            {/* INFOGRAPHIC VIEW */}
            {activeTool === "infographic" && (
              !infographic ? (
                <EmptyState icon={<BarChart3 className="w-9 h-9 stroke-[#d0d4dc]" />} title="No infographic yet" sub="Generate a visual summary of session concepts" onGenerate={() => generateContent("infographic")} generating={generating.infographic} />
              ) : (
                <div className="max-w-[700px] mx-auto">
                  <div className="rounded-[12px] p-6 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${template.colors.primary}, ${template.colors.accent}88)` }}>
                    <div className="text-center mb-5">
                      <div className="text-[20px] font-bold">{infographic.title}</div>
                      <div className="text-[12px] text-blue-200 mt-1">{infographic.subtitle}</div>
                    </div>
                    {/* Center fact */}
                    <div className="bg-white/10 backdrop-blur rounded-[10px] p-4 text-center mb-5 border border-white/20">
                      <div className="text-[15px] font-semibold text-amber-300">{infographic.centerFact}</div>
                    </div>
                    {/* Sections grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {infographic.sections.map((sec, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur rounded-[8px] p-3 border border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[18px]">{sec.icon}</span>
                            <span className="text-[12px] font-semibold text-white">{sec.heading}</span>
                          </div>
                          <ul className="space-y-1">
                            {sec.points.map((p, j) => (
                              <li key={j} className="text-[11px] text-blue-100 flex gap-1.5">
                                <span className="text-blue-300 mt-0.5">•</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                          {sec.highlight && (
                            <div className="mt-2 text-[11px] font-medium text-amber-300 bg-white/5 rounded px-2 py-1" dir="auto">
                              ★ {sec.highlight}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Footer */}
                    <div className="text-center mt-5 text-[11px] text-blue-200 italic">{infographic.footer}</div>
                  </div>
                </div>
              )
            )}

            {/* MIND MAP VIEW */}
            {activeTool === "mindmap" && (
              !mindmap ? (
                <EmptyState icon={<GitBranch className="w-9 h-9 stroke-[#d0d4dc]" />} title="No mind map yet" sub="Generate a concept map from session topics" onGenerate={() => generateContent("mindmap")} generating={generating.mindmap} />
              ) : (
                <div className="max-w-[800px] mx-auto">
                  {/* Central topic */}
                  <div className="flex justify-center mb-6">
                    <div className="text-white rounded-full px-6 py-3 text-[15px] font-bold shadow-lg" style={{ background: template.colors.primary }}>
                      {mindmap.centralTopic}
                    </div>
                  </div>
                  {/* Branches */}
                  <div className="grid grid-cols-2 gap-4">
                    {mindmap.branches.map((branch, i) => (
                      <div key={i} className="border-2 rounded-[10px] p-3" style={{ borderColor: branch.color }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: branch.color }} />
                          <span className="text-[13px] font-bold text-[#0f2044]">{branch.label}</span>
                        </div>
                        <div className="ml-4 space-y-2">
                          {branch.children.map((child, j) => (
                            <div key={j}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: branch.color, opacity: 0.6 }} />
                                <span className="text-[12px] font-medium text-[#0f2044]">{child.label}</span>
                              </div>
                              {child.detail && <div className="ml-4 text-[10px] text-[#7a7f8a] italic" dir="auto">{child.detail}</div>}
                              {child.children?.map((leaf, k) => (
                                <div key={k} className="ml-4 flex items-center gap-1.5 mt-0.5">
                                  <div className="w-1 h-1 rounded-full bg-[#d0d4dc]" />
                                  <span className="text-[11px] text-[#4a5264]">{leaf.label}</span>
                                  {leaf.detail && <span className="text-[9px] text-[#aab0bc] italic ml-1" dir="auto">{leaf.detail}</span>}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
                {activeTool === "slides" ? "Slide deck" : activeTool === "quiz" ? "Questions" : activeTool === "flashcards" ? "Cards" : activeTool === "infographic" ? "Infographic" : activeTool === "mindmap" ? "Mind Map" : "Exercises"}
              </div>
              <div className="text-[11px] text-[#7a7f8a]">
                {activeTool === "slides" ? `${slides.length} slides generated` : activeTool === "quiz" ? `${quizQuestions.length} questions` : activeTool === "flashcards" ? `${flashcards.length} cards` : activeTool === "infographic" ? (infographic ? `${infographic.sections.length} sections` : "Not generated") : activeTool === "mindmap" ? (mindmap ? `${mindmap.branches.length} branches` : "Not generated") : `${worksheetExercises.length} exercises`}
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
              {activeTool === "infographic" && infographic?.sections.map((sec, i) => (
                <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                  <span className="text-[14px]">{sec.icon}</span>
                  <span className="text-[11px] text-[#0f2044] truncate flex-1">{sec.heading}</span>
                </button>
              ))}
              {activeTool === "mindmap" && mindmap?.branches.map((b, i) => (
                <button key={i} className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[#f0f1f3] hover:bg-[#f9f9fb]">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="text-[11px] text-[#0f2044] truncate flex-1">{b.label}</span>
                  <span className="text-[9px] text-[#aab0bc]">{b.children.length}</span>
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

  function exportAsPDF() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Popup blocked — please allow popups"); return; }

    const lang = localStorage.getItem("tos-language") || "en";
    const isRtl = lang === "ar" || lang === "ur";

    let html = `<!DOCTYPE html><html dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
    <title>${courseName} - Content Kit</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amiri&family=Inter:wght@400;600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', sans-serif; color: #0f2044; padding: 40px; font-size: 13px; line-height: 1.6; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 24px 0 10px; color: #1a56b0; border-bottom: 2px solid #e8e9eb; padding-bottom: 4px; }
      h3 { font-size: 13px; margin: 12px 0 6px; }
      .meta { font-size: 11px; color: #7a7f8a; margin-bottom: 20px; }
      .slide-card { background: #f8f9fb; border: 1px solid #e8e9eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; page-break-inside: avoid; }
      .slide-card .phase { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #1a56b0; font-weight: 600; margin-bottom: 4px; }
      .slide-card .title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
      .slide-card .arabic { font-family: 'Amiri', serif; font-size: 24px; text-align: center; direction: rtl; margin: 8px 0; color: #1a3a6c; }
      .slide-card .translit { font-size: 11px; text-align: center; color: #888; font-style: italic; }
      .slide-card ul { padding-left: 18px; margin: 6px 0; }
      .slide-card li { margin-bottom: 3px; }
      .slide-card .note { font-size: 10px; color: #888; font-style: italic; margin-top: 6px; }
      .quiz-q { background: #fff; border: 1px solid #e8e9eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; page-break-inside: avoid; }
      .quiz-q .qnum { font-size: 10px; color: #1a56b0; font-weight: 600; }
      .quiz-q .diff { font-size: 9px; padding: 1px 6px; border-radius: 10px; background: #f0f4ff; color: #4a5264; }
      .quiz-q .opts { margin: 6px 0 0 16px; }
      .quiz-q .opts div { margin-bottom: 2px; }
      .quiz-q .answer { font-size: 11px; color: #1a7340; margin-top: 4px; }
      .flash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .flash-card { border: 1px solid #e8e9eb; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
      .flash-card .ar { font-family: 'Amiri', serif; font-size: 22px; direction: rtl; color: #0f2044; }
      .flash-card .en { font-size: 13px; font-weight: 600; margin-top: 4px; }
      .flash-card .tr { font-size: 11px; color: #888; font-style: italic; }
      .flash-card .ex { font-size: 11px; color: #4a5264; margin-top: 6px; border-top: 1px solid #f0f1f3; padding-top: 4px; }
      .ws-exercise { margin-bottom: 16px; page-break-inside: avoid; }
      .ws-exercise .items { margin-left: 16px; }
      .ws-exercise .items div { margin-bottom: 4px; }
      @media print { body { padding: 20px; } }
    </style></head><body>`;

    html += `<h1>${courseName || "Content Kit"}</h1>`;
    html += `<div class="meta">${sessionPlan?.session_title || ""} · ${subject} · ${level} · Session ${sessionPlan?.session_number || ""}, Week ${sessionPlan?.week_number || ""}</div>`;

    // Slides section
    if (slides.length > 0) {
      html += `<h2>📊 Slides (${slides.length})</h2>`;
      slides.forEach((s, i) => {
        html += `<div class="slide-card">`;
        html += `<div class="phase">${s.phase} · Slide ${i + 1}</div>`;
        html += `<div class="title">${s.title}</div>`;
        if (s.arabicText) html += `<div class="arabic">${s.arabicText}</div>`;
        if (s.transliteration) html += `<div class="translit">${s.transliteration}</div>`;
        if (s.bullets?.length) {
          html += `<ul>${s.bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;
        }
        if (s.activityInstruction) html += `<div class="note">🎯 ${s.activityInstruction}</div>`;
        if (s.teacherNote) html += `<div class="note">📝 ${s.teacherNote}</div>`;
        html += `</div>`;
      });
    }

    // Quiz section
    if (quizQuestions.length > 0) {
      html += `<h2>❓ Quiz (${quizQuestions.length} questions)</h2>`;
      quizQuestions.forEach((q, i) => {
        html += `<div class="quiz-q">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span class="qnum">Q${i + 1} · ${q.type.toUpperCase()}</span><span class="diff">${q.difficulty}</span></div>`;
        html += `<div>${q.question}</div>`;
        if (q.options?.length) {
          html += `<div class="opts">${q.options.map((o, j) => `<div>${String.fromCharCode(65 + j)}) ${o}</div>`).join("")}</div>`;
        }
        html += `<div class="answer">✓ ${q.correctAnswer}</div>`;
        if (q.explanation) html += `<div style="font-size:10px;color:#7a7f8a;margin-top:2px;">💡 ${q.explanation}</div>`;
        html += `</div>`;
      });
    }

    // Flashcards section
    if (flashcards.length > 0) {
      html += `<h2>🃏 Flashcards (${flashcards.length})</h2>`;
      html += `<div class="flash-grid">`;
      flashcards.forEach(f => {
        html += `<div class="flash-card">`;
        html += `<div class="ar">${f.arabic}</div>`;
        html += `<div class="en">${f.english}</div>`;
        html += `<div class="tr">${f.transliteration} · ${f.partOfSpeech}</div>`;
        if (f.exampleSentence) html += `<div class="ex" dir="rtl">${f.exampleSentence}</div>`;
        if (f.exampleTranslation) html += `<div class="ex">${f.exampleTranslation}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    // Worksheet section
    if (worksheetExercises.length > 0) {
      html += `<h2>📝 Worksheet: ${worksheetTitle || sessionPlan?.session_title}</h2>`;
      html += `<div style="text-align:right;margin-bottom:12px;font-size:12px;">Name: _________________________</div>`;
      worksheetExercises.forEach((ex, i) => {
        html += `<div class="ws-exercise">`;
        html += `<h3>Exercise ${i + 1}: ${ex.title}</h3>`;
        html += `<div style="font-size:11px;color:#7a7f8a;font-style:italic;margin-bottom:6px;">${ex.instructions}</div>`;
        html += `<div class="items">${ex.items.map((item, j) => `<div>${j + 1}. ${item.blankedSentence || item.question}</div>`).join("")}</div>`;
        html += `</div>`;
      });
    }

    // Infographic section
    if (infographic) {
      html += `<h2>📊 Infographic: ${infographic.title}</h2>`;
      html += `<div style="text-align:center;font-size:12px;color:#7a7f8a;margin-bottom:10px;">${infographic.subtitle}</div>`;
      html += `<div style="background:#f0f4ff;border:1px solid #b5d0f8;border-radius:8px;padding:12px;text-align:center;margin-bottom:12px;font-size:14px;font-weight:600;color:#1a56b0;">${infographic.centerFact}</div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;
      infographic.sections.forEach(sec => {
        html += `<div style="border:1px solid #e8e9eb;border-radius:8px;padding:10px;page-break-inside:avoid;">`;
        html += `<div style="font-size:13px;font-weight:600;margin-bottom:4px;">${sec.icon} ${sec.heading}</div>`;
        html += `<ul style="padding-left:16px;margin:0;">${sec.points.map(p => `<li style="font-size:11px;margin-bottom:2px;">${p}</li>`).join("")}</ul>`;
        if (sec.highlight) html += `<div style="font-size:11px;color:#b85c1a;margin-top:6px;font-weight:500;" dir="auto">★ ${sec.highlight}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
      html += `<div style="text-align:center;font-size:11px;color:#7a7f8a;font-style:italic;margin-top:10px;">${infographic.footer}</div>`;
    }

    // Mind Map section
    if (mindmap) {
      html += `<h2>🧠 Mind Map: ${mindmap.centralTopic}</h2>`;
      html += `<div style="text-align:center;margin-bottom:14px;"><span style="background:#0f2044;color:white;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:700;">${mindmap.centralTopic}</span></div>`;
      html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;
      mindmap.branches.forEach(branch => {
        html += `<div style="border:2px solid ${branch.color};border-radius:8px;padding:10px;page-break-inside:avoid;">`;
        html += `<div style="font-size:13px;font-weight:700;color:#0f2044;margin-bottom:6px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${branch.color};margin-right:6px;"></span>${branch.label}</div>`;
        branch.children.forEach(child => {
          html += `<div style="margin-left:14px;margin-bottom:4px;">`;
          html += `<div style="font-size:12px;font-weight:500;color:#0f2044;">${child.label}</div>`;
          if (child.detail) html += `<div style="font-size:10px;color:#7a7f8a;font-style:italic;" dir="auto">${child.detail}</div>`;
          child.children?.forEach(leaf => {
            html += `<div style="margin-left:12px;font-size:11px;color:#4a5264;">• ${leaf.label}${leaf.detail ? ` <span style="font-size:9px;color:#aab0bc;font-style:italic;">${leaf.detail}</span>` : ''}</div>`;
          });
          html += `</div>`;
        });
        html += `</div>`;
      });
      html += `</div>`;
    }

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => { printWindow.print(); }, 500);
    };
  }
};

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── PPTX Download ───────────────────────────────────
const PPTX_THEMES: Record<string, { bg: string; accent: string; titleColor: string; bodyColor: string }> = {
  Opening:    { bg: '0f2044', accent: '4a90d9', titleColor: 'FFFFFF', bodyColor: 'c8d6e5' },
  Input:      { bg: 'FFFFFF', accent: '1a7340', titleColor: '0f2044', bodyColor: '4a5264' },
  Practice:   { bg: 'fdf8f0', accent: 'b85c1a', titleColor: '0f2044', bodyColor: '4a5264' },
  Production: { bg: 'f5f0ff', accent: '534AB7', titleColor: '0f2044', bodyColor: '4a5264' },
  'Wrap-up':  { bg: '1a2d5a', accent: 'f9c846', titleColor: 'FFFFFF', bodyColor: 'b0c4de' },
  Quiz:       { bg: 'fff5f5', accent: 'b42a2a', titleColor: '0f2044', bodyColor: '4a5264' },
};

async function downloadPptx(slides: SlideData[], courseName: string, subject: string, level: string, sessionPlan: any, template?: VisualTemplate) {
  if (!slides.length) return;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = courseName || "Teaching OS";
  pptx.title = sessionPlan?.session_title || "Session Slides";

  slides.forEach((s, i) => {
    const tplOverride = template?.slideOverrides?.[s.phase];
    const t = tplOverride
      ? { bg: tplOverride.bg.replace('#', ''), accent: tplOverride.accent.replace('#', ''), titleColor: tplOverride.titleColor.replace('#', ''), bodyColor: tplOverride.bodyColor.replace('#', '') }
      : (PPTX_THEMES[s.phase] || PPTX_THEMES.Input);
    const isDark = ['Opening', 'Wrap-up'].includes(s.phase);
    const slide = pptx.addSlide();
    slide.background = { color: t.bg };

    // Phase badge
    slide.addText(s.phase.toUpperCase(), {
      x: 0.5, y: 0.3, w: 2, h: 0.35,
      fontSize: 8, bold: true, color: t.accent,
      fontFace: "Arial",
    });

    // Slide number
    slide.addText(`${i + 1} / ${slides.length}`, {
      x: 11, y: 0.3, w: 1.5, h: 0.3,
      fontSize: 8, color: isDark ? '666666' : 'AAAAAA',
      align: "right", fontFace: "Arial",
    });

    // Title
    slide.addText(s.title, {
      x: 0.5, y: 0.8, w: 12, h: 0.7,
      fontSize: 28, bold: true, color: t.titleColor,
      fontFace: "Arial",
    });

    // Accent line
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.55, w: 1.2, h: 0.04,
      fill: { color: t.accent },
    });

    let yPos = 1.9;

    // Arabic text
    if (s.arabicText) {
      slide.addText(s.arabicText, {
        x: 1, y: yPos, w: 11, h: 0.8,
        fontSize: 32, color: t.titleColor, align: "center",
        fontFace: "Arial",
      });
      yPos += 0.85;
      if (s.transliteration) {
        slide.addText(s.transliteration, {
          x: 1, y: yPos, w: 11, h: 0.4,
          fontSize: 12, italic: true, color: isDark ? '888888' : '888888',
          align: "center", fontFace: "Arial",
        });
        yPos += 0.5;
      }
    }

    // Bullets
    if (s.bullets?.length) {
      const bulletRows = s.bullets.map(b => ({
        text: b,
        options: { fontSize: 14, color: t.bodyColor, bullet: { code: '25CF', color: t.accent }, breakLine: true, paraSpaceAfter: 6 },
      }));
      slide.addText(bulletRows, {
        x: 0.5, y: yPos, w: 12, h: Math.min(s.bullets.length * 0.45, 3.5),
        fontFace: "Arial", valign: "top",
      });
      yPos += Math.min(s.bullets.length * 0.45, 3.5) + 0.2;
    }

    // Activity instruction
    if (s.activityInstruction) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 12, h: 0.7,
        fill: { color: isDark ? '1a3355' : 'f0f4ff' },
        rectRadius: 0.08,
      });
      slide.addText(`Activity: ${s.activityInstruction}`, {
        x: 0.7, y: yPos + 0.05, w: 11.6, h: 0.6,
        fontSize: 11, color: t.accent, fontFace: "Arial",
      });
      yPos += 0.9;
    }

    // Footer
    slide.addText(courseName || "", {
      x: 0.5, y: 7.0, w: 6, h: 0.3,
      fontSize: 8, color: isDark ? '444466' : 'CCCCCC', fontFace: "Arial",
    });
    if (s.teacherNote) {
      slide.addText(`📝 ${s.teacherNote}`, {
        x: 6, y: 7.0, w: 6.5, h: 0.3,
        fontSize: 8, italic: true, color: isDark ? '555577' : 'BBBBBB',
        align: "right", fontFace: "Arial",
      });
    }
  });

  await pptx.writeFile({ fileName: `${courseName || 'slides'}-session-${sessionPlan?.session_number || '1'}.pptx` });
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

// ─── Professional Slide Themes ────────────────────────
const SLIDE_THEMES: Record<string, {
  bg: string; accent: string; accentLight: string; titleColor: string;
  bodyColor: string; bulletColor: string; badgeBg: string; badgeText: string;
  gradientFrom: string; gradientTo: string;
}> = {
  Opening: {
    bg: '#0f2044', accent: '#4a90d9', accentLight: '#1a3a6c', titleColor: '#ffffff',
    bodyColor: '#c8d6e5', bulletColor: '#4a90d9', badgeBg: 'rgba(74,144,217,0.2)', badgeText: '#7ab8ff',
    gradientFrom: '#0f2044', gradientTo: '#1a3a6c',
  },
  Input: {
    bg: '#ffffff', accent: '#1a7340', accentLight: '#e6f4ea', titleColor: '#0f2044',
    bodyColor: '#4a5264', bulletColor: '#1a7340', badgeBg: '#e6f4ea', badgeText: '#1a7340',
    gradientFrom: '#ffffff', gradientTo: '#f0faf4',
  },
  Practice: {
    bg: '#fdf8f0', accent: '#b85c1a', accentLight: '#fff3e6', titleColor: '#0f2044',
    bodyColor: '#4a5264', bulletColor: '#b85c1a', badgeBg: '#fff3e6', badgeText: '#b85c1a',
    gradientFrom: '#fdf8f0', gradientTo: '#fff8f0',
  },
  Production: {
    bg: '#f5f0ff', accent: '#534AB7', accentLight: '#ede8ff', titleColor: '#0f2044',
    bodyColor: '#4a5264', bulletColor: '#534AB7', badgeBg: '#ede8ff', badgeText: '#534AB7',
    gradientFrom: '#f5f0ff', gradientTo: '#ede8ff',
  },
  'Wrap-up': {
    bg: '#1a2d5a', accent: '#f9c846', accentLight: '#243a6e', titleColor: '#ffffff',
    bodyColor: '#b0c4de', bulletColor: '#f9c846', badgeBg: 'rgba(249,200,70,0.2)', badgeText: '#f9c846',
    gradientFrom: '#1a2d5a', gradientTo: '#243a6e',
  },
  Quiz: {
    bg: '#fff5f5', accent: '#b42a2a', accentLight: '#ffe0e0', titleColor: '#0f2044',
    bodyColor: '#4a5264', bulletColor: '#b42a2a', badgeBg: '#ffe0e0', badgeText: '#b42a2a',
    gradientFrom: '#fff5f5', gradientTo: '#ffe8e8',
  },
};

const DEFAULT_THEME = SLIDE_THEMES.Input;

function SlideContent({ slide, courseName, slideIndex, totalSlides, template }: { slide: SlideData; courseName?: string; slideIndex?: number; totalSlides?: number; template?: VisualTemplate }) {
  const tplOverride = template?.slideOverrides?.[slide.phase];
  const theme = tplOverride ? {
    bg: tplOverride.bg, accent: tplOverride.accent, accentLight: tplOverride.bg,
    titleColor: tplOverride.titleColor, bodyColor: tplOverride.bodyColor,
    bulletColor: tplOverride.accent, badgeBg: `${tplOverride.accent}22`, badgeText: tplOverride.accent,
    gradientFrom: tplOverride.gradientFrom, gradientTo: tplOverride.gradientTo,
  } : (SLIDE_THEMES[slide.phase] || DEFAULT_THEME);
  const isDark = ['Opening', 'Wrap-up'].includes(slide.phase);
  const isArabicLayout = slide.layoutType === 'arabic-vocab' || slide.layoutType === 'two-column-vocab';

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden select-none"
      style={{
        background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] opacity-10" style={{
        background: `radial-gradient(circle at top right, ${theme.accent}, transparent 70%)`,
      }} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2 z-10">
        <span
          className="text-[9px] uppercase tracking-[0.15em] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: theme.badgeBg, color: theme.badgeText }}
        >
          {slide.phase}
        </span>
        {slideIndex != null && totalSlides && (
          <span className="text-[9px]" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)' }}>
            {slideIndex + 1} / {totalSlides}
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col px-6 pb-5 z-10">
        {/* Title */}
        <h2
          className="text-[22px] font-bold leading-tight mb-3 tracking-tight"
          style={{ color: theme.titleColor }}
        >
          {slide.title}
        </h2>

        {/* Accent line */}
        <div className="w-12 h-[3px] rounded-full mb-4" style={{ background: theme.accent }} />

        {/* Arabic text block */}
        {slide.arabicText && (
          <div className={`${isArabicLayout ? 'flex-1 flex items-center justify-center' : 'mb-3'}`}>
            <div
              className="text-center py-3 px-4 rounded-xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }}
            >
              <div
                className="leading-relaxed"
                dir="rtl"
                style={{
                  color: theme.titleColor,
                  fontFamily: detectScriptClass(slide.arabicText) === 'urdu-text'
                    ? "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif"
                    : "'Noto Naskh Arabic', 'Amiri', serif",
                  fontSize: detectScriptClass(slide.arabicText) === 'urdu-text' ? '28px' : '36px',
                  lineHeight: detectScriptClass(slide.arabicText) === 'urdu-text' ? '2.4' : '1.8',
                }}
              >
                {slide.arabicText}
              </div>
              {slide.transliteration && (
                <div
                  className="text-[12px] italic mt-1.5 tracking-wide"
                  style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
                >
                  {slide.transliteration}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bullets */}
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-2 flex-1">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed" style={{ color: theme.bodyColor }}>
                <span
                  className="w-2 h-2 rounded-full mt-[5px] shrink-0"
                  style={{ background: theme.bulletColor }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Activity instruction callout */}
        {slide.activityInstruction && (
          <div
            className="mt-auto pt-3 px-3.5 py-2.5 rounded-lg border-l-[3px] text-[11px] leading-relaxed"
            style={{
              borderColor: theme.accent,
              background: isDark ? 'rgba(255,255,255,0.06)' : theme.accentLight,
              color: isDark ? 'rgba(255,255,255,0.7)' : theme.bodyColor,
            }}
          >
            <span className="font-semibold" style={{ color: theme.accent }}>Activity: </span>
            {slide.activityInstruction}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-6 py-2 text-[9px] z-10"
        style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
          color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
        }}
      >
        <span>{courseName || ''}</span>
        {slide.teacherNote && (
          <span className="italic max-w-[60%] truncate" style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)' }}>
            📝 {slide.teacherNote}
          </span>
        )}
      </div>
    </div>
  );
}

function QuizCard({ q, index, total, showAnswer, template }: { q: QuizQuestion; index: number; total: number; showAnswer: boolean; template?: VisualTemplate }) {
  const accentColor = template?.colors?.accent || '#1a56b0';
  const diffColor = q.difficulty === "easy" ? "text-green-700 bg-green-50" : q.difficulty === "hard" ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";
  return (
    <div className="bg-white border border-[#e8e9eb] rounded-[10px] p-3.5">
      <div className="text-[10px] uppercase font-medium mb-1.5" style={{ color: accentColor }}>Question {index + 1} of {total} · {q.type.replace("_", " ")}</div>
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

function FlashcardItem({ card, template }: { card: Flashcard; template?: VisualTemplate }) {
  const [flipped, setFlipped] = useState(false);
  const posColors = { noun: '#1a7340', verb: '#b85c1a', phrase: '#534AB7', expression: '#b42a2a' };
  const posColor = posColors[card.partOfSpeech as keyof typeof posColors] || '#4a90d9';
  const frontBg = template ? `linear-gradient(135deg, ${template.colors.primary}, ${template.colors.accent}44)` : 'linear-gradient(135deg, #0f2044, #1a3a6c)';
  const frontBorder = template ? `1px solid ${template.colors.accent}55` : '1px solid rgba(74,144,217,0.3)';
  const accentForFront = template?.colors?.accent || '#4a90d9';

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
      style={{
        minHeight: 160,
        background: !flipped ? frontBg : 'linear-gradient(135deg, #ffffff, #f0faf4)',
        border: !flipped ? frontBorder : '1px solid #d0e8d9',
      }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10"
        style={{ background: !flipped ? '#4a90d9' : posColor }} />

      {!flipped ? (
        <div className="p-5 flex flex-col items-center justify-center h-full gap-2">
          <div className="text-[28px] text-white text-center leading-snug" dir="rtl"
            style={{ fontFamily: detectScriptClass(card.arabic) === 'urdu-text' ? "'Noto Nastaliq Urdu', serif" : "'Noto Naskh Arabic', 'Amiri', serif", lineHeight: detectScriptClass(card.arabic) === 'urdu-text' ? '2.4' : '1.6' }}>
            {card.arabic}
          </div>
          <span className="text-[9px] uppercase tracking-[0.15em] opacity-70 mt-1" style={{ color: accentForFront }}>
            Tap to reveal
          </span>
        </div>
      ) : (
        <div className="p-5 flex flex-col items-center justify-center h-full gap-1.5">
          <div className="text-[16px] font-bold text-[#0f2044] text-center">{card.english}</div>
          <div className="text-[12px] italic" style={{ color: '#6b7280' }}>{card.transliteration}</div>
          <span className="text-[8px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 rounded-full mt-1"
            style={{ background: `${posColor}18`, color: posColor }}>
            {card.partOfSpeech}
          </span>
          {card.exampleSentence && (
            <div className="mt-2 px-3 py-2 rounded-lg w-full text-center" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div className="text-[13px] text-[#0f2044]" dir="rtl"
                style={{ fontFamily: detectScriptClass(card.arabic) === 'urdu-text' ? "'Noto Nastaliq Urdu', serif" : "'Noto Naskh Arabic', 'Amiri', serif", lineHeight: detectScriptClass(card.arabic) === 'urdu-text' ? '2.4' : '1.6' }}>
                {card.exampleSentence}
              </div>
              {card.exampleTranslation && (
                <div className="text-[10px] text-[#9ca3af] mt-1">{card.exampleTranslation}</div>
              )}
            </div>
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
  const progress = ((index + 1) / cards.length) * 100;
  const posColors = { noun: '#1a7340', verb: '#b85c1a', phrase: '#534AB7', expression: '#b42a2a' };
  const posColor = posColors[card.partOfSpeech as keyof typeof posColors] || '#4a90d9';

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Progress bar */}
      <div className="w-[440px] mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-[#6b7280]">Card {index + 1} of {cards.length}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={onShuffle}><Shuffle className="w-3 h-3 mr-1" /> Shuffle</Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6 px-2" onClick={onExit}><X className="w-3 h-3 mr-1" /> Exit</Button>
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #4a90d9, #1a7340)' }} />
        </div>
      </div>

      {/* Card */}
      <div
        onClick={onFlip}
        className="rounded-2xl w-[440px] h-[300px] flex items-center justify-center cursor-pointer transition-all duration-300 hover:shadow-xl relative overflow-hidden"
        style={{
          background: !flipped
            ? 'linear-gradient(135deg, #0f2044, #1a3a6c)'
            : 'linear-gradient(135deg, #ffffff, #f8fafb)',
          border: !flipped ? '2px solid rgba(74,144,217,0.3)' : '2px solid #e5e7eb',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-10"
          style={{ background: !flipped ? '#4a90d9' : posColor }} />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-5"
          style={{ background: !flipped ? '#4a90d9' : posColor }} />

        {!flipped ? (
          <div className="text-center z-10 px-8">
            <div className="text-[44px] text-white leading-snug" dir="rtl"
              style={{ fontFamily: detectScriptClass(card.arabic) === 'urdu-text' ? "'Noto Nastaliq Urdu', serif" : "'Noto Naskh Arabic', 'Amiri', serif", lineHeight: detectScriptClass(card.arabic) === 'urdu-text' ? '2.4' : '1.6' }}>
              {card.arabic}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#4a90d9] opacity-60">
              Tap or press Space to reveal
            </div>
          </div>
        ) : (
          <div className="text-center px-8 z-10">
            <div className="text-[26px] font-bold text-[#0f2044] mb-1">{card.english}</div>
            <div className="text-[15px] italic text-[#9ca3af]">{card.transliteration}</div>
            <span className="inline-block text-[9px] uppercase tracking-[0.15em] font-semibold px-2.5 py-0.5 rounded-full mt-2"
              style={{ background: `${posColor}18`, color: posColor }}>
              {card.partOfSpeech}
            </span>
            {card.exampleSentence && (
              <div className="mt-4 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <div className="text-[16px] text-[#0f2044]" dir="rtl"
                  style={{ fontFamily: detectScriptClass(card.arabic) === 'urdu-text' ? "'Noto Nastaliq Urdu', serif" : "'Noto Naskh Arabic', 'Amiri', serif", lineHeight: detectScriptClass(card.arabic) === 'urdu-text' ? '2.4' : '1.6' }}>
                  {card.exampleSentence}
                </div>
                {card.exampleTranslation && (
                  <div className="text-[11px] text-[#9ca3af] mt-1">{card.exampleTranslation}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-4 mt-5">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={index === 0} className="h-9 w-9 p-0 rounded-full">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-[10px] text-[#aab0bc] tracking-wide">Space to flip · Arrows to navigate</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={index === cards.length - 1} className="h-9 w-9 p-0 rounded-full">
          <ArrowRight className="w-4 h-4" />
        </Button>
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
