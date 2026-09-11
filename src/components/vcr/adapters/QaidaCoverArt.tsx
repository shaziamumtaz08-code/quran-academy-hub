import React from 'react';

/**
 * Opening page of the Noorani Qaida reader.
 *
 * Built to the same page geometry as the Mushaf cover and the Qaida teaching
 * pages: it fills the shared page body box exactly, so cover, index and content
 * all read at one constant size. Pure SVG + CSS for identical rendering in
 * Chrome, Edge, Firefox and Safari.
 */
export function QaidaCoverArt({ fontScale = 1, pages }: { fontScale?: number; pages: number }) {
  return (
    <div
      style={{ containerType: 'inline-size', fontSize: `${fontScale}rem` }}
      className="relative flex h-full w-full flex-1 overflow-hidden rounded-xl border border-vcr-gold/45 bg-gradient-to-b from-[#fbfbf3] via-[#f6faf6] to-[#eef4f6] shadow-[0_18px_50px_-32px_rgba(60,50,90,0.55)]"
    >
      <svg
        viewBox="0 0 800 620"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="qcv-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8cd91" />
            <stop offset="40%" stopColor="#c39b4d" />
            <stop offset="100%" stopColor="#e3c68a" />
          </linearGradient>
          <radialGradient id="qcv-glow" cx="50%" cy="40%" r="62%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <pattern id="qcv-lattice" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M26 2 L50 26 L26 50 L2 26 Z" fill="none" stroke="#2f7d6d" strokeWidth="0.6" opacity="0.16" />
            <circle cx="26" cy="26" r="3.4" fill="none" stroke="#c39b4d" strokeWidth="0.5" opacity="0.16" />
          </pattern>
        </defs>

        <rect width="800" height="620" fill="url(#qcv-lattice)" />
        <rect width="800" height="620" fill="url(#qcv-glow)" />

        {/* Illuminated frame */}
        <rect x="18" y="18" width="764" height="584" rx="16" fill="none" stroke="url(#qcv-gold)" strokeWidth="2.2" />
        <rect x="30" y="30" width="740" height="560" rx="11" fill="none" stroke="#2f7d6d" strokeWidth="0.7" opacity="0.45" />

        {/* Corner illumination */}
        {[
          { x: 30, y: 30, sx: 1, sy: 1 },
          { x: 770, y: 30, sx: -1, sy: 1 },
          { x: 30, y: 590, sx: 1, sy: -1 },
          { x: 770, y: 590, sx: -1, sy: -1 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`} opacity="0.85">
            <path d="M6 58 C6 26 26 6 58 6" fill="none" stroke="url(#qcv-gold)" strokeWidth="1.5" />
            <path d="M6 86 C6 34 34 6 86 6" fill="none" stroke="#2f7d6d" strokeWidth="0.6" opacity="0.45" />
            <circle cx="27" cy="27" r="4.5" fill="none" stroke="url(#qcv-gold)" strokeWidth="1.1" />
          </g>
        ))}

        {/* Central medallion frame */}
        <g>
          <rect x="255" y="176" width="290" height="300" rx="145" fill="#ffffff" fillOpacity="0.5" stroke="url(#qcv-gold)" strokeWidth="1.8" />
          <rect x="272" y="192" width="256" height="268" rx="128" fill="none" stroke="#2f7d6d" strokeWidth="0.7" opacity="0.45" />
        </g>

        {/* Crown rosette */}
        <g transform="translate(400 208)" opacity="0.9">
          {Array.from({ length: 10 }).map((_, i) => (
            <ellipse key={i} rx="5" ry="22" fill="none" stroke="#c39b4d" strokeWidth="0.6" opacity="0.45" transform={`rotate(${i * 18})`} />
          ))}
          <circle r="6" fill="none" stroke="url(#qcv-gold)" strokeWidth="1.2" />
          <circle r="2.4" fill="#c39b4d" />
        </g>

        {/* Side flourishes */}
        <g stroke="#2f7d6d" fill="none" opacity="0.35">
          <path d="M120 300 q36 -48 0 -96" strokeWidth="0.8" />
          <path d="M680 300 q-36 -48 0 -96" strokeWidth="0.8" />
          <path d="M120 320 q36 48 0 96" strokeWidth="0.8" />
          <path d="M680 320 q-36 48 0 96" strokeWidth="0.8" />
        </g>

        {/* Base rule */}
        <g opacity="0.8">
          <path d="M290 512 H510" stroke="url(#qcv-gold)" strokeWidth="1.1" />
          <circle cx="400" cy="512" r="4" fill="none" stroke="url(#qcv-gold)" strokeWidth="1" />
        </g>
      </svg>

      {/* Title block */}
      <div className="relative flex h-full w-full flex-col items-center justify-center px-[10%] pb-[8%] pt-[10%] text-center">
        <p
          dir="rtl"
          lang="ar"
          className="font-qaida bg-gradient-to-b from-[#b8892f] via-[#d8b269] to-[#a9782c] bg-clip-text leading-[1.75] text-transparent"
          style={{ fontSize: 'clamp(2.2rem, 7.5cqw, 4.2rem)' }}
        >
          القاعدة النورانية
        </p>
        <span aria-hidden className="my-[2.5%] h-px w-[38%] bg-gradient-to-r from-transparent via-vcr-gold/70 to-transparent" />
        <h1
          className="font-display tracking-[0.22em] text-slate-800"
          style={{ fontSize: 'clamp(0.9rem, 2.6cqw, 1.4rem)' }}
        >
          NOORANI QAIDA
        </h1>
        <p
          className="mt-[3%] font-mono uppercase tracking-[0.28em] text-slate-500"
          style={{ fontSize: 'clamp(0.55rem, 1.6cqw, 0.72rem)' }}
        >
          {pages} pages · one complete book
        </p>
      </div>
    </div>
  );
}
