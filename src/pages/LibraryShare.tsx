import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, BookOpen, Download, ExternalLink, Calendar, Globe, FileText, User, Building2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

export default function LibraryShare() {
  const { token } = useParams<{ token: string }>();
  const [item, setItem] = useState<any>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      // Anon-scoped client that forwards the share token so RLS can match it.
      const shareClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { "x-share-token": token } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await (shareClient.from("library_items") as any)
        .select("*").eq("share_token", token).maybeSingle();
      setItem(data);
      if (data?.cover_image) {
        const { data: c } = await supabase.storage.from("resources").createSignedUrl(data.cover_image, 3600);
        setCoverUrl(c?.signedUrl || null);
      }
      setLoading(false);
    })();
  }, [token]);


  const handleDownload = async () => {
    if (!item) return;
    let href = item.url;
    if (item.file_path) {
      const { data } = await supabase.storage.from("resources")
        .createSignedUrl(item.file_path, 300, { download: true });
      href = data?.signedUrl;
    }
    if (href) window.open(href, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;
  if (!item) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Resource not found or link expired.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <header className="border-b border-border/60 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-300" />
          <span className="font-semibold">Shared from the Knowledge Library</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Card className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
          <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border/60 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-slate-800 dark:to-slate-900">
            {coverUrl ? <img src={coverUrl} alt={item.title} className="w-full h-full object-cover" /> : <BookOpen className="h-16 w-16 text-muted-foreground/40" />}
          </div>
          <div>
            <Badge variant="outline" className="text-[10px] uppercase">{item.type}</Badge>
            <h1 className="text-3xl font-bold mt-2 leading-tight">{item.title}</h1>
            {item.author && <p className="text-lg text-muted-foreground mt-1">by {item.author}</p>}

            {item.ai_summary && (
              <p className="mt-4 text-sm text-foreground/90 leading-relaxed">{item.ai_summary}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
              {item.publisher && <Row icon={Building2} label="Publisher" value={item.publisher} />}
              {item.publication_year && <Row icon={Calendar} label="Year" value={item.publication_year} />}
              {item.language && <Row icon={Globe} label="Language" value={item.language} />}
              {item.pages_count && <Row icon={FileText} label="Pages" value={item.pages_count} />}
            </div>

            {item.description && (
              <p className="text-sm text-muted-foreground mt-6 leading-relaxed whitespace-pre-wrap">{item.description}</p>
            )}

            {(item.file_path || item.url) && item.allow_downloads && (
              <Button size="lg" className="mt-6 bg-emerald-600 hover:bg-emerald-700" onClick={handleDownload}>
                {item.file_path ? <Download className="h-4 w-4 mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                {item.file_path ? "Download Now" : "Open Link"}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}
