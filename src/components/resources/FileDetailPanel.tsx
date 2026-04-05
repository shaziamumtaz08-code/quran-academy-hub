import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, ExternalLink, FileText, Music, Video, Image, Archive, Link, File, Calendar, Eye, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

type Resource = {
  id: string;
  title: string;
  type: string;
  url: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  visibility?: string;
};

interface FileDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-500/10", label: "PDF Document" },
  audio: { icon: Music, color: "text-purple-500", bg: "bg-purple-500/10", label: "Audio File" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-500/10", label: "Video File" },
  image: { icon: Image, color: "text-green-500", bg: "bg-green-500/10", label: "Image" },
  zip: { icon: Archive, color: "text-amber-500", bg: "bg-amber-500/10", label: "Archive" },
  link: { icon: Link, color: "text-accent", bg: "bg-accent/10", label: "External Link" },
  file: { icon: File, color: "text-muted-foreground", bg: "bg-muted", label: "File" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.file;
}

export function FileDetailPanel({ open, onOpenChange, resource }: FileDetailPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!open || !resource) {
      setPreviewUrl(null);
      return;
    }
    if (resource.type === 'link') {
      setPreviewUrl(null);
      return;
    }
    setLoadingPreview(true);
    supabase.storage
      .from('resources')
      .createSignedUrl(resource.url, 3600)
      .then(({ data, error }) => {
        if (!error && data) setPreviewUrl(data.signedUrl);
        setLoadingPreview(false);
      });
  }, [open, resource]);

  if (!resource) return null;

  const config = getConfig(resource.type);
  const Icon = config.icon;

  const handleOpen = async () => {
    if (resource.type === 'link') {
      window.open(resource.url, '_blank');
      return;
    }
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleDownload = async () => {
    if (resource.type === 'link') return;
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = resource.title;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canPreview = ['image', 'pdf', 'video', 'audio'].includes(resource.type);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold truncate pr-6">{resource.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Preview Area */}
          {canPreview && previewUrl && (
            <div className="rounded-xl border border-border/50 overflow-hidden bg-muted/30">
              {resource.type === 'image' && (
                <img
                  src={previewUrl}
                  alt={resource.title}
                  className="w-full max-h-[300px] object-contain bg-black/5"
                />
              )}
              {resource.type === 'video' && (
                <video
                  src={previewUrl}
                  controls
                  className="w-full max-h-[300px]"
                />
              )}
              {resource.type === 'audio' && (
                <div className="p-6 flex flex-col items-center gap-4">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${config.bg}`}>
                    <Icon className={`h-10 w-10 ${config.color}`} />
                  </div>
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )}
              {resource.type === 'pdf' && (
                <iframe
                  src={previewUrl}
                  title={resource.title}
                  className="w-full h-[400px] border-0"
                />
              )}
            </div>
          )}

          {/* Non-previewable: show icon */}
          {(!canPreview || !previewUrl) && !loadingPreview && (
            <div className="flex flex-col items-center py-8">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${config.bg}`}>
                <Icon className={`h-10 w-10 ${config.color}`} />
              </div>
            </div>
          )}

          {loadingPreview && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{config.label}</Badge>
              {resource.visibility && resource.visibility !== 'all' && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  {resource.visibility === 'admin_only' ? 'Admin Only' : resource.visibility === 'teachers' ? 'Teachers' : 'Custom'}
                </Badge>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(resource.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Updated</p>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(resource.updated_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {resource.type === 'link' && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">URL</p>
                <p className="text-sm text-primary break-all">{resource.url}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleOpen} className="flex-1 gap-2">
              <ExternalLink className="h-4 w-4" />
              Open
            </Button>
            {resource.type !== 'link' && (
              <Button variant="outline" onClick={handleDownload} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
