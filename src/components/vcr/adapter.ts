import type { ReactNode } from 'react';

/**
 * Shared contract every VCR content adapter implements.
 *
 * The reader shell (VcrReader) owns everything content-agnostic — parchment
 * card, elevation, page-turn transition, zoom / font-size controls, follower
 * (read-only mirror) mode. The adapter owns everything content-specific —
 * where the units come from, how a unit is rendered, and what a unit is called.
 *
 * `unit` is the generic term for "one screenful of content":
 *  - mushaf → Quran page number
 *  - qaida  → qaida page (later phase)
 *  - pdf    → pdf page (later phase)
 */
export type VcrContentType = 'mushaf' | 'qaida' | 'pdf' | 'image';

export interface VcrRenderContext {
  fontScale: number;
  highlight: { lineId?: string | null; wordId?: string | null } | null;
}

export interface VcrAdapter {
  /** Persisted alongside progress/session rows. */
  contentType: VcrContentType;
  /** Library row this content came from, when it is a library asset. */
  libraryItemId?: string | null;
  /** Total addressable units (upper bound for navigation / page jump). */
  totalUnits: number;
  /** Human label for the header chrome, e.g. "Al-Baqarah". */
  currentLabel: string;
  /** Secondary label, e.g. "Juz 3 · Page 42". */
  currentSubLabel?: string;
  /** Word used in the controls, e.g. "page". */
  unitNoun: string;
  /** Resolve the unit to open on first render (resume position). */
  resolveStartUnit?: () => Promise<number | null>;
  /** Render one unit inside the parchment card. */
  renderUnit: (unit: number, ctx: VcrRenderContext) => ReactNode;
  /** Called by the shell whenever the visible unit changes. */
  onUnitChange?: (unit: number) => void;
  /** Structured position payload persisted to `reference` (jsonb). */
  referenceFor?: (unit: number) => Record<string, unknown>;
  /** Called when the teacher marks the current unit complete. */
  onComplete?: (unit: number) => void;
  /** Imperative jump used by the shell's page-jump form. */
  goTo?: (unit: number) => void;
}
