import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Clock, Film, ListOrdered, Play, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TutorialCardData {
  id: string;
  title: string;
  category: string;
  is_published: boolean;
  thumbnail_url?: string | null;
  walkthrough_poster_path?: string | null;
  walkthrough_video_path?: string | null;
  duration_seconds?: number | null;
  hasFrames?: boolean;
  hasVideo?: boolean;
}

interface Props {
  row: TutorialCardData;
  intro: string;
  steps: number;
  minutes: number;
  isUrdu: boolean;
  onOpen: () => void;
  adminBar?: React.ReactNode;
}

const T = {
  read: { en: 'Read guide', ur: 'رہنمائی پڑھیں' },
  watch: { en: 'Watch walkthrough', ur: 'واک تھرو دیکھیں' },
  minRead: { en: 'min read', ur: 'منٹ کا مطالعہ' },
  steps: { en: 'steps', ur: 'مراحل' },
  guide: { en: 'Guide', ur: 'رہنمائی' },
  walkthrough: { en: 'Walkthrough', ur: 'واک تھرو' },
  video: { en: 'Video', ur: 'ویڈیو' },
  draft: { en: 'Draft', ur: 'مسودہ' },
};

/** One tutorial in the Help Centre grid: reading-oriented card, or media card when a real capture exists. */
export function TutorialCard({ row, intro, steps, minutes, isUrdu, onOpen, adminBar }: Props) {
  const L = (k: keyof typeof T) => T[k][isUrdu ? 'ur' : 'en'];
  const isMedia = Boolean(row.walkthrough_video_path || row.hasFrames || row.hasVideo);

  const { data: poster } = useQuery({
    queryKey: ['tutorial-poster', row.walkthrough_poster_path],
    enabled: Boolean(row.walkthrough_poster_path),
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from('tutorial-videos')
        .createSignedUrl(row.walkthrough_poster_path as string, 60 * 60);
      return data?.signedUrl || null;
    },
  });

  const posterSrc = poster || row.thumbnail_url || null;
  const Chevron = isUrdu ? ChevronLeft : ChevronRight;

  return (
    <Card
      className={cn(
        'group flex flex-col overflow-hidden border-border/70 bg-card transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-within:border-primary/50',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        dir={isUrdu ? 'rtl' : 'ltr'}
        className={cn(
          'flex flex-1 flex-col text-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isUrdu && 'urdu-text',
        )}
      >
        {isMedia && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/10 to-transparent">
                <Film className="h-8 w-8 text-primary/60" />
              </div>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-foreground/45 to-transparent opacity-60" />
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm backdrop-blur">
              <Play className="h-3.5 w-3.5 fill-current text-primary" />
              {L('watch')}
            </span>
            {row.duration_seconds ? (
              <span className="absolute bottom-3 end-3 rounded-md bg-foreground/75 px-2 py-0.5 text-[11px] font-medium text-background">
                {Math.max(1, Math.round(row.duration_seconds / 60))}m
              </span>
            ) : null}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {isMedia ? <Film className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
              {isMedia ? L('walkthrough') : L('guide')}
            </span>
            {!row.is_published && <Badge variant="secondary" className="shrink-0">{L('draft')}</Badge>}
          </div>

          <p className={cn('font-semibold leading-snug text-foreground', isUrdu ? 'text-base' : 'text-[15px]')}>
            {row.title}
          </p>
          {intro && (
            <p className={cn('text-sm text-muted-foreground', isUrdu ? 'line-clamp-3' : 'line-clamp-2')}>{intro}</p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {minutes} {L('minRead')}</span>
            {steps > 0 && <span className="inline-flex items-center gap-1"><ListOrdered className="h-3.5 w-3.5" /> {steps} {L('steps')}</span>}
            {row.hasVideo && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" /> {L('video')}</span>}
          </div>

          <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
            {isMedia ? L('watch') : L('read')}
            <Chevron className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>

      {adminBar}
    </Card>
  );
}

export default TutorialCard;
