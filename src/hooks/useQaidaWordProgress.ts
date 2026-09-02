import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError } from '@/lib/handleSupabaseError';

export type QaidaWordStatus = 'mastered' | 'needs_practice';

export interface QaidaWordProgressRow {
  word_id: string;
  status: QaidaWordStatus;
  bookmarked: boolean;
  updated_at: string;
}

/**
 * Per-student Qaida word progress (flashcard grading).
 * Falls back to an in-memory map when there is no student in context — the
 * flashcards still work, they just aren't persisted.
 */
export function useQaidaWordProgress(studentId?: string | null) {
  const [rows, setRows] = useState<Record<string, QaidaWordProgressRow>>({});
  const [loading, setLoading] = useState(!!studentId);

  useEffect(() => {
    if (!studentId) { setRows({}); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('qaida_word_progress' as any)
        .select('word_id, status, bookmarked, updated_at')
        .eq('student_id', studentId);
      if (cancelled) return;
      if (error) handleSupabaseError(error, 'load Qaida progress');
      const map: Record<string, QaidaWordProgressRow> = {};
      ((data as any[]) || []).forEach((r) => { map[r.word_id] = r as QaidaWordProgressRow; });
      setRows(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const setStatus = useCallback(
    async (wordId: string, status: QaidaWordStatus) => {
      const now = new Date().toISOString();
      setRows((prev) => ({
        ...prev,
        [wordId]: { word_id: wordId, status, bookmarked: prev[wordId]?.bookmarked ?? false, updated_at: now },
      }));
      if (!studentId) return;
      const { error } = await supabase
        .from('qaida_word_progress' as any)
        .upsert(
          { student_id: studentId, word_id: wordId, status, updated_at: now },
          { onConflict: 'student_id,word_id' },
        );
      if (error) handleSupabaseError(error, 'save Qaida progress');
    },
    [studentId],
  );

  const toggleBookmark = useCallback(
    async (wordId: string) => {
      const next = !(rows[wordId]?.bookmarked ?? false);
      const now = new Date().toISOString();
      setRows((prev) => ({
        ...prev,
        [wordId]: {
          word_id: wordId,
          status: prev[wordId]?.status ?? 'needs_practice',
          bookmarked: next,
          updated_at: now,
        },
      }));
      if (!studentId) return;
      const { error } = await supabase
        .from('qaida_word_progress' as any)
        .upsert(
          {
            student_id: studentId,
            word_id: wordId,
            status: rows[wordId]?.status ?? 'needs_practice',
            bookmarked: next,
            updated_at: now,
          },
          { onConflict: 'student_id,word_id' },
        );
      if (error) handleSupabaseError(error, 'save Qaida bookmark');
    },
    [studentId, rows],
  );

  const gradedIds = useMemo(() => Object.keys(rows), [rows]);

  return { progress: rows, gradedIds, loading, setStatus, toggleBookmark };
}

export default useQaidaWordProgress;
