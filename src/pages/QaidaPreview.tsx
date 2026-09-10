import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VcrReader } from '@/components/vcr/VcrReader';
import { useQaidaAdapter, QAIDA_FALLBACK_PAGES } from '@/components/vcr/adapters/useQaidaAdapter';
import { BookOpenCheck } from 'lucide-react';

/**
 * Standalone Noorani Qaida reader — same tiles and flash cards as the class
 * room, but with no session, sync, attendance or progress writes.
 */
export default function QaidaPreview() {
  const params = useParams();
  const navigate = useNavigate();
  const raw = Number(params.page);
  const initialPage =
    Number.isFinite(raw) && raw >= 1 ? Math.min(QAIDA_FALLBACK_PAGES * 4, Math.floor(raw)) : 1;

  const adapter = useQaidaAdapter({ canControl: true });
  const wrapped = useMemo(
    () => ({ ...adapter, onUnitChange: (u: number) => navigate(`/qaida/${u}`, { replace: true }) }),
    [adapter, navigate]
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-3 sm:p-5">
      <header className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 text-gold">
          <BookOpenCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-lms-navy">Noorani Qaida</h1>
          <p className="text-xs text-muted-foreground">
            Tap any word to open its flash card. Nothing here is saved or shared.
          </p>
        </div>
      </header>

      <VcrReader adapter={wrapped} initialUnit={initialPage} canControl />
    </div>
  );
}
