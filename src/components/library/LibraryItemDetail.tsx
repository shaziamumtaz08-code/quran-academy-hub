import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Download, Share2, Eye, BookOpen, Calendar, Globe, FileText, HardDrive, Hash, User, Building2, Layers, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Item = any;

interface Props {
  item: Item | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categoryName?: string;
}

export function LibraryItemDetail({ item, open, onOpenChange, categoryName }: Props) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!item) return;
    // Increment view (fire-and-forget)
    (supabase as any).rpc("library_increment_view", { _item_id: item.id }).catch(() => {});
    // Load signed cover
    if (item.cover_image) {
      supabase.storage.from("resources").createSignedUrl(item.cover_image, 3600)
        .then(({ data }) => setCoverUrl(data?.signedUrl || null));
    } else {
      setCoverUrl(null);
    }
  }, [item]);

  const handleDownload = async () => {
    if (!item) return;
    if (!item.allow_downloads) { toast.error("Downloads disabled for this resource"); return; }
    setDownloading(true);
    try {
      let href = item.url as string | null;
      if (item.file_path) {
        const { data, error } = await supabase.storage.from("resources").createSignedUrl(item.file_path, 300, { download: true });
        if (error) throw error;
        href = data.signedUrl;
      }
      if (!href) throw new Error("No file");
      await (supabase as any).rpc("library_log_download", { _item_id: item.id });
      window.open(href, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: item?.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch {}
  };

  if (!item) return null;
  const fileSize = item.file_size_bytes ? `${(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : null;
  const addedDate = item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider">{item.type}</Badge>
          <SheetTitle className="text-2xl font-bold leading-tight">{item.title}</SheetTitle>
          {item.author && <SheetDescription className="text-base">by {item.author}</SheetDescription>}
        </SheetHeader>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          {/* Cover */}
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

          {/* Metadata */}
          <div className="space-y-3 text-sm">
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

        {item.description && (
          <>
            <Separator className="my-6" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Description</h3>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
          </>
        )}

        {item.tags?.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t: string) => (
                <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
              ))}
            </div>
          </>
        )}

        <Separator className="my-6" />
        <div className="flex flex-col sm:flex-row gap-2">
          {(item.file_path || item.url) && item.allow_downloads && (
            <Button onClick={handleDownload} disabled={downloading} className="flex-1">
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : item.file_path ? <Download className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              {item.file_path ? "Download Now" : "Open Link"}
            </Button>
          )}
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" /> Share
          </Button>
        </div>
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
