import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/teaching/LanguageSelector';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Sparkles, FileText, Upload, X, Check, Loader2, ChevronDown, Search,
  Download, ArrowRight, Calendar, Clock, Plus, ChevronRight, RotateCcw
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

// ─── Types ───
interface SourceFile {
  id: string;
  file: File;
  filename: string;
  pageCount: number;
  extractedText: string;
  detectedChapters: { number: number; title: string; pageApprox: number }[];
  detecting: boolean;
  numberOfDays: number;
  durationPerDay: string;
  pageStart: number;
  pageEnd: number;
}

interface OutlineRow {
  dayNumber: number;
  sourceIndex: number;
  sourceFilename: string;
  chapterNumber: number | null;
  chapterTitle: string | null;
  topic: string;
  pageStart: number;
  pageEnd: number;
  durationMinutes: number;
  notes: string | null;
  approved: boolean;
  dayName?: string;
  sessionDate?: string;
}

const DAYS_PRESETS = [
  { label: 'Sun–Thu', days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
  { label: 'Mon–Fri', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { label: 'Mon–Sat', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
  { label: 'Sat–Wed', days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'] },
];
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Editable Cell ───
function EditableCell({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);
  if (editing) {
    return (
      <textarea ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        rows={Math.max(2, Math.ceil(draft.length / 40))}
        className="w-full border border-blue-600 rounded-[5px] shadow-[0_0_0_3px_rgba(26,86,176,0.08)] p-[5px_6px] text-[12.5px] resize-none font-inherit bg-white outline-none"
      />
    );
  }
  return (
    <div onClick={() => setEditing(true)}
      className={`cursor-text min-h-[32px] p-[6px_4px] text-[12.5px] text-[#0f2044] leading-relaxed rounded-[5px] transition-colors hover:bg-[#f4f5f7] ${className}`}>
      {value || <span className="text-[#aab0bc] italic">Click to edit</span>}
    </div>
  );
}

export default function TeachingOSOutline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language, langClass } = useLanguage();

  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(searchParams.get('course_id'));
  const [courseName, setCourseName] = useState('');
  const [courseSearchOpen, setCourseSearchOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const courseDropdownRef = useRef<HTMLDivElement>(null);

  // Source files
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);

  // Schedule config
  const [daysPreset, setDaysPreset] = useState('Mon–Fri');
  const [customDays, setCustomDays] = useState<string[]>([]);
  const [sessionTime, setSessionTime] = useState('6:00 PM');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Outline
  const [outlineRows, setOutlineRows] = useState<OutlineRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch courses
  const { data: courses = [] } = useQuery({
    queryKey: ['outline-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name, level, subject_id, subjects:subjects!courses_subject_id_fkey(name)').eq('status', 'active').order('name');
      return (data || []) as any[];
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    if (!courseSearchOpen) return;
    const handler = (e: MouseEvent) => { if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target as Node)) setCourseSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [courseSearchOpen]);

  const handleCourseSelect = (course: any) => {
    setSelectedCourseId(course.id);
    setCourseName(course.name);
    setCourseSearchOpen(false);
    setCourseSearch('');
  };

  const filteredCourses = courses.filter((c: any) => c.name.toLowerCase().includes(courseSearch.toLowerCase()));

  const selectedDays = daysPreset === 'Custom' ? customDays : (DAYS_PRESETS.find(p => p.label === daysPreset)?.days || []);

  // ─── File upload handler ───
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - sourceFiles.length;
    const toAdd = Array.from(files).slice(0, remaining);

    for (const file of toAdd) {
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name} too large (max 50MB)`); continue; }
      if (!file.name.endsWith('.pdf')) { toast.error(`${file.name} is not a PDF`); continue; }

      const id = crypto.randomUUID();
      const newSource: SourceFile = {
        id, file, filename: file.name, pageCount: 0, extractedText: '', detectedChapters: [],
        detecting: true, numberOfDays: 0, durationPerDay: '45 min', pageStart: 1, pageEnd: 0,
      };
      setSourceFiles(prev => [...prev, newSource]);

      // Parse PDF
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
        const text = fullText.trim().slice(0, 15000);

        setSourceFiles(prev => prev.map(s => s.id === id ? {
          ...s, pageCount: pdf.numPages, extractedText: text,
          pageEnd: pdf.numPages, numberOfDays: Math.ceil(pdf.numPages / 1.7),
        } : s));

        // Detect chapters via AI
        try {
          const resp = await supabase.functions.invoke('generate-outline', {
            body: { action: 'detect-chapters', text: text.substring(0, 3000), filename: file.name },
          });
          if (resp.data?.chapters) {
            setSourceFiles(prev => prev.map(s => s.id === id ? {
              ...s, detectedChapters: resp.data.chapters, detecting: false,
            } : s));
          } else {
            setSourceFiles(prev => prev.map(s => s.id === id ? { ...s, detecting: false } : s));
          }
        } catch {
          setSourceFiles(prev => prev.map(s => s.id === id ? { ...s, detecting: false } : s));
        }

        toast.success(`${file.name} parsed · ${pdf.numPages} pages`);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to parse ${file.name}`);
        setSourceFiles(prev => prev.filter(s => s.id !== id));
      }
    }
  };

  const removeFile = (id: string) => {
    setSourceFiles(prev => prev.filter(s => s.id !== id));
  };

  const updateSource = (id: string, field: keyof SourceFile, value: any) => {
    setSourceFiles(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // ─── Generate outline ───
  const handleGenerate = async () => {
    if (!selectedCourseId) { toast.error('Please select a course'); return; }
    if (sourceFiles.length === 0) { toast.error('Upload at least one PDF'); return; }
    if (sourceFiles.some(s => s.numberOfDays <= 0)) { toast.error('Set number of days for each source'); return; }

    setGenerating(true);
    setOutlineRows([]);

    try {
      const sources = sourceFiles.map(s => ({
        filename: s.filename,
        text: s.extractedText,
        pageCount: s.pageCount,
        detectedChapters: s.detectedChapters,
        numberOfDays: s.numberOfDays,
        durationPerDay: s.durationPerDay,
        pageStart: s.pageStart,
        pageEnd: s.pageEnd,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            sources, daysOfWeek: selectedDays, startDate, sessionTime, language,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Generation failed');
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { /* partial */ }
        }

        // Try incremental parse
        try {
          const cleaned = fullContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          const arr = JSON.parse(cleaned);
          if (Array.isArray(arr)) {
            setOutlineRows(mapToOutlineRows(arr));
          }
        } catch { /* not yet complete */ }
      }

      // Final parse
      const cleaned = fullContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      try {
        const arr = JSON.parse(cleaned);
        if (Array.isArray(arr)) {
          const rows = mapToOutlineRows(arr);
          setOutlineRows(rows);
          toast.success(`Outline generated · ${rows.length} days`);
        }
      } catch {
        if (outlineRows.length === 0) toast.error('Failed to parse AI response');
      }
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const mapToOutlineRows = (arr: any[]): OutlineRow[] => {
    const sd = new Date(startDate);
    return arr.map((r: any, i: number) => {
      // Calculate date for this day
      let dayDate = new Date(sd);
      let daysAdded = 0;
      let calDays = 0;
      while (daysAdded < i) {
        calDays++;
        const d = new Date(sd);
        d.setDate(sd.getDate() + calDays);
        const dayName = ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        if (selectedDays.includes(dayName)) daysAdded++;
      }
      dayDate.setDate(sd.getDate() + calDays);
      const dayName = ALL_DAYS[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1];

      return {
        dayNumber: r.dayNumber || i + 1,
        sourceIndex: r.sourceIndex || 0,
        sourceFilename: r.sourceFilename || sourceFiles[r.sourceIndex || 0]?.filename || '',
        chapterNumber: r.chapterNumber || null,
        chapterTitle: r.chapterTitle || null,
        topic: r.topic || '',
        pageStart: r.pageStart || 0,
        pageEnd: r.pageEnd || 0,
        durationMinutes: r.durationMinutes || 45,
        notes: r.notes || null,
        approved: false,
        dayName,
        sessionDate: dayDate.toISOString().split('T')[0],
      };
    });
  };

  // ─── Approve ───
  const toggleApprove = (idx: number) => {
    setOutlineRows(prev => prev.map((r, i) => i === idx ? { ...r, approved: !r.approved } : r));
  };

  const approveAll = () => {
    setOutlineRows(prev => prev.map(r => ({ ...r, approved: true })));
  };

  const approvedCount = outlineRows.filter(r => r.approved).length;

  // ─── Save & navigate to syllabus ───
  const handleApproveAndGenerate = async () => {
    if (!selectedCourseId) return;
    setSaving(true);
    try {
      // Save outline rows to DB
      const rows = outlineRows.map(r => ({
        course_id: selectedCourseId,
        source_filename: r.sourceFilename,
        day_number: r.dayNumber,
        day_name: r.dayName || null,
        session_date: r.sessionDate || null,
        chapter_number: r.chapterNumber,
        chapter_title: r.chapterTitle,
        topic: r.topic,
        page_start: r.pageStart,
        page_end: r.pageEnd,
        duration_minutes: r.durationMinutes,
        notes: r.notes,
        approved: r.approved,
      }));

      // Delete existing outlines for this course first
      await (supabase.from('course_outlines') as any).delete().eq('course_id', selectedCourseId);
      const { error } = await (supabase.from('course_outlines') as any).insert(rows);
      if (error) throw error;

      // Save source files
      for (const sf of sourceFiles) {
        await (supabase.from('source_files') as any).insert({
          course_id: selectedCourseId,
          filename: sf.filename,
          page_count: sf.pageCount,
          extracted_text: sf.extractedText.substring(0, 50000),
          detected_chapters: sf.detectedChapters,
        });
      }

      toast.success('Outline saved');
      const params = new URLSearchParams({ course_id: selectedCourseId });
      navigate(`/teaching-os?${params.toString()}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Export ───
  const exportCSV = () => {
    const header = 'Day,Date,Day Name,Chapter,Topic,Pages,Duration,Source,Approved\n';
    const csv = outlineRows.map(r =>
      `${r.dayNumber},"${r.sessionDate || ''}","${r.dayName || ''}","${r.chapterTitle || ''}","${r.topic.replace(/"/g, '""')}","Pg ${r.pageStart}–${r.pageEnd}",${r.durationMinutes},"${r.sourceFilename}",${r.approved ? 'yes' : 'no'}`
    ).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseName || 'outline'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const totalDays = sourceFiles.reduce((s, f) => s + f.numberOfDays, 0);
  const totalPages = sourceFiles.reduce((s, f) => s + f.pageCount, 0);
  const totalChapters = sourceFiles.reduce((s, f) => s + f.detectedChapters.length, 0);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden bg-[#f4f5f7]">
        {/* ─── LEFT PANEL ─── */}
        <div className="w-[340px] min-w-[340px] bg-white border-r border-[#e8e9eb] flex flex-col overflow-hidden">
          <div className="px-[18px] pt-4 pb-[14px] border-b border-[#e8e9eb]">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => navigate('/teaching-os')} className="text-[11px] text-[#1a56b0] hover:underline">
                ← Teaching OS
              </button>
            </div>
            <h2 className="text-[15px] font-medium text-[#0f2044]">Outline Generator</h2>
            <p className="text-[11px] text-[#7a7f8a] mb-2">Upload books — AI creates a day-by-day teaching plan</p>
            <LanguageSelector showLabel />
          </div>

          <div className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-[14px]">
            {/* Course selector */}
            <div ref={courseDropdownRef} className="relative">
              <label className="text-[11px] font-medium text-[#4a5264] mb-[5px] flex items-center gap-1">Select course <span className="text-red-500">*</span></label>
              <button type="button" onClick={() => setCourseSearchOpen(!courseSearchOpen)}
                className="w-full flex items-center justify-between border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-left bg-white">
                <span className={selectedCourseId ? 'text-[#0f2044]' : 'text-[#aab0bc]'}>{courseName || 'Choose a course…'}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#aab0bc]" />
              </button>
              {courseSearchOpen && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[#e8e9eb] rounded-lg shadow-lg max-h-[240px] overflow-hidden flex flex-col">
                  <div className="px-2 pt-2 pb-1">
                    <div className="flex items-center gap-1.5 border border-[#d0d4dc] rounded-[6px] px-2 py-[5px]">
                      <Search className="h-3 w-3 text-[#aab0bc]" />
                      <input autoFocus value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
                        placeholder="Search courses…" className="flex-1 text-[11px] text-[#0f2044] outline-none bg-transparent" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {filteredCourses.map((c: any) => (
                      <button key={c.id} onClick={() => handleCourseSelect(c)}
                        className={`w-full text-left px-3 py-[7px] text-[12px] hover:bg-[#f0f4ff] ${selectedCourseId === c.id ? 'bg-[#eef2fa] text-[#1a56b0] font-medium' : 'text-[#0f2044]'}`}>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Source books/files */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium mb-2 block">Source Books / Files</label>
              <div className="space-y-2">
                {sourceFiles.map(sf => (
                  <div key={sf.id} className="bg-[#f0f4ff] border border-[#b5d0f8] rounded-[7px] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#0f2044] truncate font-medium">{sf.filename}</p>
                        <p className="text-[10px] text-[#7a7f8a]">
                          {sf.pageCount > 0 ? `${sf.pageCount} pages` : 'Parsing…'}
                          {sf.detectedChapters.length > 0 && ` · ${sf.detectedChapters.length} chapters detected`}
                        </p>
                      </div>
                      <span className="text-[10px] text-[#7a7f8a]">{(sf.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => removeFile(sf.id)}><X className="h-3 w-3 text-[#7a7f8a] hover:text-red-500" /></button>
                    </div>
                    {sf.detecting && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#1a56b0]">
                        <Loader2 className="h-3 w-3 animate-spin" /> Detecting chapters…
                      </div>
                    )}
                    {!sf.detecting && sf.detectedChapters.length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-[#1a56b0] cursor-pointer hover:underline">
                          AI detected {sf.detectedChapters.length} chapters
                        </summary>
                        <div className="mt-1 space-y-0.5 pl-2">
                          {sf.detectedChapters.map((ch, i) => (
                            <p key={i} className="text-[10px] text-[#7a7f8a]">Ch {ch.number}: {ch.title}</p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
                {sourceFiles.length < 5 && (
                  <label className="border border-dashed border-[#c8d4e8] rounded-[9px] p-[14px] text-center bg-[#f9fbff] cursor-pointer block">
                    <Upload className="h-5 w-5 text-[#aab0bc] mx-auto mb-1" />
                    <p className="text-[11px] text-[#4a5264]">{sourceFiles.length > 0 ? '+ Add another file' : 'Drop PDFs here or click to upload'}</p>
                    <p className="text-[10px] text-[#aab0bc]">Max 5 files · 50MB each</p>
                    <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                  </label>
                )}
              </div>
            </div>

            {/* Schedule configuration per file */}
            {sourceFiles.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium mb-2 block">Schedule Configuration</label>
                <p className="text-[10px] text-[#7a7f8a] mb-2">
                  {sourceFiles.length > 1 ? 'Multiple files detected — configure days for each source separately' : 'Configure schedule for your source'}
                </p>
                {sourceFiles.map(sf => (
                  <div key={sf.id} className="border border-[#e8e9eb] rounded-[9px] p-3 mb-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3 w-3 text-[#7a7f8a]" />
                      <span className="text-[11px] font-medium text-[#0f2044] truncate">
                        {sf.filename.length > 30 ? sf.filename.slice(0, 27) + '...' : sf.filename}
                        {sf.pageCount > 0 && ` (${sf.pageCount} pages)`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#7a7f8a] block mb-1">Number of days</label>
                        <input type="number" min={1} max={365} value={sf.numberOfDays || ''}
                          onChange={(e) => updateSource(sf.id, 'numberOfDays', parseInt(e.target.value) || 0)}
                          placeholder="e.g. 40"
                          className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#7a7f8a] block mb-1">Duration per day</label>
                        <input value={sf.durationPerDay}
                          onChange={(e) => updateSource(sf.id, 'durationPerDay', e.target.value)}
                          placeholder="e.g. 45 min"
                          className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white outline-none" />
                      </div>
                    </div>
                    {sf.numberOfDays > 0 && sf.pageCount > 0 && (
                      <p className="text-[10px] text-[#1a56b0] mt-1.5">
                        = {(sf.pageCount / sf.numberOfDays).toFixed(1)} pages per day · {sf.detectedChapters.length} chapters
                        {sf.pageCount / sf.numberOfDays <= 2 && ' · Beginner'}
                        {sf.pageCount / sf.numberOfDays > 2 && sf.pageCount / sf.numberOfDays <= 4 && ' · Intermediate'}
                        {sf.pageCount / sf.numberOfDays > 4 && ' · Advanced'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Day naming */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium mb-2 block">Day Naming</label>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] text-[#7a7f8a] block mb-1">Days of week</label>
                  <select value={daysPreset} onChange={(e) => setDaysPreset(e.target.value)}
                    className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white outline-none">
                    {DAYS_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                {daysPreset === 'Custom' && (
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_DAYS.map(d => (
                      <label key={d} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] cursor-pointer border ${customDays.includes(d) ? 'bg-[#eef2fa] border-[#1a56b0] text-[#1a56b0]' : 'border-[#e8e9eb] text-[#7a7f8a]'}`}>
                        <input type="checkbox" checked={customDays.includes(d)} onChange={() => setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])} className="hidden" />
                        {d.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#7a7f8a] block mb-1">Session time</label>
                    <input value={sessionTime} onChange={(e) => setSessionTime(e.target.value)}
                      placeholder="e.g. 6:00 PM"
                      className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#7a7f8a] block mb-1">Start date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e8e9eb]" />

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={generating}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-[10px] text-[13px] font-medium transition-colors ${generating ? 'bg-[#4a5264] text-white cursor-not-allowed' : 'bg-[#0f2044] text-white hover:bg-[#1a2d54]'}`}>
              {generating ? <><Loader2 className="h-[14px] w-[14px] animate-spin" /> Generating…</> : <><Sparkles className="h-[14px] w-[14px]" /> Generate outline with AI</>}
            </button>
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="min-h-[52px] bg-white border-b border-[#e8e9eb] px-[18px] flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-medium text-[#0f2044]">
                {courseName || 'Untitled'} — Outline · {totalDays} days
              </h3>
              <p className="text-[11px] text-[#7a7f8a]">
                {totalPages} pages · {totalChapters} chapters detected · {sourceFiles[0]?.durationPerDay || '45 min'}/day
              </p>
            </div>
            <div className="flex items-center gap-2">
              {outlineRows.length > 0 && (
                <>
                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d0d4dc] rounded-[6px] text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">
                      <Download className="h-3.5 w-3.5" /> Export
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-[#e8e9eb] rounded-lg shadow-lg py-1 min-w-[140px] hidden group-hover:block z-50">
                      <button onClick={exportCSV} className="w-full text-left px-3 py-2 text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">Export CSV</button>
                    </div>
                  </div>
                  <button onClick={handleApproveAndGenerate} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f2044] text-white rounded-[6px] text-[11px] font-medium hover:bg-[#1a2d54] disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Approve → generate syllabus</>}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* AI detection banner */}
          {outlineRows.length > 0 && (
            <div className="mx-[18px] mt-3 bg-[#f0f4ff] border border-[#b5d0f8] rounded-lg px-[14px] py-[10px] text-[12px] text-[#1a56b0]">
              <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />
              AI detected {totalChapters} chapters from PDF · Pages auto-distributed across {outlineRows.length} days · Click any cell to edit · Approve row-by-row or approve all
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-[18px]">
            {outlineRows.length === 0 && !generating ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="h-9 w-9 text-[#d0d4dc] mb-3" strokeWidth={1.5} />
                <p className="text-[14px] text-[#7a7f8a] mb-1">Your outline will appear here</p>
                <p className="text-[12px] text-[#aab0bc]">Upload PDFs and click Generate</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#e8e9eb] overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-[#e8e9eb] z-10">
                    <tr>
                      <th className="w-[120px] text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Day</th>
                      <th className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Pages</th>
                      <th className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Topic / Chapter</th>
                      <th className="w-[100px] text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Duration</th>
                      <th className="w-[52px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outlineRows.map((row, idx) => (
                      <tr key={idx}
                        className={`group border-b border-[#f0f1f3] transition-colors ${row.approved ? 'bg-[#f0fff4]' : 'hover:bg-[#fafbfc]'}`}>
                        <td className="px-[10px] py-[10px]">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${row.approved ? 'bg-[#1a7340] text-white' : 'bg-[#eef2fa] text-[#1a56b0]'}`}>
                              {row.dayNumber}
                            </div>
                            <div>
                              <div className="text-[11px] text-[#0f2044] font-medium">{row.dayName}</div>
                              <div className="text-[9px] text-[#aab0bc]">{row.sessionDate ? new Date(row.sessionDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-[10px] py-[10px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sourceFiles.length > 1 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#eef2fa] text-[#1a56b0]">
                                Book {row.sourceIndex + 1}
                              </span>
                            )}
                            <span className="text-[12px] text-[#0f2044]">Pg {row.pageStart}–{row.pageEnd}</span>
                          </div>
                        </td>
                        <td className="px-[10px] py-1">
                          <div className="flex items-start gap-1.5">
                            <div className={`flex-1 ${langClass}`}>
                              <EditableCell value={row.topic} onChange={(v) => setOutlineRows(prev => prev.map((r, i) => i === idx ? { ...r, topic: v } : r))} />
                            </div>
                            {row.chapterNumber && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#f3eefe] text-[#534AB7] shrink-0 mt-1">
                                Ch {row.chapterNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-[10px] py-[10px] text-[12px] text-[#0f2044]">
                          {row.durationMinutes} min
                        </td>
                        <td className="px-[6px] py-[10px]">
                          <button onClick={() => toggleApprove(idx)}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${row.approved ? 'bg-[#1a7340] text-white' : 'border border-[#d0d4dc] text-[#aab0bc] hover:border-[#1a7340] hover:text-[#1a7340]'}`}>
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Footer bar */}
                <div className="sticky bottom-0 bg-white border-t border-[#e8e9eb] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-[#7a7f8a]">
                    {approvedCount} of {outlineRows.length} days approved · {outlineRows.length - approvedCount} pending
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={approveAll}
                      className="px-3 py-1.5 border border-[#d0d4dc] rounded-[6px] text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">
                      Approve all {outlineRows.length} days
                    </button>
                    <button onClick={handleApproveAndGenerate} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f2044] text-white rounded-[6px] text-[11px] font-medium hover:bg-[#1a2d54] disabled:opacity-50">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Approve & generate syllabus <ArrowRight className="h-3 w-3" /></>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
