import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RotateCw, Search, ShieldAlert, Video } from 'lucide-react';
import { toEmbedUrl } from '@/hooks/useVcrRoomState';
import { cn } from '@/lib/utils';

type WebApp = 'drive' | 'youtube' | 'google' | 'url' | 'zoom';

interface Props {
  app: WebApp;
  initialUrl?: string;
  /** Tell the room what this tab is showing, so the title can follow. */
  onTitle?: (title: string) => void;
  /** Put the current page on the shared class workspace. */
  onShare?: (url: string, title: string) => void;
}

function hostOf(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

/**
 * Only two things can genuinely live inside the classroom: a single YouTube
 * video and a single Google Drive file. Everything else — Google search,
 * YouTube browsing, the Drive file browser, Zoom, arbitrary web addresses —
 * is blocked by the site itself, so we never even attempt a frame.
 */
function embedTarget(url: string): string | null {
  if (!url) return null;
  const h = hostOf(url);
  if (/(^|\.)youtube\.com$/i.test(h) || /(^|\.)youtu\.be$/i.test(h)) {
    const embed = url.includes('/embed/') ? url : toEmbedUrl(url, 'youtube');
    return embed && embed.includes('/embed/') ? embed : null;
  }
  if (/(^|\.)google\.com$/i.test(h) && /^drive\./i.test(h)) {
    const embed = /\/preview(\?|$)/.test(url) ? url : toEmbedUrl(url, 'drive');
    return embed && /\/preview(\?|$)/.test(embed) ? embed : null;
  }
  return null;
}

function normalise(raw: string, app: WebApp): string {
  const v = raw.trim();
  if (!v) return '';
  if (app === 'youtube') return /^https?:\/\//i.test(v) ? v : `https://www.youtube.com/results?search_query=${encodeURIComponent(v)}`;
  if (app === 'drive') return /^https?:\/\//i.test(v) ? v : 'https://drive.google.com/drive/my-drive';
  if (app === 'google' && !/^https?:\/\//i.test(v) && !v.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
  }
  if (app === 'zoom') {
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\d{9,11}$/.test(v)) return `https://zoom.us/j/${v}`;
    return `https://zoom.us/j/${encodeURIComponent(v)}`;
  }
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const START: Record<WebApp, string> = {
  drive: 'https://drive.google.com/drive/my-drive',
  youtube: 'https://www.youtube.com/',
  google: 'https://www.google.com/',
  url: '',
  zoom: 'https://zoom.us/',
};

const PLACEHOLDER: Record<WebApp, string> = {
  drive: 'Paste a Google Drive file link to show it here',
  youtube: 'Paste a YouTube video link to play it here',
  google: 'Search Google, or type a web address',
  url: 'Type a web address',
  zoom: 'Paste the class Zoom link or meeting ID',
};

/**
 * A browser-like page inside the classroom: address field, the page itself when
 * the site allows framing, and a clean "open in your browser" card when it does not.
 */
export function VcrWebTab({ app, initialUrl, onTitle, onShare }: Props) {
  const [input, setInput] = useState(initialUrl ?? '');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [reload, setReload] = useState(0);

  const target = url || START[app];
  const embedSrc = useMemo(() => (app === 'zoom' ? null : embedTarget(url)), [url, app]);

  const onTitleRef = useRef(onTitle);
  onTitleRef.current = onTitle;

  useEffect(() => {
    const defaultTitle =
      app === 'url' ? 'Web'
      : app === 'google' ? 'Google'
      : app === 'drive' ? 'Google Drive'
      : app === 'zoom' ? 'Zoom'
      : 'YouTube';
    onTitleRef.current?.(url ? hostOf(url) || 'Web' : defaultTitle);
  }, [url, app]);

  const go = (value: string) => {
    const next = normalise(value, app);
    if (!next) return;
    setUrl(next);
    setInput(next);
  };

  return (
    <section className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]">
      <header className="flex items-center gap-2 border-b border-slate-900/8 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-2.5 py-2">
        {embedSrc && (
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            aria-label="Reload"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); go(input); }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-900/12 bg-white px-3 shadow-inner"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER[app]}
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </form>
        {onShare && embedSrc && (
          <button
            type="button"
            onClick={() => onShare(url, hostOf(url))}
            className="hidden h-8 shrink-0 items-center rounded-full border border-amber-400/60 bg-amber-300/25 px-3 text-xs font-medium text-slate-800 hover:bg-amber-300/40 sm:inline-flex"
          >
            Share
          </button>
        )}
        <a
          href={target || 'https://www.google.com/'}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-900/12 px-3 text-xs text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
      </header>

      <div className="relative flex-1 bg-white">
        {embedSrc ? (
          <iframe
            key={`${embedSrc}:${reload}`}
            title={hostOf(embedSrc) || 'Web page'}
            src={embedSrc}
            className={cn('h-full min-h-[58vh] w-full')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full min-h-[58vh] flex-col items-center justify-center gap-3 px-6 text-center">
            {app === 'zoom' ? (
              <>
                <Video className="h-7 w-7 text-indigo-500" />
                <p className="max-w-md text-sm text-slate-700">
                  Zoom always opens in its own tab. Paste the class link above if it is not
                  filled in yet, then press Join.
                </p>
                {url && <p className="max-w-md break-all text-xs text-slate-500">{url}</p>}
                <a
                  href={url || 'https://zoom.us/'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <Video className="h-4 w-4" /> Join
                </a>
              </>
            ) : !url ? (
              <>
                <Search className="h-6 w-6 text-slate-300" />
                <p className="max-w-sm text-sm text-slate-600">
                  {app === 'youtube'
                    ? 'Paste the link of one video and it will play right here in class. Browsing YouTube opens in your own browser tab.'
                    : app === 'drive'
                      ? 'Paste the link of one Google Drive file and it will show right here in class. The full Drive browser opens in your own browser tab.'
                      : 'Type what you are looking for, or a web address. It will open in your own browser tab.'}
                </p>
                <a
                  href={START[app] || 'https://www.google.com/'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" /> Open in new tab
                </a>
              </>
            ) : (
              <>
                <ShieldAlert className="h-6 w-6 text-amber-500" />
                <p className="max-w-md text-sm text-slate-700">
                  <span className="font-medium">{hostOf(url)}</span> does not allow itself to be shown inside
                  another page, so it opens in your own browser tab instead.
                </p>
                <p className="max-w-md break-all text-xs text-slate-500">{url}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" /> Open in new tab
                </a>
                {app === 'youtube' && (
                  <p className="max-w-md text-xs text-slate-500">
                    Paste the link of a single video and it will play right here.
                  </p>
                )}
                {app === 'drive' && (
                  <p className="max-w-md text-xs text-slate-500">
                    Paste the link of a single file and it will show right here.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
