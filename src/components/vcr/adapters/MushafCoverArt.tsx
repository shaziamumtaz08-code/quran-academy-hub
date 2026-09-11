import React from 'react';

/**
 * Premium digital cover for the Mushaf reader.
 * Pure SVG + CSS: no external assets or fonts beyond the bundled Arabic face,
 * so it renders identically in Chrome, Edge, Firefox and Safari.
 * Composition is centred and aspect-ratio safe: the arch, medallion and title
 * live inside a 3:4 (portrait) safe area that never crops on narrow screens.
 */
export function MushafCoverArt({ fontScale = 1, pages }: { fontScale?: number; pages: number }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[min(100%,34rem,57vh)] select-none"
      style={{ fontSize: `${fontScale}rem` }}
    >
      <div
        style={{ containerType: 'inline-size' }}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] shadow-[0_30px_80px_-40px_rgba(4,32,30,0.85)] ring-1 ring-vcr-gold/40">
        {/* Background field */}
        <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="mc-field" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#04231f" />
              <stop offset="45%" stopColor="#073c39" />
              <stop offset="100%" stopColor="#061a2c" />
            </linearGradient>
            <radialGradient id="mc-glow" cx="50%" cy="38%" r="62%">
              <stop offset="0%" stopColor="#0f6f63" stopOpacity="0.75" />
              <stop offset="65%" stopColor="#0a3a3a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mc-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f6e3ad" />
              <stop offset="35%" stopColor="#d9b56a" />
              <stop offset="70%" stopColor="#a97f36" />
              <stop offset="100%" stopColor="#f3dda4" />
            </linearGradient>
            <pattern id="mc-lattice" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M20 0 L40 20 L20 40 L0 20 Z" fill="none" stroke="#d9b56a" strokeWidth="0.6" opacity="0.28" />
              <circle cx="20" cy="20" r="3" fill="none" stroke="#d9b56a" strokeWidth="0.5" opacity="0.22" />
            </pattern>
          </defs>

          <rect width="600" height="800" fill="url(#mc-field)" />
          <rect width="600" height="800" fill="url(#mc-lattice)" />
          <rect width="600" height="800" fill="url(#mc-glow)" />

          {/* Outer frame rules */}
          <rect x="22" y="22" width="556" height="756" rx="26" fill="none" stroke="url(#mc-gold)" strokeWidth="2.5" />
          <rect x="34" y="34" width="532" height="732" rx="20" fill="none" stroke="#d9b56a" strokeWidth="0.8" opacity="0.55" />

          {/* Ornamental corners */}
          {[
            { x: 34, y: 34, sx: 1, sy: 1 },
            { x: 566, y: 34, sx: -1, sy: 1 },
            { x: 34, y: 766, sx: 1, sy: -1 },
            { x: 566, y: 766, sx: -1, sy: -1 },
          ].map((c, i) => (
            <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`} opacity="0.9">
              <path d="M6 54 C6 24 24 6 54 6" fill="none" stroke="url(#mc-gold)" strokeWidth="1.6" />
              <path d="M6 78 C6 30 30 6 78 6" fill="none" stroke="#d9b56a" strokeWidth="0.7" opacity="0.6" />
              <circle cx="26" cy="26" r="4.5" fill="none" stroke="url(#mc-gold)" strokeWidth="1.2" />
              <path d="M40 14 q10 10 0 20 q-10 -10 0 -20 Z" fill="#d9b56a" opacity="0.45" />
              <path d="M14 40 q10 10 20 0 q-10 -10 -20 0 Z" fill="#d9b56a" opacity="0.45" />
            </g>
          ))}

          {/* Layered architectural arches */}
          <g fill="none" stroke="url(#mc-gold)">
            <path
              d="M120 620 L120 330 C120 230 180 158 300 158 C420 158 480 230 480 330 L480 620 Z"
              stroke="url(#mc-gold)"
              strokeWidth="2.2"
              fill="#052a28"
              fillOpacity="0.55"
            />
            <path
              d="M142 606 L142 336 C142 246 194 182 300 182 C406 182 458 246 458 336 L458 606"
              strokeWidth="0.9"
              opacity="0.65"
            />
            <path
              d="M166 592 L166 342 C166 262 208 206 300 206 C392 206 434 262 434 342 L434 592"
              strokeWidth="0.6"
              opacity="0.4"
            />
          </g>

          {/* Arch keystone ornament */}
          <g transform="translate(300 250)" opacity="0.95">
            {Array.from({ length: 12 }).map((_, i) => (
              <ellipse
                key={i}
                rx="8"
                ry="34"
                fill="none"
                stroke="#d9b56a"
                strokeWidth="0.7"
                opacity="0.5"
                transform={`rotate(${i * 15})`}
              />
            ))}
            <circle r="9" fill="none" stroke="url(#mc-gold)" strokeWidth="1.4" />
            <circle r="3" fill="#e7c884" />
          </g>

          {/* Medallion behind the title */}
          <g transform="translate(300 420)" opacity="0.85">
            <circle r="132" fill="none" stroke="#d9b56a" strokeWidth="0.6" opacity="0.35" />
            <circle r="112" fill="none" stroke="url(#mc-gold)" strokeWidth="1" opacity="0.6" />
            {Array.from({ length: 16 }).map((_, i) => (
              <rect
                key={i}
                x="-96"
                y="-96"
                width="192"
                height="192"
                rx="34"
                fill="none"
                stroke="#d9b56a"
                strokeWidth="0.45"
                opacity="0.28"
                transform={`rotate(${(i * 90) / 16})`}
              />
            ))}
          </g>

          {/* Base rule */}
          <g opacity="0.8">
            <path d="M150 646 H450" stroke="url(#mc-gold)" strokeWidth="1.2" />
            <path d="M186 656 H414" stroke="#d9b56a" strokeWidth="0.6" opacity="0.5" />
            <circle cx="300" cy="646" r="4.5" fill="none" stroke="url(#mc-gold)" strokeWidth="1.1" />
          </g>
        </svg>

        {/* Title block — kept inside the safe area of the arch */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-[12%] text-center">
          <p
            dir="rtl"
            lang="ar"
            className="font-qaida bg-gradient-to-b from-[#fbeec6] via-[#e6c67f] to-[#c79b45] bg-clip-text leading-[1.7] text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
            style={{ fontSize: 'clamp(2.4rem, 11cqw, 4.25rem)' }}
          >
            القرآن الكريم
          </p>
          <span aria-hidden className="my-[3%] h-px w-[42%] bg-gradient-to-r from-transparent via-vcr-gold/80 to-transparent" />
          <h1
            className="font-display tracking-[0.2em] text-[#f3ead6]"
            style={{ fontSize: 'clamp(0.95rem, 4cqw, 1.5rem)' }}
          >
            AL-QUR’AN AL-KAREEM
          </h1>
          <p
            className="mt-[2%] max-w-[26ch] text-[#cfe3dd]/80"
            style={{ fontSize: 'clamp(0.65rem, 2.6cqw, 0.85rem)' }}
          >
            The complete Qur’an, page by page, in the Indo-Pak script used in class.
          </p>
        </div>

        {/* Footer meta inside the frame */}
        <div className="absolute inset-x-0 bottom-[6%] flex justify-center">
          <p
            className="uppercase tracking-[0.3em] text-vcr-gold/85"
            style={{ fontSize: 'clamp(0.55rem, 2.2cqw, 0.7rem)' }}
          >
            {pages} pages · 30 juz · 114 surahs
          </p>
        </div>
      </div>
    </div>
  );
}
