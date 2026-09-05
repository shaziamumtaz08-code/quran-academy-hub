import React, { useMemo, useState } from 'react';
import { Copy, Loader2, Share2, Upload } from 'lucide-react';
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
  onOpenPrivate: (t: VcrOpenTarget) => void;
  onOpenSynced: (t: VcrOpenTarget) => void;
  onUpload?: () => void;
}

function OpenActions({ target, onOpenPrivate, onOpenSynced }: {
  target: VcrOpenTarget;
  onOpenPrivate: (t: VcrOpenTarget) => void;
  onOpenSynced: (t: VcrOpenTarget) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={() => onOpenPrivate(target)}
        title="Open just for me — nothing is shared"
        className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-900/15 bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <Copy className="h-3 w-3" /> Open
      </button>
      <button
        type="button"
        onClick={() => onOpenSynced(target)}
        title="Put it on the shared classroom workspace so the other person sees it too"
        className="inline-flex h-7 items-center gap-1 rounded-full border border-vcr-gold/60 bg-vcr-gold/20 px-2.5 text-[11px] font-medium text-slate-900 hover:bg-vcr-gold/30"
      >
        <Share2 className="h-3 w-3" /> Share
      </button>
    </div>

  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-slate-900/8 bg-slate-900/[0.03] px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-800">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-slate-500">{subtitle}</span>}
      </span>
      {children}
    </li>
  );
}

/** Whatever the VCR app rail is pointing at, rendered inside the classroom. */
export function VcrAppPanel({
  app, docs, docsLoading, docsError, userId, onOpenPrivate, onOpenSynced, onUpload,
}: Props) {
  const { mine, sharedWithMe, isLoading: resourcesLoading } = useMyResources();
  const [link, setLink] = useState('');

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
        <div className={cn('flex gap-2', !embed && 'pointer-events-none opacity-50')}>
          <OpenActions target={target} onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced} />
        </div>
      </div>
    );
  }

  if (app === 'syllabus') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          The set material for this student. Qaida and Mushaf are interactive class apps — annotations,
          bookmarks, marks and notes are saved with the class.
        </p>
        <ul className="space-y-1.5">
          <Row title="Noorani Qaida" subtitle="Interactive lesson pages">
            <OpenActions
              target={{ kind: 'content', content: 'qaida', title: 'Noorani Qaida' }}
              onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
            />
          </Row>
          <Row title="Mushaf" subtitle="Interactive Qur’an pages">
            <OpenActions
              target={{ kind: 'content', content: 'mushaf', title: 'Mushaf' }}
              onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
            />
          </Row>
        </ul>
        {docsLoading && <p className="text-sm text-slate-500"><Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Loading syllabus files…</p>}
        {docsError && <p className="text-sm text-red-600">Could not load syllabus files: {docsError}</p>}
        {!docsLoading && !docsError && syllabusDocs.length === 0 && (
          <p className="text-sm text-slate-500">No syllabus files have been set for this class yet.</p>
        )}
        <ul className="space-y-1.5">
          {syllabusDocs.map((d) => (
            <Row key={d.id} title={d.title} subtitle={d.syllabus_folder ?? 'Syllabus'}>
              <OpenActions
                target={{ kind: 'doc', docId: d.id, title: d.title }}
                onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
              />
            </Row>
          ))}
        </ul>
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
            <Row key={d.id} title={d.title} subtitle={d.syllabus_folder ?? 'Library'}>
              <OpenActions
                target={{ kind: 'doc', docId: d.id, title: d.title }}
                onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
              />
            </Row>
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
          Your own space. Your copies keep your marks and notes; they stay private until you choose Synced Copy.
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
          <Row key={r.id} title={r.title} subtitle={r.kind === 'copy' ? 'My copy' : 'Library link'}>
            <OpenActions
              target={{ kind: 'resource', resourceId: r.id, title: r.title }}
              onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
            />
          </Row>
        ))}
        {sharedWithMe.map((r) => (
          <Row key={r.id} title={r.title} subtitle="Shared with me">
            <OpenActions
              target={{ kind: 'resource', resourceId: r.id, title: r.title }}
              onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
            />
          </Row>
        ))}
        {myDocs.map((d) => (
          <Row key={d.id} title={d.title} subtitle="My upload">
            <OpenActions
              target={{ kind: 'doc', docId: d.id, title: d.title }}
              onOpenPrivate={onOpenPrivate} onOpenSynced={onOpenSynced}
            />
          </Row>
        ))}
      </ul>
    </div>
  );
}
