import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, LifeBuoy, PlayCircle, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ShareData {
  title: string;
  category: string | null;
  duration_seconds: number | null;
  steps: { step: number; label: string }[];
  video_url: string;
  poster_url: string | null;
}

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/tutorial-share`;

/** Public walkthrough page — no login. Access is granted only by the share token. */
export default function WalkthroughShare() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Link not available.');
        setData(body);
        document.title = `${body.title} — AQTA walkthrough`;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Link not available.');
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mins = data.duration_seconds ? Math.max(1, Math.round(data.duration_seconds / 60)) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-6">
          <LifeBuoy className="h-6 w-6 text-emerald-300" />
          <span className="font-semibold">Al-Quran Time Academy — Help Centre</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          {data.category && <Badge variant="outline" className="text-[10px] uppercase">{data.category}</Badge>}
          <h1 className="mt-2 text-3xl font-bold leading-tight">{data.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded from the live academy app{mins ? ` · about ${mins} min` : ''}
          </p>
        </div>

        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const res = await fetch(data.video_url);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'aqta-walkthrough'}.mp4`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 4000);
              } catch {
                window.open(data.video_url, '_blank');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Download video (MP4)
          </Button>
        </div>

        <video
          src={data.video_url}
          poster={data.poster_url || undefined}
          controls
          playsInline
          className="w-full rounded-xl border border-border bg-black"
        />

        {data.steps.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PlayCircle className="h-4 w-4 text-emerald-600" /> What the video shows
              </p>
              <ol className="space-y-2">
                {data.steps.map((s) => (
                  <li key={s.step} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {s.step}
                    </span>
                    <span className="text-muted-foreground">{s.label}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
