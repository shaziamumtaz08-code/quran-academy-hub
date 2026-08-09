import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Download, Film, Loader2, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  videoPath: string;
  fileName?: string;
  posterPath?: string | null;
  shareToken?: string | null;
  shareEnabled?: boolean | null;
  durationSeconds?: number | null;
}

/**
 * Plays the MP4 rendered from the verified walkthrough captures and offers a
 * download plus a public share link (token page) when sharing is enabled.
 */
export function WalkthroughVideoCard({
  videoPath,
  fileName,
  posterPath,
  shareToken,
  shareEnabled,
  durationSeconds,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadVideo = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from('tutorial-videos').download(videoPath);
      if (error || !data) throw error || new Error('No file');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = (fileName || videoPath.split('/').pop() || 'walkthrough') .replace(/[^\w.-]+/g, '-');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast({ title: 'Download started', description: 'The MP4 is saving to your device.' });
    } catch (err: any) {
      toast({ title: 'Download failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['walkthrough-video', videoPath, posterPath],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const paths = [videoPath, ...(posterPath ? [posterPath] : [])];
      const { data, error } = await supabase.storage
        .from('tutorial-videos')
        .createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      return { video: data?.[0]?.signedUrl || '', poster: posterPath ? data?.[1]?.signedUrl || null : null };
    },
  });

  const shareUrl = useMemo(
    () => (shareEnabled && shareToken ? `${window.location.origin}/help/w/${shareToken}` : null),
    [shareEnabled, shareToken],
  );

  const mins = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Share link copied', description: 'Anyone with this link can watch the walkthrough.' });
    } catch {
      toast({ title: 'Could not copy', description: shareUrl, variant: 'destructive' });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge className="gap-1 bg-slate-900 hover:bg-slate-900">
            <Film className="h-3 w-3" /> Walkthrough video
          </Badge>
          {mins && <span className="text-xs text-muted-foreground">About {mins} min</span>}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          {isLoading || !data?.video ? (
            <div className="flex aspect-video items-center justify-center bg-muted">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <video src={data.video} poster={data.poster || undefined} controls playsInline className="w-full" />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={downloadVideo}
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {downloading ? 'Preparing…' : 'Download video (MP4)'}
          </Button>
          {shareUrl && (
            <Button size="sm" onClick={copyShare}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
              {copied ? 'Link copied' : 'Copy share link'}
            </Button>
          )}
          {shareUrl && (
            <Button size="sm" variant="ghost" onClick={() => window.open(shareUrl, '_blank')}>
              <Copy className="mr-2 h-4 w-4" /> Open public page
            </Button>
          )}
        </div>
        {shareUrl && (
          <p className="break-all text-xs text-muted-foreground">{shareUrl}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default WalkthroughVideoCard;
