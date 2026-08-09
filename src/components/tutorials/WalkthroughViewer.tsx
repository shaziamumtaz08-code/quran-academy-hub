import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, MousePointerClick } from 'lucide-react';

export interface WalkthroughFrame {
  step: number;
  label: string;
  route?: string;
  path: string;
  /** Optional click hotspot as a 0..1 fraction of the image box. */
  hotspot?: { x: number; y: number } | null;
}

interface Props {
  frames: WalkthroughFrame[];
  generatedAt?: string | null;
}

/**
 * Plays back a walkthrough built from real screenshots captured against this LMS.
 * Images live in the private `tutorial-captures` bucket and are served via signed URLs.
 */
export function WalkthroughViewer({ frames, generatedAt }: Props) {
  const ordered = useMemo(() => [...frames].sort((a, b) => a.step - b.step), [frames]);
  const [index, setIndex] = useState(0);

  const { data: urls, isLoading } = useQuery({
    queryKey: ['walkthrough-urls', ordered.map((f) => f.path).join('|')],
    enabled: ordered.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('tutorial-captures')
        .createSignedUrls(ordered.map((f) => f.path), 60 * 60);
      if (error) throw error;
      return (data || []).map((row) => row.signedUrl || '');
    },
  });

  useEffect(() => setIndex(0), [ordered.length]);

  if (ordered.length === 0) return null;
  const frame = ordered[index];
  const url = urls?.[index];

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
              <MousePointerClick className="h-3 w-3" /> Verified walkthrough
            </Badge>
            <span className="text-xs text-muted-foreground">
              Step {index + 1} of {ordered.length}
            </span>
          </div>
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Captured {new Date(generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          {isLoading || !url ? (
            <div className="flex aspect-[16/10] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="relative">
              <img
                src={url}
                alt={`${frame.label} — step ${frame.step}`}
                loading="lazy"
                className="w-full"
              />
              {frame.hotspot && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary/80 bg-primary/20 animate-ping"
                  style={{ left: `${frame.hotspot.x * 100}%`, top: `${frame.hotspot.y * 100}%` }}
                />
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm font-medium text-foreground">
            {frame.step}. {frame.label}
          </p>
          {frame.route && <p className="mt-0.5 text-xs text-muted-foreground">Screen: {frame.route}</p>}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <div className="flex flex-1 justify-center gap-1">
            {ordered.map((f, i) => (
              <button
                key={f.step}
                aria-label={`Go to step ${f.step}`}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              />
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => Math.min(ordered.length - 1, i + 1))}
            disabled={index === ordered.length - 1}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default WalkthroughViewer;
