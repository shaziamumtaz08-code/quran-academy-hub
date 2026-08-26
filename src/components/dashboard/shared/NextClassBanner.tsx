import React from 'react';
import { Clock, Video, BookOpen } from 'lucide-react';

interface NextClassBannerProps {
  /** Primary line — student name (or fallback title) */
  studentName: string;
  /** "Subject · Day Time" — e.g. "Nazra · Fri 11:00 AM" */
  scheduleLabel: string;
  /** "Xh Ym remaining" */
  countdownLabel: string;
  /** Platform name (e.g. "Google Meet", "Zoom") */
  platform?: string;
  /** Last lesson position (e.g. "Al-Ma'idah Ayah 27") */
  lastLesson?: string;
  /** Primary action button (Start / Rejoin) */
  action: React.ReactNode;
  /** Helper note under action (e.g. "Link goes live 5 min before") */
  actionHint?: string;
  /** Empty state — render placeholder banner */
  empty?: boolean;
  /** Custom copy for the empty state (e.g. academy holiday notice) */
  emptyMessage?: string;
}

export function NextClassBanner({
  studentName,
  scheduleLabel,
  countdownLabel,
  platform = 'Online class',
  lastLesson,
  action,
  actionHint = 'Link goes live 5 min before',
  empty = false,
}: NextClassBannerProps) {
  if (empty) {
    return (
      <section
        aria-label="Next class banner"
        className="w-full rounded-[12px] px-[18px] py-[14px]"
        style={{
          background: 'linear-gradient(135deg, #0f2a3a 0%, #1a3d4f 100%)',
          border: '1px solid #1e4a5e',
        }}
      >
        <p className="text-[12px]" style={{ color: '#a8d8e0' }}>
          No class scheduled today
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Next class banner"
      className="w-full rounded-[12px] px-[18px] py-[14px] flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      style={{
        background: 'linear-gradient(135deg, #0f2a3a 0%, #1a3d4f 100%)',
        border: '1px solid #1e4a5e',
      }}
    >
      {/* Left content */}
      <div className="flex flex-col min-w-0">
        {/* NEXT CLASS pill */}
        <span
          className="inline-flex items-center gap-1.5 self-start rounded-[10px] px-2 py-[3px] text-[10px] font-medium tracking-wide"
          style={{
            background: 'rgba(126,207,196,0.15)',
            color: '#7ecfc4',
            border: '0.5px solid rgba(126,207,196,0.25)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: '#7ecfc4' }}
          />
          NEXT CLASS
        </span>

        {/* Student name */}
        <p
          className="mt-1.5 text-[15px] font-medium truncate"
          style={{ color: '#f0f8fa' }}
        >
          {studentName}
        </p>

        {/* Subject · Time */}
        <p className="mt-0.5 text-[12px]" style={{ color: '#7ecfc4' }}>
          {scheduleLabel}
        </p>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-[14px] gap-y-1">
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#a8d8e0' }}>
            <Clock className="h-3 w-3" />
            {countdownLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#a8d8e0' }}>
            <Video className="h-3 w-3" />
            {platform}
          </span>
          {lastLesson && (
            <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#a8d8e0' }}>
              <BookOpen className="h-3 w-3" />
              {lastLesson}
            </span>
          )}
        </div>
      </div>

      {/* Right action */}
      <div className="flex flex-col items-stretch md:items-end gap-1 shrink-0">
        <div className="[&_button]:!bg-[#1d9e75] [&_button:hover]:!bg-[#0f6e56] [&_button]:!text-white [&_button]:!rounded-[8px] [&_button]:!px-5 [&_button]:!py-2.5 [&_button]:!text-[13px] [&_button]:!font-medium [&_button]:!border-0 [&_button]:!shadow-none w-full md:w-auto">
          {action}
        </div>
        <p className="text-[11px] text-right" style={{ color: '#a8d8e0' }}>
          {actionHint}
        </p>
      </div>
    </section>
  );
}
