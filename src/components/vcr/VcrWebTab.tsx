import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RotateCw, Search, ShieldAlert } from 'lucide-react';
import { toEmbedUrl } from '@/hooks/useVcrRoomState';
import { cn } from '@/lib/utils';

type WebApp = 'drive' | 'youtube' | 'google' | 'url';

interface Props {
  app: WebApp;
  initialUrl?: string;
  /** Tell the room what this tab is showing, so the title can follow. */
  onTitle?: (title: string) => void;
  /** Put the current page on the shared class workspace. */
  onShare?: (url: string, title: string) => void;
}

/** Sites that refuse to be framed — we never show them a broken black frame. */
const NEVER_EMBEDS = [
  /(^|\.)google\.com$/i,
  /(^|\.)accounts\.google\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)zoom\.us$/i,
];

function hostOf(url: string) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function canTryEmbed(url: string) {
  const h = hostOf(url);
  if (!h) return false;
  if (/^drive\.google\.com$/i.test(h)) return /\/(preview|embeddedfolderview)/.test(url);
  if (/^www\.youtube\.com$/i.test(h)) return url.includes('/embed/');
  return !NEVER_EMBEDS.some((re) => re.test(h));
}

function normalise(raw: string, app: WebApp): string {
  const v = raw.trim();
  if (!v) return '';
  if (app === 'youtube') return toEmbedUrl(v, 'youtube') ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(v)}`;
  if (app === 'drive') return toEmbedUrl(v, 'drive') ?? (/^https?:\/\//i.test(v) ? v : `https://drive.google.com/drive/my-drive`);
  if (app === 'google' && !/^https?:\/\//i.test(v) && !v.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(v)}`;
  }
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

const START: Record<WebApp, string> = {
  drive: 'https://drive.google.com/drive/my-drive',
  youtube: 'https://www.youtube.com/',
  google: 'https://www.google.com/',
  url: '',
};

const PLACEHOLDER: Record<WebApp, string> = {
  drive: 'Paste a Google Drive file or folder link',
  youtube: 'Search YouTube, or paste a video link',
  google: 'Search Google, or type a web address',
  url: 'Type a web address',
};

/**
 * A browser-like page inside the classroom: address field, the page itself when
 * the site allows framing, and a clean "open in your browser" card when it does not.
 */
export function VcrWebTab({ app, initialUrl, onTitle, onShare }: Props) {
  const [input, setInput] = useState(initialUrl ?? '');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timer = useRef<number | null>(null);

  const embeddable = useMemo(() => !!url && canTryEmbed(url), [url]);
  const target = url || START[app];

  useEffect(() => {
    onTitle?.(url ? hostOf(url) || 'Web' : app === 'url' ? 'Web' : app === 'google' ? 'Google' : app === 'drive' ? 'Google Drive' : 'YouTube');
  }, [url, app, onTitle]);

  useEffect(() => {
    if (!embeddable) return;
    setLoaded(false);
    setTimedOut(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTimedOut(true), 4000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [url, reload, embeddable]);

  const go = (value: string) => {
    const next = normalise(value, app);
    if (!next) return;
    setUrl(next);
    setInput(next);
  };

  const blocked = !embeddable || (timedOut && !loaded);

  return (
    <section className="flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)]">
      <header className="flex items-center gap-2 border-b border-slate-900/8 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          aria-label="Reload"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-900/5 hover:text-slate-800"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
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
        {onShare && url && (
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
        {url && embeddable && (
          <iframe
            key={`${url}:${reload}`}
            title={hostOf(url) || 'Web page'}
            src={url}
            onLoad={() => setLoaded(true)}
            className={cn('h-full min-h-[58vh] w-full', blocked && 'invisible')}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer"
          />
        )}
        {(!url || blocked) && (
          <div className="flex h-full min-h-[58vh] flex-col items-center justify-center gap-3 px-6 text-center">
            {!url ? (
              <>
                <Search className="h-6 w-6 text-slate-300" />
                <p className="max-w-sm text-sm text-slate-600">
                  {app === 'youtube'
                    ? 'Search for a video above, or paste a YouTube link to play it here in class.'
                    : app === 'drive'
                      ? 'Paste a Google Drive file or folder link above to open it here in class.'
                      : 'Type what you are looking for, or a web address, above.'}
                </p>
              </>
            ) : (
              <>
                <ShieldAlert className="h-6 w-6 text-amber-500" />
                <p className="max-w-md text-sm text-slate-700">
                  <span className="font-medium">{hostOf(url)}</span> does not allow itself to be shown inside
                  another page, so it cannot appear here.
                </p>
                <p className="max-w-md text-xs text-slate-500 break-all">{url}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <ExternalLink className="h-4 w-4" /> Open in your browser
                </a>
                {app === 'youtube' && (
                  <p className="max-w-md text-xs text-slate-500">
                    Paste the link of the video you want and it will play right here.
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
