import React from 'react';

/**
 * Opening page of the Mushaf reader.
 *
 * Designed as a real first page of the book, not a pasted card: it fills the
 * same reading surface as the Qur'an pages (same rounded frame, same padding
 * rhythm, same pale cream/lavender palette) and simply carries an illuminated
 * gold frame, an architectural arch and the title. Pure SVG + CSS so it renders
 * identically in Chrome, Edge, Firefox and Safari.
 */
export function MushafCoverArt({ fontScale = 1, pages }: { fontScale?: number; pages: number }) {
  return (
    <div
      style={{ containerType: 'inline-size', fontSize: `${fontScale}rem` }}
      className="relative flex h-full w-full flex-1 overflow-hidden rounded-xl border border-vcr-gold/45 bg-gradient-to-b from-[#fffaf0] via-[#fdf7f7] to-[#f3f0fb] shadow-[0_18px_50px_-32px_rgba(60,50,90,0.55)]"
    >
      {/* Ornament layer */}
      <svg
        viewBox="0 0 800 620"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="mcv-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8cd91" />
            <stop offset="40%" stopColor="#c39b4d" />
            <stop offset="100%" stopColor="#e3c68a" />
          </linearGradient>
          <radialGradient id="mcv-glow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <pattern id="mcv-lattice" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M23 0 L46 23 L23 46 L0 23 Z" fill="none" stroke="#c39b4d" strokeWidth="0.6" opacity="0.18" />
            <circle cx="23" cy="23" r="3.2" fill="none" stroke="#c39b4d" strokeWidth="0.5" opacity="0.14" />
          </pattern>
        </defs>

        <rect width="800" height="620" fill="url(#mcv-lattice)" />
        <rect width="800" height="620" fill="url(#mcv-glow)" />

        {/* Illuminated frame */}
        <rect x="18" y="18" width="764" height="584" rx="16" fill="none" stroke="url(#mcv-gold)" strokeWidth="2.2" />
        <rect x="30" y="30" width="740" height="560" rx="11" fill="none" stroke="#c39b4d" strokeWidth="0.7" opacity="0.55" />

        {/* Corner illumination */}
        {[
          { x: 30, y: 30, sx: 1, sy: 1 },
          { x: 770, y: 30, sx: -1, sy: 1 },
          { x: 30, y: 590, sx: 1, sy: -1 },
          { x: 770, y: 590, sx: -1, sy: -1 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`} opacity="0.85">
            <path d="M6 60 C6 26 26 6 60 6" fill="none" stroke="url(#mcv-gold)" strokeWidth="1.5" />
            <path d="M6 88 C6 34 34 6 88 6" fill="none" stroke="#c39b4d" strokeWidth="0.6" opacity="0.5" />
            <circle cx="28" cy="28" r="4.5" fill="none" stroke="url(#mcv-gold)" strokeWidth="1.1" />
          </g>
        ))}

        {/* Central arch */}
        <g>
          <path
            d="M262 500 L262 300 C262 218 320 168 400 168 C480 168 538 218 538 300 L538 500 Z"
            fill="#ffffff"
            fillOpacity="0.55"
            stroke="url(#mcv-gold)"
            strokeWidth="1.8"
          />
          <path
            d="M282 492 L282 306 C282 234 332 190 400 190 C468 190 518 234 518 306 L518 492"
            fill="none"
            stroke="#c39b4d"
            strokeWidth="0.7"
            opacity="0.55"
          />
        </g>

        {/* Keystone rosette */}
        <g transform="translate(400 232)" opacity="0.9">
          {Array.from({ length: 12 }).map((_, i) => (
            <ellipse key={i} rx="6" ry="26" fill="none" stroke="#c39b4d" strokeWidth="0.6" opacity="0.45" transform={`rotate(${i * 15})`} />
          ))}
          <circle r="7" fill="none" stroke="url(#mcv-gold)" strokeWidth="1.2" />
          <circle r="2.5" fill="#c39b4d" />
        </g>

        {/* Side flourishes */}
        <g stroke="#c39b4d" fill="none" opacity="0.4">
          <path d="M100 310 q34 -46 0 -92" strokeWidth="0.8" />
          <path d="M700 310 q-34 -46 0 -92" strokeWidth="0.8" />
          <path d="M100 330 q34 46 0 92" strokeWidth="0.8" />
          <path d="M700 330 q-34 46 0 92" strokeWidth="0.8" />
        </g>

        {/* Base rule */}
        <g opacity="0.8">
          <path d="M280 528 H520" stroke="url(#mcv-gold)" strokeWidth="1.1" />
          <circle cx="400" cy="528" r="4" fill="none" stroke="url(#mcv-gold)" strokeWidth="1" />
        </g>
      </svg>

      {/* Title block */}
      <div className="relative flex h-full w-full flex-col items-center justify-center px-[10%] pb-[8%] pt-[10%] text-center">
        <p
          dir="rtl"
          lang="ar"
          className="font-qaida bg-gradient-to-b from-[#b8892f] via-[#d8b269] to-[#a9782c] bg-clip-text leading-[1.75] text-transparent"
          style={{ fontSize: 'clamp(2.6rem, 9cqw, 5rem)' }}
        >
          القرآن الكريم
        </p>
        <span aria-hidden className="my-[2.5%] h-px w-[38%] bg-gradient-to-r from-transparent via-vcr-gold/70 to-transparent" />
        <h1
          className="font-display tracking-[0.22em] text-slate-800"
          style={{ fontSize: 'clamp(0.9rem, 2.6cqw, 1.4rem)' }}
        >
          AL-QUR’AN AL-KAREEM
        </h1>
        <p
          className="mt-[3%] font-mono uppercase tracking-[0.28em] text-slate-500"
          style={{ fontSize: 'clamp(0.55rem, 1.6cqw, 0.72rem)' }}
        >
          {pages} pages · 30 juz · 114 surahs
        </p>
      </div>
    </div>
  );
}
