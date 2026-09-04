import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Library as LibraryIcon, Search, Upload, BookOpen, FileText, Newspaper,
  GraduationCap, ClipboardList, StickyNote, BookMarked, FolderOpen, Music, Video,
  Link as LinkIcon, Sparkles, TrendingUp, Clock, Filter, Trash2, MoreVertical,
  Star, History, CheckSquare, X, Loader2, Folder, FolderClosed, Calendar,
  FileType2, Image as ImageIcon, ChevronRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";
import { LibraryItemDetail } from "@/components/library/LibraryItemDetail";
import { LibraryAddItemDialog } from "@/components/library/LibraryAddItemDialog";

const ICON_MAP: Record<string, any> = {
  FolderOpen, BookOpen, FileText, Music, Video, Link: LinkIcon, BookMarked,
  Newspaper, ClipboardList, StickyNote, GraduationCap, Library: LibraryIcon,
};

type Category = {
  id: string; name: string; slug: string; icon: string | null;
  color: string | null; visibility_default: string; sort_order: number;
};

type View = "browse" | "favorites" | "recent" | "mine";
type BrowseMode = "category" | "type" | "date";

const TYPE_META: Record<string, { label: string; icon: any; color: string; tint: string }> = {
  pdf:      { label: "PDFs",       icon: FileText,     color: "#e11d48", tint: "#fee2e2" },
  ebook:    { label: "E-Books",    icon: BookOpen,     color: "#059669", tint: "#d1fae5" },
  paper:    { label: "Papers",     icon: Newspaper,    color: "#2563eb", tint: "#dbeafe" },
  document: { label: "Documents",  icon: FileText,     color: "#475569", tint: "#e2e8f0" },
  video:    { label: "Videos",     icon: Video,        color: "#c026d3", tint: "#fae8ff" },
  audio:    { label: "Audio",      icon: Music,        color: "#7c3aed", tint: "#ede9fe" },
  link:     { label: "Links",      icon: LinkIcon,     color: "#0891b2", tint: "#cffafe" },
  image:    { label: "Images",     icon: ImageIcon,    color: "#d97706", tint: "#fef3c7" },
  file:     { label: "Other Files",icon: FileType2,    color: "#64748b", tint: "#f1f5f9" },
};

const DATE_BUCKETS: { key: string; label: string; test: (d: Date, now: Date) => boolean; color: string; tint: string }[] = [
  { key: "week",   label: "This Week",       color: "#059669", tint: "#d1fae5",
    test: (d, now) => (now.getTime() - d.getTime()) < 7 * 864e5 },
  { key: "month",  label: "This Month",      color: "#0891b2", tint: "#cffafe",
    test: (d, now) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() },
  { key: "year",   label: "Earlier This Year", color: "#7c3aed", tint: "#ede9fe",
    test: (d, now) => d.getFullYear() === now.getFullYear() },
  { key: "older",  label: "Older",           color: "#64748b", tint: "#e2e8f0",
    test: () => true },
];

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur border border-white/15 min-w-[90px]">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">{label}</div>
    </div>
  );
}

function FolderCard({
  label, count, icon: Icon, color, tint, onClick,
}: { label: string; count: number; icon: any; color: string; tint?: string; onClick: () => void }) {
  const bg = tint || `${color}1f`;
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center text-center rounded-2xl p-3 transition-all hover:-translate-y-1"
    >
      <div
        className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110"
        style={{ backgroundColor: bg, color, boxShadow: `0 8px 20px -10px ${color}88` }}
      >
        <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.2} />
      </div>
      <h3 className="mt-3 font-semibold text-[13px] leading-tight line-clamp-2 text-foreground">
        {label}
      </h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {count} {count === 1 ? "item" : "items"}
      </p>
      <span
        className="mt-1.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
        style={{ backgroundColor: bg, color }}
      >
        View <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  );
}

function QuickNavTab({
  active, label, icon: Icon, onClick,
}: { active: boolean; label: string; icon: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function CategoryPill({
  active, label, count, icon: Icon, color, onClick,
}: { active: boolean; label: string; count: number; icon: any; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-background border-border/60 hover:border-accent/50 hover:bg-muted/50 text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" style={!active && color ? { color } : undefined} />
      {label}
      <Badge variant="secondary" className={cn("ml-0.5 h-4 px-1.5 text-[10px]", active && "bg-background/20 text-background border-0")}>
        {count}
      </Badge>
    </button>
  );
}

function SectionHeader({
  icon: Icon, title, subtitle, accent,
}: { icon: any; title: string; subtitle?: string; accent?: "amber" | "emerald" | "rose" }) {
  const accentColor = accent === "amber" ? "text-amber-500" : accent === "rose" ? "text-rose-500" : accent === "emerald" ? "text-emerald-500" : "text-accent";
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Icon className={cn("h-5 w-5", accentColor)} />{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ canUpload, onUpload }: { canUpload: boolean; onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border/60 bg-muted/20">
      <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">No resources yet</p>
      {canUpload && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onUpload}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Add the first one
        </Button>
      )}
    </div>
  );
}
export default function Library() {
  const { user, isSuperAdmin, profile, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const role = (activeRole || profile?.role) as string | undefined;
  const isAdmin = isSuperAdmin || (role ? ["admin","admin_division","admin_admissions","admin_fees","admin_academic","super_admin"].includes(role) : false);
  const isTeacher = role === "teacher";
  /* Everyone gets a personal library space: any signed-in user can upload.
     Non-staff uploads are stored as personal (private) items by the dialog. */
  const canUpload = !!user;

  const [view, setView] = useState<View>("browse");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("category");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeDateBucket, setActiveDateBucket] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "title">("recent");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  // Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["library-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_categories").select("*").order("sort_order");
      if (error) throw error;
      return (data || []) as Category[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library-items-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_items").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user?.id,
  });

  const { data: favoriteIds = new Set<string>() } = useQuery({
    queryKey: ["library-favorites", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("library_favorites") as any)
        .select("item_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => r.item_id));
    },
    enabled: !!user?.id,
  });

  const { data: recentIds = [] } = useQuery({
    queryKey: ["library-recent", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("library_view_events") as any)
        .select("item_id, viewed_at").eq("user_id", user!.id)
        .order("viewed_at", { ascending: false }).limit(50);
      if (error) throw error;
      const seen = new Set<string>(); const ids: string[] = [];
      for (const r of (data || []) as any[]) {
        if (!seen.has(r.item_id)) { seen.add(r.item_id); ids.push(r.item_id); }
        if (ids.length >= 12) break;
      }
      return ids;
    },
    enabled: !!user?.id,
  });

  /* Personal files shared with me (shown in my class by a teacher). RLS on
     personal_item_shares already scopes this to the student, their parents,
     the sharer, and admins. */
  const { data: sharedItemIds = new Set<string>() } = useQuery({
    queryKey: ["personal-item-shares", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("personal_item_shares") as any)
        .select("item_id");
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => r.item_id));
    },
    enabled: !!user?.id,
  });

  const toggleFavorite = async (itemId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(itemId);
    try {
      if (isFav) {
        await (supabase.from("library_favorites") as any)
          .delete().eq("user_id", user.id).eq("item_id", itemId);
      } else {
        await (supabase.from("library_favorites") as any)
          .insert({ user_id: user.id, item_id: itemId });
      }
      queryClient.invalidateQueries({ queryKey: ["library-favorites"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const publishedItems = useMemo(
    () => items
      .filter((i) => (i.status ?? "published") === "published")
      .filter((i) => {
        if (isAdmin) return true;
        // Uploader always sees their own items
        if (user?.id && i.uploaded_by === user.id) return true;
        // Personal files are private: only owner/admins, or someone the file
        // was shared with in class.
        if (i.is_personal) return sharedItemIds.has(i.id);
        const vis = i.visibility ?? "all";
        if (vis === "all") return true;
        if (vis === "admin_only") return false;
        if (vis === "teachers" && isTeacher) return true;
        if (vis === "students" && (role === "student" || role === "parent")) return true;
        if (vis === "custom" && Array.isArray(i.visible_to_roles) && role && i.visible_to_roles.includes(role)) return true;
        // Default: not assigned to a role → hide from non-admins
        return false;
      }),
    [items, isAdmin, isTeacher, role, user?.id, sharedItemIds]
  );

  const itemById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  const favoriteItems = useMemo(
    () => publishedItems.filter((i) => favoriteIds.has(i.id)),
    [publishedItems, favoriteIds]
  );
  /* My Library: everything I uploaded, saved as favorite, or that was shared
     with me in class — one personal shelf. */
  const myLibraryItems = useMemo(
    () => publishedItems.filter((i) =>
      (user?.id && i.uploaded_by === user.id) || favoriteIds.has(i.id) || sharedItemIds.has(i.id)
    ),
    [publishedItems, favoriteIds, sharedItemIds, user?.id]
  );
  const recentItems = useMemo(
    () => recentIds.map((id) => itemById[id]).filter(Boolean),
    [recentIds, itemById]
  );

  const featured = useMemo(() => publishedItems.filter((i) => i.is_featured).slice(0, 4), [publishedItems]);
  const recent = useMemo(() => [...publishedItems].slice(0, 8), [publishedItems]);
  const popular = useMemo(
    () => [...publishedItems].sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0)).slice(0, 8),
    [publishedItems]
  );

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of publishedItems) if (i.category_id) m[i.category_id] = (m[i.category_id] || 0) + 1;
    return m;
  }, [publishedItems]);

  const typeGroups = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const i of publishedItems) {
      const k = i.type || "file";
      (m[k] ||= []).push(i);
    }
    return Object.entries(m)
      .map(([k, v]) => ({ key: k, meta: TYPE_META[k] || TYPE_META.file, items: v }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [publishedItems]);

  const dateGroups = useMemo(() => {
    const now = new Date();
    const m: Record<string, any[]> = {};
    for (const i of publishedItems) {
      const d = new Date(i.created_at);
      const bucket = DATE_BUCKETS.find((b) => b.test(d, now))!;
      (m[bucket.key] ||= []).push(i);
    }
    return DATE_BUCKETS.map((b) => ({ ...b, items: m[b.key] || [] })).filter((g) => g.items.length > 0);
  }, [publishedItems]);

  const filtered = useMemo(() => {
    let base = publishedItems;
    if (view === "favorites") base = favoriteItems;
    else if (view === "recent") base = recentItems;
    else if (view === "mine") base = myLibraryItems;
    if (activeCategory) base = base.filter((i) => i.category_id === activeCategory);
    if (activeType) base = base.filter((i) => (i.type || "file") === activeType);
    if (activeDateBucket) {
      const now = new Date();
      const bucket = DATE_BUCKETS.find((b) => b.key === activeDateBucket);
      if (bucket) base = base.filter((i) => {
        const d = new Date(i.created_at);
        const firstMatch = DATE_BUCKETS.find((b) => b.test(d, now));
        return firstMatch?.key === bucket.key;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter((i) =>
        i.title?.toLowerCase().includes(q) ||
        i.author?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.tags?.some((t: string) => t.toLowerCase().includes(q)) ||
        i.ai_tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...base];
    if (sortBy === "popular") sorted.sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0));
    else if (sortBy === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [publishedItems, favoriteItems, recentItems, myLibraryItems, view, activeCategory, activeType, activeDateBucket, search, sortBy]);

  const totalDownloads = useMemo(
    () => publishedItems.reduce((s, i) => s + (i.downloads_count || 0), 0),
    [publishedItems]
  );

  const hasFilter = !!activeCategory || !!activeType || !!activeDateBucket;
  const isLandingView = view === "browse" && !hasFilter && !search;
  const clearFilters = () => { setActiveCategory(null); setActiveType(null); setActiveDateBucket(null); };
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["library-items-v2"] });
    queryClient.invalidateQueries({ queryKey: ["library-recent"] });
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      if (deleteItem.file_path) await supabase.storage.from("resources").remove([deleteItem.file_path]);
      const { error } = await supabase.from("library_items").delete().eq("id", deleteItem.id);
      if (error) throw error;
      toast.success("Removed");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleteItem(null); }
  };

  const handleBulkDelete = async () => {
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const toDelete = ids.map((id) => itemById[id]).filter(Boolean);
      const paths = toDelete.map((i) => i.file_path).filter(Boolean);
      if (paths.length) await supabase.storage.from("resources").remove(paths);
      const { error } = await supabase.from("library_items").delete().in("id", ids);
      if (error) throw error;
      toast.success(`Deleted ${ids.length} resource${ids.length === 1 ? "" : "s"}`);
      setSelectedIds(new Set()); setSelectMode(false); refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); setBulkDeleteOpen(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeCat = categories.find((c) => c.id === activeCategory);
  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name;

  const renderCard = (i: any) => (
    <LibraryItemCard
      key={i.id}
      item={i}
      onClick={() => setDetailItem(i)}
      isFavorite={favoriteIds.has(i.id)}
      onToggleFavorite={() => toggleFavorite(i.id)}
      selectMode={selectMode}
      selected={selectedIds.has(i.id)}
      onToggleSelect={() => toggleSelect(i.id)}
    />
  );

  return (
    <div className="min-h-screen -m-4 lg:-m-6 bg-gradient-to-b from-background via-background to-muted/30 animate-fade-in">
      {/* HERO — AI gradient */}
      <section className="relative overflow-hidden border-b border-border/60 text-white bg-[#05060f]">
        {/* layered conic + radial gradients = AI aurora */}
        <div className="absolute inset-0 opacity-90" style={{
          background:
            "radial-gradient(60% 80% at 10% 20%, hsl(280 90% 55% / 0.55), transparent 60%)," +
            "radial-gradient(55% 70% at 90% 10%, hsl(195 95% 55% / 0.55), transparent 60%)," +
            "radial-gradient(70% 90% at 70% 100%, hsl(330 95% 60% / 0.55), transparent 60%)," +
            "radial-gradient(50% 70% at 30% 90%, hsl(155 90% 50% / 0.45), transparent 60%)," +
            "radial-gradient(40% 60% at 50% 50%, hsl(45 100% 60% / 0.25), transparent 70%)",
        }} />
        {/* subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />
        {/* noise / film grain */}
        <div className="absolute inset-0 opacity-[0.12] mix-blend-soft-light" style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }} />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs font-medium mb-4">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "#fde68a" }} />
                <span className="bg-gradient-to-r from-fuchsia-200 via-sky-200 to-emerald-200 bg-clip-text text-transparent">
                  AI-Powered Library
                </span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-bold leading-tight tracking-tight">
                Explore the{" "}
                <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 via-50% to-cyan-300 bg-clip-text text-transparent">
                  Knowledge Library
                </span>
              </h1>
              <p className="mt-3 text-sm lg:text-base text-white/75 leading-relaxed">
                Curated e-books, research papers, lecture notes and study resources — organised,
                searchable, and intelligently tagged.
              </p>
              <div className="mt-6 relative max-w-xl group">
                <div className="absolute -inset-px rounded-md bg-gradient-to-r from-fuchsia-500/50 via-sky-400/50 to-emerald-400/50 opacity-60 group-focus-within:opacity-100 blur-sm transition" />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 z-10" />
                  <Input
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search books, papers, authors, tags…"
                    className="pl-11 h-12 bg-black/40 backdrop-blur border-white/20 text-white placeholder:text-white/50 focus-visible:ring-fuchsia-400/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <StatChip value={publishedItems.length} label="Resources" />
              <StatChip value={categories.length} label="Categories" />
              <StatChip value={totalDownloads} label="Downloads" />
            </div>
          </div>
        </div>
      </section>

      {/* TOP NAV BAR — view tabs + categories */}
      <section className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-10 py-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={view} onValueChange={(v) => { setView(v as View); clearFilters(); }}>
              <TabsList className="h-9">
                <TabsTrigger value="browse" className="text-xs gap-1.5"><LibraryIcon className="h-3.5 w-3.5" /> Browse</TabsTrigger>
                <TabsTrigger value="mine" className="text-xs gap-1.5"><BookOpen className="h-3.5 w-3.5" /> My Library ({myLibraryItems.length})</TabsTrigger>
                <TabsTrigger value="favorites" className="text-xs gap-1.5"><Star className="h-3.5 w-3.5" /> Favorites ({favoriteItems.length})</TabsTrigger>
                <TabsTrigger value="recent" className="text-xs gap-1.5"><History className="h-3.5 w-3.5" /> Recently Viewed</TabsTrigger>
              </TabsList>
            </Tabs>

            {view === "browse" && (
              <Tabs value={browseMode} onValueChange={(v) => { setBrowseMode(v as BrowseMode); clearFilters(); }}>
                <TabsList className="h-9 bg-muted/60">
                  <TabsTrigger value="category" className="text-xs gap-1.5"><FolderClosed className="h-3.5 w-3.5" /> Category</TabsTrigger>
                  <TabsTrigger value="type" className="text-xs gap-1.5"><FileType2 className="h-3.5 w-3.5" /> Type</TabsTrigger>
                  <TabsTrigger value="date" className="text-xs gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="ml-auto flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant={selectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setSelectMode((s) => !s); setSelectedIds(new Set()); }}
                >
                  {selectMode ? <><X className="h-4 w-4 mr-1.5" /> Cancel</> : <><CheckSquare className="h-4 w-4 mr-1.5" /> Select</>}
                </Button>
              )}
              {selectMode && selectedIds.size > 0 && (
                <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete ({selectedIds.size})
                </Button>
              )}
              {canUpload && !selectMode && (
                <Button onClick={() => setUploadOpen(true)} size="sm" className="text-white border-0 shadow-md bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 hover:from-fuchsia-500 hover:via-violet-500 hover:to-cyan-500">
                  <Upload className="h-4 w-4 mr-1.5" /> Add Resource
                </Button>
              )}
            </div>
          </div>

          {/* Active filter breadcrumb */}
          {hasFilter && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <button onClick={clearFilters} className="text-muted-foreground hover:text-foreground">All</button>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              {activeCategory && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <FolderClosed className="h-3 w-3" />
                  {categories.find((c) => c.id === activeCategory)?.name}
                  <button onClick={() => setActiveCategory(null)} className="ml-1 hover:bg-background/40 rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {activeType && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <FileType2 className="h-3 w-3" />
                  {TYPE_META[activeType]?.label || activeType}
                  <button onClick={() => setActiveType(null)} className="ml-1 hover:bg-background/40 rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {activeDateBucket && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <Calendar className="h-3 w-3" />
                  {DATE_BUCKETS.find((b) => b.key === activeDateBucket)?.label}
                  <button onClick={() => setActiveDateBucket(null)} className="ml-1 hover:bg-background/40 rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>
          )}

          {/* Quick category nav (like reference: Home / Browse / E-Books / Past Papers / ...) */}
          {view === "browse" && (
            <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pt-1 border-t border-border/40">
              <QuickNavTab
                active={!activeCategory && !activeType && !activeDateBucket && !search}
                label="Home"
                icon={LibraryIcon}
                onClick={clearFilters}
              />
              {[...categories]
                .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0))
                .slice(0, 5)
                .map((c) => {
                  const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
                  return (
                    <QuickNavTab
                      key={c.id}
                      active={activeCategory === c.id}
                      label={c.name}
                      icon={Icon}
                      onClick={() => { setActiveType(null); setActiveDateBucket(null); setActiveCategory(c.id); }}
                    />
                  );
                })}
              {categories.length > 5 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                      <MoreVertical className="h-3.5 w-3.5" /> More
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                    {[...categories]
                      .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0))
                      .slice(5)
                      .map((c) => {
                        const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
                        return (
                          <DropdownMenuItem key={c.id} onClick={() => { setActiveType(null); setActiveDateBucket(null); setActiveCategory(c.id); }}>
                            <Icon className="h-3.5 w-3.5 mr-2" /> {c.name}
                            <span className="ml-auto text-xs text-muted-foreground">{categoryCounts[c.id] || 0}</span>
                          </DropdownMenuItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 lg:px-10 py-8 space-y-12">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading library…</div>
        ) : isLandingView ? (
          <>
            {/* BROWSE FOLDERS — first thing users see */}
            <section>
              <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    {browseMode === "category" && <><FolderClosed className="h-5 w-5 text-fuchsia-500" /> Browse by Category</>}
                    {browseMode === "type" && <><FileType2 className="h-5 w-5 text-violet-500" /> Browse by Type</>}
                    {browseMode === "date" && <><Calendar className="h-5 w-5 text-cyan-500" /> Browse by Date</>}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {browseMode === "category" && "Folders organised by topic — syllabus, past papers, textbooks…"}
                    {browseMode === "type" && "Grouped by file format — PDFs, videos, audio and more."}
                    {browseMode === "date" && "Find resources by when they were added."}
                  </p>
                </div>
              </div>

              {browseMode === "category" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {categories.slice(0, 6).map((c) => {
                    const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
                    return (
                      <FolderCard
                        key={c.id}
                        label={c.name}
                        count={categoryCounts[c.id] || 0}
                        icon={Icon}
                        color={c.color || "#64748b"}
                        onClick={() => setActiveCategory(c.id)}
                      />
                    );
                  })}
                </div>
              )}

              {browseMode === "type" && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {typeGroups.slice(0, 6).map(({ key, meta, items: it }) => (
                    <FolderCard
                      key={key}
                      label={meta.label}
                      count={it.length}
                      icon={meta.icon}
                      color={meta.color}
                      tint={meta.tint}
                      onClick={() => setActiveType(key)}
                    />
                  ))}
                </div>
              )}

              {browseMode === "date" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {dateGroups.map((g) => (
                    <FolderCard
                      key={g.key}
                      label={g.label}
                      count={g.items.length}
                      icon={Calendar}
                      color={g.color}
                      tint={g.tint}
                      onClick={() => setActiveDateBucket(g.key)}
                    />
                  ))}
                </div>
              )}
            </section>

            {recentItems.length > 0 && (
              <section>
                <SectionHeader icon={History} title="Pick up where you left off" subtitle="Recently viewed by you" accent="emerald" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {recentItems.slice(0, 6).map(renderCard)}
                </div>
              </section>
            )}

            {favoriteItems.length > 0 && (
              <section>
                <SectionHeader icon={Star} title="Your Favorites" subtitle="Starred resources" accent="amber" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {favoriteItems.slice(0, 6).map(renderCard)}
                </div>
              </section>
            )}

            {featured.length > 0 && (
              <section>
                <SectionHeader icon={Sparkles} title="Featured Resources" subtitle="Hand-picked must-reads" accent="amber" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">{featured.slice(0, 6).map(renderCard)}</div>
              </section>
            )}

            <section>
              <SectionHeader icon={Clock} title="Recently Added" subtitle="Fresh in the library" accent="emerald" />
              {recent.length === 0 ? (
                <EmptyState canUpload={canUpload} onUpload={() => setUploadOpen(true)} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">{recent.slice(0, 6).map(renderCard)}</div>
              )}
            </section>

            {popular.length > 0 && totalDownloads > 0 && (
              <section>
                <SectionHeader icon={TrendingUp} title="Most Downloaded" subtitle="Reader favourites" accent="rose" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">{popular.slice(0, 6).map(renderCard)}</div>
              </section>
            )}
          </>

        ) : (
          <section>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">
                  {view === "favorites" ? "Your Favorites"
                    : view === "mine" ? "My Library"
                    : view === "recent" ? "Recently Viewed"
                    : activeCategory ? categories.find((c) => c.id === activeCategory)?.name
                    : activeType ? TYPE_META[activeType]?.label || activeType
                    : activeDateBucket ? DATE_BUCKETS.find((b) => b.key === activeDateBucket)?.label
                    : search ? `Results for "${search}"`
                    : "All Resources"}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filtered.length} {filtered.length === 1 ? "resource" : "resources"}
                </p>
              </div>
              <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <TabsList className="h-9">
                  <TabsTrigger value="recent" className="text-xs"><Clock className="h-3 w-3 mr-1" /> Recent</TabsTrigger>
                  <TabsTrigger value="popular" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" /> Popular</TabsTrigger>
                  <TabsTrigger value="title" className="text-xs"><Filter className="h-3 w-3 mr-1" /> A–Z</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {filtered.length === 0 ? (
              <EmptyState canUpload={canUpload} onUpload={() => setUploadOpen(true)} />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map((i) => (
                  <div key={i.id} className="relative group">
                    {renderCard(i)}
                    {!selectMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="absolute top-2 right-12 z-10 p-1.5 rounded-md bg-background/90 backdrop-blur border border-border/60 opacity-0 group-hover:opacity-100 transition"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => void addResource(i, "reference")}>
                            <Link2 className="h-3.5 w-3.5 mr-2" /> Save to My Resources
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void addResource(i, "copy")}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Make my own copy
                          </DropdownMenuItem>
                          {(isAdmin || i.uploaded_by === user?.id) && (
                            <DropdownMenuItem
                              onClick={() => setDeleteItem(i)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Dialogs */}
      <LibraryItemDetail
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(o) => { if (!o) setDetailItem(null); }}
        categoryName={categoryName(detailItem?.category_id)}
        isFavorite={detailItem ? favoriteIds.has(detailItem.id) : false}
        onToggleFavorite={detailItem ? () => toggleFavorite(detailItem.id) : undefined}
        onUpdated={refresh}
      />

      <LibraryAddItemDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        defaultCategoryId={activeCategory}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteItem?.title}" will be deleted permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} resource{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All selected items and their files will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

