import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QaidaBaab {
  id: string;
  baab_number: number;
  name_urdu: string;
  name_english: string;
  start_page: number;
  end_page: number;
  unit_type: 'word' | 'line';
  picker_mode: 'word_dropdown' | 'line_range';
  unit_label: 'word' | 'line' | 'phrase';
  total_units: number;
}

export interface QaidaWord {
  id: string;
  baab_id: string;
  page_number: number;
  line_number: number;
  word_position: number;
  word_text: string;
}

export interface QaidaPage {
  id: string;
  page_number: number;
  baab_id: string | null;
}


export interface BaabProgress extends QaidaBaab {
  unitsReached: number;
  percent: number;
}

export interface QaidaStudentProgress {
  baabs: BaabProgress[];
  overallPercent: number;
  totalUnits: number;
  unitsReached: number;
  currentBaab: BaabProgress | null;
  currentPage: number | null;
  currentUnit: number | null;
  lastDate: string | null;
}

/** Reference data: the 16 baabs + 32 physical pages of the Noorani Qaida. */
export function useQaidaReference() {
  return useQuery({
    queryKey: ['qaida-reference'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const [{ data: baabs, error: bErr }, { data: pages, error: pErr }] = await Promise.all([
        supabase.from('noorani_qaida_baabs' as any).select('*').order('baab_number'),
        supabase.from('noorani_qaida_pages' as any).select('*').order('page_number'),
      ]);
      if (bErr) throw bErr;
      if (pErr) throw pErr;
      return {
        baabs: (baabs || []) as unknown as QaidaBaab[],
        pages: (pages || []) as unknown as QaidaPage[],
      };
    },
  });
}

/** Which baabs cover a given physical page (transition pages belong to two baabs). */
export function baabsForPage(baabs: QaidaBaab[], page: number) {
  return baabs.filter(b => page >= b.start_page && page <= b.end_page);
}

export const unitLabel = (t?: string | null) => {
  if (t === 'line') return 'Line';
  if (t === 'phrase') return 'Phrase';
  return 'Word';
};

function buildProgress(
  baabs: QaidaBaab[],
  pages: QaidaPage[],
  rows: { qaida_baab_id?: string | null; qaida_page_id: string | null; qaida_unit_to: number | null; class_date: string }[],
): QaidaStudentProgress {
  const pageById = new Map(pages.map(p => [p.id, p]));
  const baabById = new Map(baabs.map(b => [b.id, b]));
  const reached = new Map<string, number>();
  let lastDate: string | null = null;
  let currentPage: number | null = null;
  let currentUnit: number | null = null;

  const sorted = [...rows].sort((a, b) => a.class_date.localeCompare(b.class_date));
  sorted.forEach(r => {
    const baabId = r.qaida_baab_id || (r.qaida_page_id ? pageById.get(r.qaida_page_id)?.baab_id : null);
    if (!baabId || !baabById.has(baabId)) return;
    const baab = baabById.get(baabId)!;
    const to = Number(r.qaida_unit_to || 0);
    reached.set(baabId, Math.max(reached.get(baabId) || 0, to));
    lastDate = r.class_date;
    const page = r.qaida_page_id ? pageById.get(r.qaida_page_id)?.page_number ?? baab.start_page : baab.start_page;
    if (currentPage === null || page >= currentPage) {
      currentPage = page;
      currentUnit = to || currentUnit;
    }
  });


  const withProgress: BaabProgress[] = baabs.map(b => {
    const unitsReached = Math.min(reached.get(b.id) || 0, b.total_units);
    return {
      ...b,
      unitsReached,
      percent: b.total_units > 0 ? Math.round((unitsReached / b.total_units) * 100) : 0,
    };
  });

  const totalUnits = withProgress.reduce((s, b) => s + b.total_units, 0);
  const unitsReached = withProgress.reduce((s, b) => s + b.unitsReached, 0);
  const currentBaab =
    [...withProgress].reverse().find(b => b.unitsReached > 0 && b.percent < 100) ||
    withProgress.find(b => b.unitsReached === 0) ||
    withProgress[withProgress.length - 1] ||
    null;

  return {
    baabs: withProgress,
    totalUnits,
    unitsReached,
    overallPercent: totalUnits > 0 ? Math.round((unitsReached / totalUnits) * 100) : 0,
    currentBaab,
    currentPage,
    currentUnit,
    lastDate,
  };
}

/** Per-student Qaida progress derived from attendance rows. */
export function useQaidaProgress(studentId?: string | null) {
  const { data: ref } = useQaidaReference();

  const { data: rows } = useQuery({
    queryKey: ['qaida-attendance', studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('qaida_baab_id, qaida_page_id, qaida_unit_to, class_date')
        .eq('student_id', studentId!)
        .or('qaida_page_id.not.is.null,qaida_baab_id.not.is.null')
        .order('class_date', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return useMemo(() => {
    if (!ref) return null;
    return buildProgress(ref.baabs, ref.pages, (rows || []) as any);
  }, [ref, rows]);
}

/** Progress for many students at once (teacher/admin reporting). */
export function useQaidaProgressForStudents(studentIds: string[]) {
  const { data: ref } = useQaidaReference();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['qaida-attendance-many', [...studentIds].sort().join(',')],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, qaida_baab_id, qaida_page_id, qaida_unit_to, class_date')
        .in('student_id', studentIds)
        .or('qaida_page_id.not.is.null,qaida_baab_id.not.is.null');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const map = useMemo(() => {
    const out = new Map<string, QaidaStudentProgress>();
    if (!ref) return out;
    const grouped = new Map<string, any[]>();
    (rows || []).forEach(r => {
      const list = grouped.get(r.student_id) || [];
      list.push(r);
      grouped.set(r.student_id, list);
    });
    studentIds.forEach(id => {
      out.set(id, buildProgress(ref.baabs, ref.pages, (grouped.get(id) || []) as any));
    });
    return out;
  }, [ref, rows, studentIds]);

  return { progressByStudent: map, baabs: ref?.baabs || [], isLoading };
}

/** Words / phrases belonging to a word_dropdown baab, ordered by line then position. */
export function useQaidaWords(baabId?: string | null) {
  return useQuery({
    queryKey: ['qaida-words', baabId],
    enabled: !!baabId,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('noorani_qaida_words' as any)
        .select('*')
        .eq('baab_id', baabId!)
        .order('line_number')
        .order('word_position');
      if (error) throw error;
      return (data || []) as unknown as QaidaWord[];
    },
  });
}

/** Continuous 1-based ordinal of each word inside its baab. */
export function wordOrdinals(words: QaidaWord[]) {
  const map = new Map<string, number>();
  words.forEach((w, i) => map.set(w.id, i + 1));
  return map;
}
