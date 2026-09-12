import React, { useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { useMyResources } from '@/hooks/useMyResources';
import { toEmbedUrl } from '@/hooks/useVcrRoomState';
import type { VcrRailKey } from './VcrAppRail';
import { cn } from '@/lib/utils';

export interface VcrOpenTarget {
  kind: 'doc' | 'resource' | 'content' | 'link';
  title: string;
  docId?: string;
  resourceId?: string;
  content?: 'mushaf' | 'qaida';
  /** Open the content straight at this page (e.g. the first page of a Baab). */
  page?: number;
  url?: string;
  app?: 'drive' | 'youtube' | 'url';
}


interface DocRow {
  id: string; title: string; syllabus_folder?: string | null; syllabus_order?: number | null;
  is_personal?: boolean; is_syllabus?: boolean; uploaded_by?: string | null;
}

interface Props {
  app: Exclude<VcrRailKey, 'whiteboard' | 'call' | 'recordings'>;
  docs: DocRow[];
  docsLoading: boolean;
  docsError: string | null;
  userId: string | null;
  /** Which books belong to this student's subject — Qaida, the Mushaf, or both. */
  books?: Array<'qaida' | 'mushaf'>;
  /** Opening is the only action: the Share screen switch decides who else sees it. */
  onOpen: (t: VcrOpenTarget) => void;
  onUpload?: () => void;
}

function Row({ title, subtitle, onOpen }: {
  title: string; subtitle?: string; onOpen?: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-900/8 bg-slate-900/[0.03]">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="w-full px-3 py-2 text-left"
          title="Open this now"
        >
          <span className="block truncate text-sm font-medium text-slate-800 hover:text-slate-950 hover:underline">{title}</span>
          {subtitle && <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>}
        </button>
      ) : (
        <span className="block px-3 py-2">
          <span className="block truncate text-sm text-slate-800">{title}</span>
          {subtitle && <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>}
        </span>
      )}
    </li>
  );
}

/** Whatever the VCR app rail is pointing at, rendered inside the classroom. */
export function VcrAppPanel({
  app, docs, docsLoading, docsError, userId, books, onOpen, onUpload,
}: Props) {
  const { mine, sharedWithMe, isLoading: resourcesLoading } = useMyResources();
  const [link, setLink] = useState('');

  const myBooks = books && books.length ? books : (['qaida', 'mushaf'] as const);

  const syllabusDocs = useMemo(
    () => docs.filter((d) => d.is_syllabus || (!d.is_personal && !!d.syllabus_folder)),
    [docs],
  );
  const libraryDocs = useMemo(
    () => docs.filter((d) => !d.is_personal),
    [docs],
  );
  const myDocs = useMemo(
    () => docs.filter((d) => d.is_personal && d.uploaded_by === userId),
    [docs, userId],
  );

  if (app === 'drive' || app === 'youtube' || app === 'url') {
    const label = app === 'drive' ? 'Google Drive link' : app === 'youtube' ? 'YouTube link' : 'Web address';
    const embed = toEmbedUrl(link, app);
    const target: VcrOpenTarget = { kind: 'link', app, title: label, url: embed ?? '' };
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {app === 'drive'
            ? 'Paste a Google Drive file or folder link. Anyone you share it with in Drive can see it here.'
            : app === 'youtube'
              ? 'Paste a YouTube link to watch it together in class.'
              : 'Paste any web address to open it in the class workspace.'}
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
          className="h-10 w-full rounded-xl border border-slate-900/15 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-vcr-gold/60 focus:outline-none"
        />
        {link && !embed && (
          <p className="text-xs text-red-600">That link is not one we can open here. Check it and try again.</p>
        )}
        <button
          type="button"
          disabled={!embed}
          onClick={() => onOpen(target)}
          className={cn(
            'inline-flex h-9 items-center rounded-full border border-slate-900/15 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50',
            !embed && 'pointer-events-none opacity-50',
          )}
        >
          Open
        </button>
      </div>
    );
  }

  if (app === 'syllabus') {
    /* Books, not pages: the Qaida and the Mushaf each carry their own index,
       so chapter- or page-level files never appear as separate syllabus rows. */
    const extraFiles = syllabusDocs.filter((d) => {
      const t = d.title.trim().toLowerCase();
      if (t === 'noorani qaida' || t === 'mushaf') return false;
      if (/^baab\s*\d+/.test(t) || /^juz\s*\d+/.test(t) || /^para\s*\d+/.test(t)) return false;
      if (/^(page|surah)\s*\d+/.test(t)) return false;
      return true;
    });
    const folders = Array.from(new Set(extraFiles.map((d) => d.syllabus_folder || 'Other materials')));

    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The books and materials for this student. Tap one to open it.
        </p>

        <ul className="space-y-1.5">
          {myBooks.includes('qaida') && (
            <Row
              title="Noorani Qaida"
              subtitle="Complete book — cover, index, then all chapters"
              onOpen={() => onOpen({ kind: 'content', content: 'qaida', title: 'Noorani Qaida' })}
            />
          )}
          {myBooks.includes('mushaf') && (
            <Row
              title="Mushaf"
              subtitle="Complete Qur’an — cover, index by juz and surah, then all pages"
              onOpen={() => onOpen({ kind: 'content', content: 'mushaf', title: 'Mushaf' })}
            />
          )}
        </ul>

        {docsLoading && <p className="text-sm text-slate-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading…</p>}
        {docsError && <p className="text-sm text-red-600">Could not load syllabus files: {docsError}</p>}
        {!docsLoading && !docsError && folders.map((folder) => (
          <div key={folder}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{folder}</p>
            <ul className="space-y-1.5">
              {extraFiles
                .filter((d) => (d.syllabus_folder || 'Other materials') === folder)
                .map((d) => (
                  <Row
                    key={d.id}
                    title={d.title}
                    onOpen={() => onOpen({ kind: 'doc', docId: d.id, title: d.title })}
                  />
                ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (app === 'library') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          The academy library. Opening an item never changes the original.
        </p>
        {docsLoading && <p className="text-sm text-slate-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading the library…</p>}
        {docsError && <p className="text-sm text-red-600">Could not load the library: {docsError}</p>}
        {!docsLoading && !docsError && libraryDocs.length === 0 && (
          <p className="text-sm text-slate-500">Nothing in the library is available to you yet.</p>
        )}
        <ul className="space-y-1.5">
          {libraryDocs.map((d) => (
            <Row
              key={d.id}
              title={d.title}
              subtitle={d.syllabus_folder ?? 'Library'}
              onOpen={() => onOpen({ kind: 'doc', docId: d.id, title: d.title })}
            />
          ))}
        </ul>
      </div>
    );
  }

  /* My Drive / My Resources */
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          Your own space. Your copies keep your marks and notes, and stay private unless you share your screen.
        </p>
        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-900/15 px-3 text-xs text-slate-700 hover:bg-slate-900/5 hover:text-slate-900"
          >
            <Upload className="h-3.5 w-3.5" /> Add file
          </button>
        )}
      </div>
      {resourcesLoading && <p className="text-sm text-slate-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading your files…</p>}
      {!resourcesLoading && mine.length === 0 && sharedWithMe.length === 0 && myDocs.length === 0 && (
        <p className="text-sm text-slate-500">Nothing here yet. Add a file, or save something from the Library.</p>
      )}
      <ul className="space-y-1.5">
        {mine.map((r) => (
          <Row
            key={r.id}
            title={r.title}
            subtitle={r.kind === 'copy' ? 'My copy' : 'Library link'}
            onOpen={() => onOpen({ kind: 'resource', resourceId: r.id, title: r.title })}
          />
        ))}
        {sharedWithMe.map((r) => (
          <Row
            key={r.id}
            title={r.title}
            subtitle="Shared with me"
            onOpen={() => onOpen({ kind: 'resource', resourceId: r.id, title: r.title })}
          />
        ))}
        {myDocs.map((d) => (
          <Row
            key={d.id}
            title={d.title}
            subtitle="My upload"
            onOpen={() => onOpen({ kind: 'doc', docId: d.id, title: d.title })}
          />
        ))}
      </ul>
    </div>
  );
}
