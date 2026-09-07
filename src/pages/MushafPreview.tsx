import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VcrReader } from '@/components/vcr/VcrReader';
import { useMushafAdapter, MUSHAF_TOTAL_PAGES } from '@/components/vcr/adapters/useMushafAdapter';
import { BookOpen } from 'lucide-react';

/**
 * Standalone, read-only Mushaf browser for lesson prep / lookup.
 * No session, no sync, no attendance or progress writes — just the
 * VcrReader shell with prev/next/jump and font controls.
 */
export default function MushafPreview() {
  const params = useParams();
  const navigate = useNavigate();
  const raw = Number(params.page);
  const initialPage = Number.isFinite(raw) && raw >= 1 ? Math.min(MUSHAF_TOTAL_PAGES, Math.floor(raw)) : 1;

  const adapter = useMushafAdapter({ canControl: false });

  const goPage = (unit: number) => navigate(`/mushaf/${unit}`, { replace: true });
  const wrapped = useMemo(() => ({ ...adapter, goTo: goPage }), [adapter]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-3 sm:p-5">
      <header className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-lms-navy">Mushaf</h1>
          <p className="text-xs text-muted-foreground">
            Read-only preview — browse pages for lesson prep. Nothing here is saved or shared.
          </p>
        </div>
      </header>

      <VcrReader adapter={wrapped} initialUnit={initialPage} canControl />
    </div>
  );
}
