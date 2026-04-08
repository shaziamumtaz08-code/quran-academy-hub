import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, BookOpen, Download, Share2, ArrowRight, Plus, Trash2, FileText, Link, Type, Upload, X, Check, RotateCcw, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// ─── Types ───
interface SyllabusRow {
  week: number;
  topic: string;
  objectives: string;
  contentTypes: string[];
  edited?: boolean;
}

const SUBJECTS = ['Arabic Language', 'Hifz / Quran Memorisation', 'Tajweed', 'Islamic Studies', 'Fiqh', 'Seerah', 'Urdu', 'Other'];
const LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Upper Intermediate', 'Advanced', 'All Levels'];
const DURATIONS = ['4 weeks', '6 weeks', '8 weeks', '10 weeks', '12 weeks', '16 weeks', '24 weeks', 'Custom'];
const SESSIONS = ['1', '2', '3', '5 (daily)', 'Custom'];
const CONTENT_TYPES = ['Lesson', 'Practice', 'Quiz', 'Discussion', 'Project'];
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Lesson: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Practice: { bg: 'bg-blue-50', text: 'text-blue-700' },
  Quiz: { bg: 'bg-red-50', text: 'text-red-700' },
  Discussion: { bg: 'bg-amber-50', text: 'text-amber-700' },
  Project: { bg: 'bg-violet-50', text: 'text-violet-700' },
};

// ─── Editable Cell ───
function EditableCell({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
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
    <div
      onClick={() => setEditing(true)}
      className={`cursor-text min-h-[32px] p-[6px_4px] text-[12.5px] text-[#0f2044] leading-relaxed rounded-[5px] transition-colors hover:bg-[#f4f5f7] ${className}`}
    >
      {value || <span className="text-[#aab0bc] italic">Click to edit</span>}
    </div>
  );
}

// ─── Content Type Badge Popover ───
function ContentTypeBadges({ types, onChange }: { types: string[]; onChange: (t: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (t: string) => {
    onChange(types.includes(t) ? types.filter(x => x !== t) : [...types, t]);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1 cursor-pointer" onClick={() => setOpen(!open)}>
        {types.length === 0 && <span className="text-[10px] text-[#aab0bc]">+ Add</span>}
        {types.map(t => (
          <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[t]?.bg || 'bg-gray-100'} ${TYPE_COLORS[t]?.text || 'text-gray-600'}`}>
            {t}
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#e8e9eb] rounded-lg shadow-lg p-2 z-50 min-w-[140px]">
          {CONTENT_TYPES.map(t => (
            <label key={t} className="flex items-center gap-2 px-2 py-1.5 text-[11px] cursor-pointer hover:bg-[#f4f5f7] rounded">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} className="rounded border-gray-300" />
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${TYPE_COLORS[t]?.bg} ${TYPE_COLORS[t]?.text}`}>{t}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function TeachingOS() {
  const { user } = useAuth();

  // Input state
  const [courseName, setCourseName] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [duration, setDuration] = useState('8 weeks');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('2');
  const [targetAudience, setTargetAudience] = useState('');
  const [learningGoals, setLearningGoals] = useState('');
  const [sourceTab, setSourceTab] = useState<'pdf' | 'paste' | 'url'>('pdf');
  const [pasteText, setPasteText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfParsed, setPdfParsed] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [nameError, setNameError] = useState(false);

  // Syllabus state
  const [rows, setRows] = useState<SyllabusRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamingWeek, setStreamingWeek] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syllabusId, setSyllabusId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const durationWeeks = parseInt(duration) || 8;
  const totalSessions = durationWeeks * (parseInt(sessionsPerWeek) || 2);

  // ─── Auto-save ───
  const autoSave = useCallback(async (currentRows: SyllabusRow[]) => {
    if (!user || currentRows.length === 0) return;
    setSaveStatus('saving');
    try {
      const payload = {
        user_id: user.id,
        course_name: courseName || 'Untitled',
        subject, level,
        duration_weeks: durationWeeks,
        sessions_week: parseInt(sessionsPerWeek) || 2,
        target_audience: targetAudience,
        learning_goals: learningGoals,
        source_text: pdfText || pasteText || '',
        rows: currentRows,
        status: 'draft',
      };
      if (syllabusId) {
        await supabase.from('syllabi').update(payload).eq('id', syllabusId);
      } else {
        const { data } = await supabase.from('syllabi').insert(payload).select('id').single();
        if (data) setSyllabusId(data.id);
      }
      setSaveStatus('saved');
    } catch { setSaveStatus('error'); }
  }, [user, courseName, subject, level, durationWeeks, sessionsPerWeek, targetAudience, learningGoals, pdfText, pasteText, syllabusId]);

  const debouncedSave = useCallback((currentRows: SyllabusRow[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => autoSave(currentRows), 800);
  }, [autoSave]);

  // ─── Generate ───
  const handleGenerate = async () => {
    if (!courseName.trim()) { setNameError(true); return; }
    setNameError(false);
    setGenerating(true);
    setCompleted(false);
    setRows([]);
    setStreamingWeek(1);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-syllabus`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            courseName, subject, level, duration, sessionsPerWeek,
            targetAudience, learningGoals,
            sourceText: pdfText || pasteText || '',
          }),
          signal: controller.signal,
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

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
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

        // Try to parse completed JSON objects from fullContent
        try {
          const cleaned = fullContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          const arr = JSON.parse(cleaned);
          if (Array.isArray(arr)) {
            setRows(arr.map((r: any) => ({
              week: r.week || 0,
              topic: r.topic || '',
              objectives: r.objectives || '',
              contentTypes: r.contentTypes || [],
              edited: false,
            })));
            setStreamingWeek(arr.length);
          }
        } catch { /* not yet complete */ }
      }

      // Final parse
      try {
        const cleaned = fullContent.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
        const arr = JSON.parse(cleaned);
        if (Array.isArray(arr)) {
          const finalRows = arr.map((r: any) => ({
            week: r.week || 0,
            topic: r.topic || '',
            objectives: r.objectives || '',
            contentTypes: r.contentTypes || [],
            edited: false,
          }));
          setRows(finalRows);
          setCompleted(true);
          toast.success(`Syllabus generated · ${finalRows.length} weeks · ${finalRows.length * (parseInt(sessionsPerWeek) || 2)} total sessions`);
          autoSave(finalRows);
        }
      } catch {
        if (rows.length === 0) toast.error('No content generated — try adding more details to Learning goals');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error(e.message || 'Generation failed');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => { abortRef.current?.abort(); };

  // ─── Row operations ───
  const updateRow = (idx: number, field: keyof SyllabusRow, value: any) => {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value, edited: true } : r);
    setRows(updated);
    debouncedSave(updated);
  };

  const addRowBelow = (idx: number) => {
    const newRow: SyllabusRow = { week: rows.length + 1, topic: '', objectives: '', contentTypes: ['Lesson'], edited: false };
    const updated = [...rows.slice(0, idx + 1), newRow, ...rows.slice(idx + 1)].map((r, i) => ({ ...r, week: i + 1 }));
    setRows(updated);
    debouncedSave(updated);
  };

  const deleteRow = (idx: number) => {
    const deleted = rows[idx];
    const updated = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, week: i + 1 }));
    setRows(updated);
    debouncedSave(updated);
    toast('Row deleted', {
      action: { label: 'Undo', onClick: () => { const restored = [...updated.slice(0, idx), deleted, ...updated.slice(idx)].map((r, i) => ({ ...r, week: i + 1 })); setRows(restored); debouncedSave(restored); } },
      duration: 4000,
    });
  };

  const addWeekManually = () => {
    const newRow: SyllabusRow = { week: rows.length + 1, topic: '', objectives: '', contentTypes: ['Lesson'], edited: false };
    const updated = [...rows, newRow];
    setRows(updated);
    debouncedSave(updated);
  };

  // ─── Export ───
  const exportCSV = () => {
    const header = 'Week,Topic,Objectives,Content Types\n';
    const csv = rows.map(r => `${r.week},"${r.topic.replace(/"/g, '""')}","${r.objectives.replace(/"/g, '""')}","${r.contentTypes.join(', ')}"`).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseName || 'syllabus'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const copyMarkdown = () => {
    const md = `| Week | Topic | Objectives | Content Types |\n|------|-------|------------|---------------|\n` +
      rows.map(r => `| ${r.week} | ${r.topic} | ${r.objectives} | ${r.contentTypes.join(', ')} |`).join('\n');
    navigator.clipboard.writeText(md);
    toast.success('Copied to clipboard');
  };

  // ─── Select input component ───
  const SelectField = ({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: string[]; hint?: string }) => (
    <div>
      <div className="flex items-center justify-between mb-[5px]">
        <label className="text-[11px] font-medium text-[#4a5264]">{label}</label>
        {hint && <span className="text-[10px] text-[#aab0bc]">{hint}</span>}
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-48px)] overflow-hidden bg-[#f4f5f7]">
        {/* ─── LEFT PANEL ─── */}
        <div className="w-[320px] min-w-[320px] bg-white border-r border-[#e8e9eb] flex flex-col overflow-hidden">
          <div className="px-[18px] pt-4 pb-[14px] border-b border-[#e8e9eb]">
            <h2 className="text-[15px] font-medium text-[#0f2044]">Input engine</h2>
            <p className="text-[11px] text-[#7a7f8a]">Define your course — AI builds the syllabus</p>
          </div>
          <div className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-[14px]">
            {/* Course title */}
            <div>
              <label className="text-[11px] font-medium text-[#4a5264] mb-[5px] flex items-center gap-1">Course title <span className="text-red-500">*</span></label>
              <input value={courseName} onChange={(e) => { setCourseName(e.target.value); setNameError(false); }} placeholder="e.g. Spoken Arabic for Beginners"
                className={`w-full border rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none ${nameError ? 'border-red-500' : 'border-[#d0d4dc]'}`} />
              {nameError && <p className="text-[10px] text-red-500 mt-1">Course title required</p>}
            </div>

            {/* Subject + Level */}
            <div className="grid grid-cols-2 gap-[10px]">
              <SelectField label="Subject" value={subject} onChange={setSubject} options={SUBJECTS} />
              <SelectField label="Level" value={level} onChange={setLevel} options={LEVELS} />
            </div>

            {/* Duration + Sessions */}
            <div className="grid grid-cols-2 gap-[10px]">
              <SelectField label="Duration" value={duration} onChange={setDuration} options={DURATIONS} />
              <SelectField label="Sessions/week" value={sessionsPerWeek} onChange={setSessionsPerWeek} options={SESSIONS} />
            </div>

            {/* Target audience */}
            <div>
              <label className="text-[11px] font-medium text-[#4a5264] mb-[5px] block">Target audience</label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Adult beginners, no prior Arabic"
                className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none" />
            </div>

            {/* Learning goals */}
            <div>
              <div className="flex items-center justify-between mb-[5px]">
                <label className="text-[11px] font-medium text-[#4a5264]">Learning goals</label>
                <span className="text-[10px] text-[#aab0bc]">optional — AI uses this</span>
              </div>
              <textarea value={learningGoals} onChange={(e) => setLearningGoals(e.target.value)} rows={2} placeholder="e.g. Basic conversation, Quran reading foundation…"
                className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none resize-none" />
            </div>

            {/* Source material */}
            <div>
              <div className="flex items-center justify-between mb-[5px]">
                <label className="text-[11px] font-medium text-[#4a5264]">Source material</label>
                <span className="text-[10px] text-[#aab0bc]">optional</span>
              </div>
              <div className="border border-[#e8e9eb] rounded-lg overflow-hidden">
                <div className="flex">
                  {(['pdf', 'paste', 'url'] as const).map(tab => (
                    <button key={tab} onClick={() => setSourceTab(tab)}
                      className={`flex-1 py-2 text-[11px] font-medium transition-colors ${sourceTab === tab ? 'bg-white text-[#0f2044]' : 'bg-[#f9f9fb] text-[#7a7f8a]'}`}>
                      {tab === 'pdf' ? 'PDF upload' : tab === 'paste' ? 'Paste text' : 'URL'}
                    </button>
                  ))}
                </div>
                <div className="p-3">
                  {sourceTab === 'pdf' && (
                    pdfFile ? (
                      <div>
                        <div className="flex items-center gap-2 bg-[#f0f4ff] border border-[#b5d0f8] rounded-[7px] px-3 py-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span className="text-[11px] text-[#0f2044] truncate flex-1">{pdfFile.name}</span>
                          <span className="text-[10px] text-[#7a7f8a]">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</span>
                          <button onClick={() => { setPdfFile(null); setPdfText(''); setPdfParsed(false); }}><X className="h-3 w-3 text-[#7a7f8a]" /></button>
                        </div>
                        {pdfParsed && <p className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1"><Check className="h-3 w-3" /> PDF parsed · {pdfText.length} chars extracted</p>}
                      </div>
                    ) : (
                      <label className="border border-dashed border-[#c8d4e8] rounded-[9px] p-[18px] text-center bg-[#f9fbff] cursor-pointer block">
                        <Upload className="h-[22px] w-[22px] text-[#aab0bc] mx-auto mb-1" />
                        <p className="text-[12px] text-[#4a5264]">Drop PDF here or click to upload</p>
                        <p className="text-[11px] text-[#aab0bc]">Max 10MB · PDF only</p>
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
                          setPdfFile(file);
                          // For now, store the file name as placeholder
                          setPdfText(`[PDF content from: ${file.name}]`);
                          setPdfParsed(true);
                        }} />
                      </label>
                    )
                  )}
                  {sourceTab === 'paste' && (
                    <div className="relative">
                      <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value.slice(0, 8000))} rows={5}
                        placeholder="Paste your existing curriculum, outline, or any reference material…"
                        className="w-full border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none resize-none" />
                      <span className={`absolute bottom-2 right-2 text-[11px] ${pasteText.length >= 7000 ? 'text-amber-500' : 'text-[#aab0bc]'}`}>
                        {pasteText.length} / 8000
                      </span>
                    </div>
                  )}
                  {sourceTab === 'url' && (
                    <div className="flex gap-2">
                      <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…"
                        className="flex-1 border border-[#d0d4dc] rounded-[7px] px-[10px] py-[7px] text-[12.5px] text-[#0f2044] focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 outline-none" />
                      <button className="px-3 py-[7px] border border-[#d0d4dc] rounded-[6px] text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">Fetch</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#e8e9eb]" />

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={generating}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-[10px] text-[13px] font-medium transition-colors ${generating ? 'bg-[#4a5264] text-white cursor-not-allowed' : 'bg-[#0f2044] text-white hover:bg-[#1a2d54]'}`}>
              {generating ? <><Loader2 className="h-[14px] w-[14px] animate-spin" /> Generating…</> : completed ? <><Check className="h-[14px] w-[14px] text-emerald-400" /> Regenerate syllabus</> : <><Sparkles className="h-[14px] w-[14px]" /> Generate syllabus with AI</>}
            </button>
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sticky header */}
          <div className="h-[52px] min-h-[52px] bg-white border-b border-[#e8e9eb] px-[18px] flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-medium text-[#0f2044]">
                {courseName || 'Untitled'} — Syllabus
              </h3>
              <p className="text-[11px] text-[#7a7f8a]">
                {durationWeeks} weeks · {totalSessions} sessions · {level || 'No level'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && <span className="text-[11px] text-[#aab0bc]">Saving…</span>}
              {saveStatus === 'saved' && <span className="text-[11px] text-[#aab0bc]">Saved</span>}
              {rows.length > 0 && (
                <>
                  <div className="relative group">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d0d4dc] rounded-[6px] text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">
                      <Download className="h-3.5 w-3.5" /> Export
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-[#e8e9eb] rounded-lg shadow-lg py-1 min-w-[160px] hidden group-hover:block z-50">
                      <button onClick={exportCSV} className="w-full text-left px-3 py-2 text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">Export as CSV</button>
                      <button onClick={copyMarkdown} className="w-full text-left px-3 py-2 text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">Copy as Markdown</button>
                    </div>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d0d4dc] rounded-[6px] text-[11px] text-[#4a5264] hover:bg-[#f4f5f7]">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f2044] text-white rounded-[6px] text-[11px] font-medium hover:bg-[#1a2d54]">
                    Next: Planner <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Streaming banner */}
          {generating && (
            <div className="mx-[18px] mt-3 bg-[#f0f4ff] border border-[#b5d0f8] rounded-lg px-[14px] py-[10px] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] text-[#1a56b0]">
                <Loader2 className="h-[14px] w-[14px] animate-spin" />
                Generating week {streamingWeek} of {durationWeeks}…
              </div>
              <button onClick={stopGeneration} className="text-[11px] text-[#b42a2a] border border-[#f09595] rounded-[5px] px-2 py-[3px] hover:bg-red-50">
                Stop generation ×
              </button>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-[18px]">
            {rows.length === 0 && !generating ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BookOpen className="h-9 w-9 text-[#d0d4dc] mb-3" strokeWidth={1.5} />
                <p className="text-[14px] text-[#7a7f8a] mb-1">Your syllabus will appear here</p>
                <p className="text-[12px] text-[#aab0bc]">Fill in the course details and click Generate</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-[#e8e9eb] overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-[#e8e9eb] z-10">
                    <tr>
                      <th className="w-[70px] text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Week</th>
                      <th className="text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Topic</th>
                      <th className="w-[22%] text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Objectives</th>
                      <th className="w-[18%] text-[10px] uppercase tracking-wider text-[#aab0bc] font-medium px-[10px] py-2 text-left">Content Types</th>
                      <th className="w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="group border-b border-[#f0f1f3] hover:bg-[#fafbfc] transition-colors">
                        <td className="px-[10px] py-[10px]">
                          <div className="relative inline-flex items-center justify-center w-5 h-5 bg-[#eef2fa] text-[#1a56b0] text-[10px] font-medium rounded-full">
                            {row.week}
                            {row.edited && <span className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] bg-[#1a56b0] rounded-full" />}
                          </div>
                        </td>
                        <td className="px-[10px] py-1">
                          <EditableCell value={row.topic} onChange={(v) => updateRow(idx, 'topic', v)} />
                        </td>
                        <td className="px-[10px] py-1">
                          <EditableCell value={row.objectives} onChange={(v) => updateRow(idx, 'objectives', v)} />
                        </td>
                        <td className="px-[10px] py-[10px]">
                          <ContentTypeBadges types={row.contentTypes} onChange={(t) => updateRow(idx, 'contentTypes', t)} />
                        </td>
                        <td className="px-1 py-[10px]">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => addRowBelow(idx)} className="p-1 rounded-[5px] border border-[#e8e9eb] hover:bg-[#eef2fa] text-[#1a56b0]" title="Add row below">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteRow(idx)} className="p-1 rounded-[5px] border border-[#e8e9eb] hover:bg-[#fde8e8] text-[#b42a2a]" title="Delete row">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Add week manually */}
                <button onClick={addWeekManually} className="w-full flex items-center gap-2 px-[14px] py-[10px] text-[12px] text-[#aab0bc] hover:text-[#1a56b0] hover:bg-[#f9fbff] transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add week manually
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
