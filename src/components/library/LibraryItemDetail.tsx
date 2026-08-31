import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  Download, Share2, Eye, BookOpen, Calendar, Globe, FileText, HardDrive, Hash,
  User, Building2, Layers, Loader2, ExternalLink, Star, Sparkles, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type Item = any;

interface Props {
  item: Item | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categoryName?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onUpdated?: () => void;
}

export function LibraryItemDetail({
  item, open, onOpenChange, categoryName,
  isFavorite, onToggleFavorite, onUpdated,
}: Props) {
  const { isSuperAdmin, profile } = useAuth();
  const isAdmin = isSuperAdmin || profile?.role === "admin";

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(item?.share_token || null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    setShareToken(item.share_token || null);
    void (async () => {
      try {
        await (supabase as any).rpc("library_increment_view", { _item_id: item.id });
      } catch {
        /* view counting is best-effort */
      }
    })();

    if (item.cover_image) {
      supabase.storage.from("resources").createSignedUrl(item.cover_image, 3600)
        .then(({ data }) => setCoverUrl(data?.signedUrl || null));
    } else setCoverUrl(null);

    if (item.file_path) {
      supabase.storage.from("resources").createSignedUrl(item.file_path, 3600)
        .then(({ data }) => setFileUrl(data?.signedUrl || null));
    } else setFileUrl(item.url || null);
  }, [item]);

  const handleDownload = async () => {
    if (!item) return;
    if (!item.allow_downloads) { toast.error("Downloads disabled"); return; }
    setDownloading(true);
    try {
      let href = item.url as string | null;
      if (item.file_path) {
        const { data, error } = await supabase.storage.from("resources")
          .createSignedUrl(item.file_path, 300, { download: true });
        if (error) throw error;
        href = data.signedUrl;
      }
      if (!href) throw new Error("No file");
      await (supabase as any).rpc("library_log_download", { _item_id: item.id });
      window.open(href, "_blank");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      let token = shareToken;
      if (!token) {
        const { data, error } = await (supabase as any).rpc("library_ensure_share_token", { _item_id: item.id });
        if (error) throw error;
        token = data;
        setShareToken(token);
      }
      const url = `${window.location.origin}/library/share/${token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      toast.error(e.message || "Share failed");
    }
  };

  const handleAITag = async () => {
    if (!item) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("library-auto-tag", {
        body: { item_id: item.id },
      });
      if (error) throw error;
      toast.success(`Generated ${data?.ai_tags?.length || 0} tags`);
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "AI tagging failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!item) return null;
  const fileSize = item.file_size_bytes ? `${(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : null;
  const addedDate = item.created_at
    ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Preview renderer
  const renderPreview = () => {
    if (!fileUrl) return null;
    const t = item.type;
    if (t === "pdf" || t === "ebook" || item.file_path?.endsWith(".pdf")) {
      return (
        <div className="rounded-lg overflow-hidden border border-border/60 bg-muted">
          <iframe src={fileUrl} className="w-full h-[60vh]" title={item.title} />
        </div>
      );
    }
    if (t === "image") {
      return <img src={fileUrl} alt={item.title} className="rounded-lg border border-border/60 max-h-[60vh] w-full object-contain bg-muted" />;
    }
    if (t === "video") {
      return <video src={fileUrl} controls className="rounded-lg border border-border/60 w-full max-h-[60vh] bg-black" />;
    }
    if (t === "audio") {
      return (
        <div className="rounded-lg border border-border/60 bg-muted p-4">
          <audio src={fileUrl} controls className="w-full" />
        </div>
      );
    }
    if (t === "link" && item.url) {
      return (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          className="block rounded-lg border border-border/60 p-4 bg-muted hover:bg-muted/80 transition">
          <div className="flex items-center gap-3">
            <ExternalLink className="h-5 w-5 text-accent" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.url}</div>
              <div className="text-xs text-muted-foreground">Opens in new tab</div>
            </div>
          </div>
        </a>
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{item.type}</Badge>
              <SheetTitle className="text-2xl font-bold leading-tight mt-2">{item.title}</SheetTitle>
              {item.author && <SheetDescription className="text-base">by {item.author}</SheetDescription>}
            </div>
            {onToggleFavorite && (
              <Button variant="outline" size="icon" onClick={onToggleFavorite} title={isFavorite ? "Remove favorite" : "Add favorite"}>
                <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-400")} />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* AI summary */}
        {item.ai_summary && (
          <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 flex gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">{item.ai_summary}</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6">
          <div className={cn(
            "aspect-[3/4] rounded-lg overflow-hidden border border-border/60 flex items-center justify-center",
            "bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-slate-900 dark:to-slate-800"
          )}>
            {coverUrl ? (
              <img src={coverUrl} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="h-16 w-16 text-muted-foreground/40" />
            )}
          </div>

          <div className="space-y-2.5 text-sm">
            <MetaRow icon={User} label="Author" value={item.author} />
            <MetaRow icon={Building2} label="Publisher" value={item.publisher} />
            <MetaRow icon={Calendar} label="Publication Year" value={item.publication_year} />
            <MetaRow icon={Globe} label="Language" value={item.language} />
            <MetaRow icon={FileText} label="Pages" value={item.pages_count} />
            <MetaRow icon={Layers} label="Edition" value={item.edition} />
            <MetaRow icon={HardDrive} label="File Size" value={fileSize} />
            <MetaRow icon={BookOpen} label="Category" value={categoryName} />
            <MetaRow icon={Hash} label="ISBN" value={item.isbn} />
            <MetaRow icon={Calendar} label="Added" value={addedDate} />
            <div className="flex gap-4 pt-1">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> {item.views_count || 0} views
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Download className="h-3.5 w-3.5" /> {item.downloads_count || 0} downloads
              </span>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <Separator className="my-6" />
        <div className="flex flex-col sm:flex-row gap-2">
          {(item.file_path || item.url) && item.allow_downloads && (
            <Button onClick={handleDownload} disabled={downloading} className="flex-1">
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : item.file_path ? <Download className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              {item.file_path ? "Download Now" : "Open Link"}
            </Button>
          )}
          <Button variant="outline" onClick={handleShare}>
            {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Share2 className="h-4 w-4 mr-2" />}
            {copied ? "Copied" : "Share Link"}
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={handleAITag} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-emerald-500" />}
              AI Tag
            </Button>
          )}
        </div>

        {/* Preview */}
        {fileUrl && (
          <>
            <Separator className="my-6" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preview</h3>
            {renderPreview()}
          </>
        )}

        {item.description && (
          <>
            <Separator className="my-6" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Description</h3>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </>
        )}

        {(item.tags?.length > 0 || item.ai_tags?.length > 0) && (
          <>
            <Separator className="my-6" />
            <div className="space-y-2">
              {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((t: string) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
              {item.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.ai_tags.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs gap-1 border-emerald-300/50 text-emerald-700 dark:text-emerald-400">
                      <Sparkles className="h-2.5 w-2.5" /> {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="text-sm text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}
