import React from 'react';
import { ExternalLink, X } from 'lucide-react';

interface Props {
  title: string;
  src: string;
  synced: boolean;
  onClose?: () => void;
}

/** Google Drive / YouTube / web page shown inside the classroom working area. */
export function VcrEmbedViewer({ title, src, synced, onClose }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-vcr-chrome/15 bg-black/30">
      <header className="flex items-center gap-2 border-b border-vcr-chrome/10 px-3 py-2">
        <span className="truncate text-sm font-medium text-vcr-chrome">{title}</span>
        <span className="rounded-full border border-vcr-chrome/20 px-2 py-0.5 text-[11px] text-vcr-chrome/60">
          {synced ? 'Shared with the class' : 'Only you can see this'}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="ms-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-3 text-xs text-vcr-chrome/70 hover:text-vcr-chrome"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open in a new tab
        </a>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-3 text-xs text-vcr-chrome/70 hover:text-vcr-chrome"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        )}
      </header>
      <iframe
        title={title}
        src={src}
        className="h-[70vh] w-full bg-white"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        referrerPolicy="no-referrer"
      />
    </section>
  );
}
