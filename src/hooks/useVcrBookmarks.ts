import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface VcrBookmark {
  id: string;
  student_id: string;
  created_by: string;
  content_type: string;
  library_item_id: string | null;
  unit: number;
  label: string | null;
  color: string | null;
  reference: Record<string, unknown> | null;
  scope: 'personal' | 'class';
}

/**
 * Bookmarks work the same way for every kind of lesson content — Mushaf,
 * Noorani Qaida and Library PDFs / images — keyed by content type, the
 * library item (when there is one) and the page.
 */
export function useVcrBookmarks({
  studentId,
  contentType,
  libraryItemId,
  enabled = true,
}: {
  studentId: string | null;
  contentType: string;
  libraryItemId?: string | null;
  enabled?: boolean;
}) {
  const [bookmarks, setBookmarks] = useState<VcrBookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!studentId || !enabled) { setBookmarks([]); return; }
    setLoading(true);
    let q = supabase
      .from('vcr_bookmarks' as any)
      .select('*')
      .eq('student_id', studentId)
      .eq('content_type', contentType)
      .order('unit');
    q = libraryItemId ? q.eq('library_item_id', libraryItemId) : q.is('library_item_id', null);
    const { data, error } = await q;
    setLoading(false);
    if (error) { console.error('bookmarks load failed', error); return; }
    setBookmarks(((data as any[]) ?? []) as VcrBookmark[]);
  }, [studentId, contentType, libraryItemId, enabled]);

  useEffect(() => { void load(); }, [load]);

  const add = useCallback(
    async (unit: number, label?: string | null, scope: 'personal' | 'class' = 'class') => {
      if (!studentId) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('vcr_bookmarks' as any).insert({
        student_id: studentId,
        created_by: auth.user?.id,
        content_type: contentType,
        library_item_id: libraryItemId ?? null,
        unit,
        label: label?.trim() || null,
        scope,
        reference: { page: unit },
      } as any);
      if (error) {
        toast({ title: 'Could not save bookmark', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: `Bookmarked page ${unit}` });
      void load();
    },
    [studentId, contentType, libraryItemId, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('vcr_bookmarks' as any).delete().eq('id', id);
      if (error) {
        toast({ title: 'Could not remove bookmark', description: error.message, variant: 'destructive' });
        return;
      }
      void load();
    },
    [load],
  );

  return { bookmarks, loading, add, remove, reload: load };
}
