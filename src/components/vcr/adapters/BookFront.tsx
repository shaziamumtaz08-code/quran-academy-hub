import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared look for the opening pages of a book-like material inside the VCR:
 * a calm, ornamented cover and an elegant index. No imagery of people —
 * geometry, script and gold rules only.
 */

export function BookCover({
  arabicTitle,
  title,
  subtitle,
  note,
  fontScale = 1,
}: {
  arabicTitle: string;
  title: string;
  subtitle?: string;
  note?: string;
  fontScale?: number;
}) {
  return (
    <div
      className="relative mx-auto flex h-full w-full flex-1 flex-col items-center justify-center gap-6 rounded-2xl border border-vcr-gold/40 bg-gradient-to-b from-amber-50/70 via-white/60 to-amber-50/40 px-6 py-10 text-center shadow-[0_18px_50px_-30px_rgba(60,50,90,0.6)]"
      style={{ fontSize: `${fontScale}rem` }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-3 rounded-xl border border-vcr-gold/30" />
      <span aria-hidden className="text-2xl text-vcr-gold">﴾ ✦ ﴿</span>
      <p dir="rtl" lang="ar" className="font-qaida text-5xl leading-[1.8] text-slate-900 sm:text-6xl">
        {arabicTitle}
      </p>
      <div className="h-px w-24 bg-vcr-gold/60" />
      <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">{title}</h1>
      {subtitle && <p className="max-w-md text-base text-slate-600">{subtitle}</p>}
      {note && <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">{note}</p>}
    </div>
  );
}

export function BookIndex({
  title,
  subtitle,
  children,
  fontScale = 1,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  fontScale?: number;
}) {
  return (
    <div className="mx-auto flex h-full w-full flex-1 flex-col" style={{ fontSize: `${fontScale}rem` }}>
      <div className="mb-4 text-center">
        <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        <div className="mx-auto mt-3 h-px w-20 bg-vcr-gold/60" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

export function IndexEntry({
  ordinal,
  title,
  arabic,
  meta,
  onOpen,
  className,
}: {
  ordinal?: string;
  title: string;
  arabic?: string | null;
  meta?: string;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl border border-slate-900/10 bg-white/70 px-3 py-2 text-left transition hover:border-vcr-gold/60 hover:bg-amber-50/80',
        className,
      )}
    >
      {ordinal && (
        <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-vcr-gold/40 bg-amber-50 px-1.5 font-mono text-xs text-slate-700">
          {ordinal}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-slate-950">{title}</span>
        {meta && <span className="block truncate text-[11px] text-slate-500">{meta}</span>}
      </span>
      {arabic && (
        <span dir="rtl" lang="ar" className="font-qaida shrink-0 text-xl leading-loose text-slate-700">
          {arabic}
        </span>
      )}
    </button>
  );
}
