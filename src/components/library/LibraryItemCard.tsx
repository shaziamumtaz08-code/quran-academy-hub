import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BookOpen, Eye, Download, FileText, Music, Video, Link2, Image as ImageIcon, FileQuestion, Star, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = any;

const TYPE_ICON: Record<string, any> = {
  pdf: FileText, ebook: BookOpen, document: FileText, paper: FileText,
  audio: Music, video: Video, link: Link2, image: ImageIcon, file: FileQuestion,
};

const TYPE_COLOR: Record<string, string> = {
  ebook: "from-emerald-100 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  pdf: "from-rose-100 to-orange-50 dark:from-rose-950/40 dark:to-orange-900/20 text-rose-700 dark:text-rose-300",
  paper: "from-blue-100 to-sky-50 dark:from-blue-950/40 dark:to-sky-900/20 text-blue-700 dark:text-blue-300",
  document: "from-slate-100 to-slate-50 dark:from-slate-900/40 dark:to-slate-800/20 text-slate-700 dark:text-slate-300",
  audio: "from-violet-100 to-purple-50 dark:from-violet-950/40 dark:to-purple-900/20 text-violet-700 dark:text-violet-300",
  video: "from-fuchsia-100 to-pink-50 dark:from-fuchsia-950/40 dark:to-pink-900/20 text-fuchsia-700 dark:text-fuchsia-300",
  link: "from-cyan-100 to-sky-50 dark:from-cyan-950/40 dark:to-sky-900/20 text-cyan-700 dark:text-cyan-300",
  image: "from-amber-100 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-900/20 text-amber-700 dark:text-amber-300",
};

export function LibraryItemCard({ item, onClick, dense = false }: { item: Item; onClick: () => void; dense?: boolean }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const Icon = TYPE_ICON[item.type] || FileQuestion;
  const color = TYPE_COLOR[item.type] || TYPE_COLOR.document;

  useEffect(() => {
    if (item.cover_image) {
      supabase.storage.from("resources").createSignedUrl(item.cover_image, 3600)
        .then(({ data }) => setCoverUrl(data?.signedUrl || null));
    }
  }, [item.cover_image]);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group cursor-pointer overflow-hidden border-border/60 bg-card hover:border-accent/50 hover:shadow-lg transition-all duration-200",
        "flex flex-col"
      )}
    >
      {/* Cover */}
      <div className={cn(
        "relative aspect-[3/4] overflow-hidden bg-gradient-to-br flex items-center justify-center",
        color
      )}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <Icon className="h-12 w-12 opacity-60" strokeWidth={1.5} />
        )}
        {item.is_featured && (
          <Badge className="absolute top-2 left-2 bg-amber-500/95 text-white border-0 text-[10px] gap-1 px-1.5">
            <Star className="h-3 w-3 fill-current" /> Featured
          </Badge>
        )}
        {!item.allow_downloads && (
          <div className="absolute top-2 right-2 rounded-md bg-background/90 backdrop-blur p-1" title="View only">
            <Lock className="h-3 w-3" />
          </div>
        )}
        <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider bg-background/85 backdrop-blur">
          {item.type}
        </Badge>
      </div>

      {/* Info */}
      <div className={cn("p-3 flex-1 flex flex-col", dense && "p-2.5")}>
        <h3 className={cn(
          "font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-accent transition-colors",
          dense ? "text-sm" : "text-[15px]"
        )}>
          {item.title}
        </h3>
        {item.author && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{item.author}</p>
        )}
        <div className="flex items-center gap-3 mt-auto pt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{item.views_count || 0}</span>
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{item.downloads_count || 0}</span>
          {item.publication_year && <span className="ml-auto">{item.publication_year}</span>}
        </div>
      </div>
    </Card>
  );
}
