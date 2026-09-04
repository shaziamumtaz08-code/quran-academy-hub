import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VcrAdapter } from '../adapter';
import { DocUnit } from './DocUnit';

export interface DocSource {
  id: string;
  title: string;
  file_path: string | null;
  url: string | null;
  type: string | null;
  pages_count: number | null;
  syllabus_folder?: string | null;
  syllabus_order?: number | null;
  is_personal?: boolean;
  uploaded_by?: string | null;
}

const isImageSource = (s: DocSource) =>
  /^image/i.test(s.type || '') ||
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(s.file_path || s.url || '');

/** Library-backed PDF / image reader for the Virtual Class Room. */
export function useDocAdapter({
  item,
  resumePage,
}: {
  item: DocSource | null;
  resumePage?: number | null;
}): VcrAdapter {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(item?.pages_count || 1);

  useEffect(() => {
    let cancelled = false;
    setFileUrl(null);
    setNumPages(item?.pages_count || 1);
    if (!item) return;

    (async () => {
      if (item.file_path) {
        const { data } = await supabase.storage.from('resources').createSignedUrl(item.file_path, 3600);
        if (!cancelled) setFileUrl(data?.signedUrl ?? item.url ?? null);
      } else if (!cancelled) {
        setFileUrl(item.url ?? null);
      }
    })();

    return () => { cancelled = true; };
  }, [item?.id, item?.file_path, item?.url]);

  const isImage = item ? isImageSource(item) : false;

  return useMemo<VcrAdapter>(() => ({
    contentType: isImage ? 'image' : 'pdf',
    libraryItemId: item?.id ?? null,
    totalUnits: isImage ? 1 : Math.max(numPages, 1),
    currentLabel: item?.title ?? 'Syllabus file',
    currentSubLabel: isImage ? 'Image' : `PDF · ${Math.max(numPages, 1)} pages`,
    unitNoun: 'page',
    resolveStartUnit: async () => (resumePage && resumePage > 0 ? resumePage : null),
    referenceFor: (unit) => ({ page: unit, library_item_id: item?.id ?? null }),
    renderUnit: (unit, ctx) => (
      <DocUnit
        fileUrl={fileUrl}
        isPdf={!isImage}
        page={unit}
        fontScale={ctx.fontScale}
        onNumPages={(n) => setNumPages((prev) => (prev === n ? prev : n))}
      />
    ),
  }), [item?.id, item?.title, fileUrl, isImage, numPages, resumePage]);
}
