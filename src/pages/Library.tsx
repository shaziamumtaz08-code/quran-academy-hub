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

type View = "browse" | "favorites" | "recent";
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

export default function Library() {
  const { user, isSuperAdmin, profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isSuperAdmin || profile?.role === "admin";
  const isTeacher = profile?.role === "teacher";
  const canUpload = isAdmin || isTeacher;

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
    () => items.filter((i) => (i.status ?? "published") === "published"),
    [items]
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

  const filtered = useMemo(() => {
    let base = publishedItems;
    if (view === "favorites") base = favoriteItems;
    else if (view === "recent") base = recentItems;
    if (activeCategory) base = base.filter((i) => i.category_id === activeCategory);
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
  }, [publishedItems, favoriteItems, recentItems, view, activeCategory, search, sortBy]);

  const totalDownloads = useMemo(
    () => publishedItems.reduce((s, i) => s + (i.downloads_count || 0), 0),
    [publishedItems]
  );

  const isLandingView = view === "browse" && !activeCategory && !search;
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
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, hsl(160 85% 50% / 0.4), transparent 50%), radial-gradient(circle at 80% 60%, hsl(45 90% 60% / 0.3), transparent 50%)",
        }} />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-medium mb-4">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Digital Library
              </div>
              <h1 className="text-3xl lg:text-5xl font-bold leading-tight tracking-tight">
                Explore the <span className="text-emerald-300">Knowledge Library</span>
              </h1>
              <p className="mt-3 text-sm lg:text-base text-white/70 leading-relaxed">
                Curated e-books, research papers, lecture notes and study resources — organized,
                searchable, and personalized to you.
              </p>
              <div className="mt-6 relative max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search books, papers, authors, tags…"
                  className="pl-11 h-12 bg-white/10 backdrop-blur border-white/20 text-white placeholder:text-white/50 focus-visible:ring-emerald-400/50"
                />
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
            <Tabs value={view} onValueChange={(v) => { setView(v as View); setActiveCategory(null); }}>
              <TabsList className="h-9">
                <TabsTrigger value="browse" className="text-xs gap-1.5"><LibraryIcon className="h-3.5 w-3.5" /> Browse</TabsTrigger>
                <TabsTrigger value="favorites" className="text-xs gap-1.5"><Star className="h-3.5 w-3.5" /> Favorites ({favoriteItems.length})</TabsTrigger>
                <TabsTrigger value="recent" className="text-xs gap-1.5"><History className="h-3.5 w-3.5" /> Recently Viewed</TabsTrigger>
              </TabsList>
            </Tabs>

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
                <Button onClick={() => setUploadOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Upload className="h-4 w-4 mr-1.5" /> Add Resource
                </Button>
              )}
            </div>
          </div>

          {view === "browse" && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <CategoryPill
                active={!activeCategory} label="All" count={publishedItems.length}
                icon={LibraryIcon} onClick={() => setActiveCategory(null)}
              />
              {categories.map((c) => {
                const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
                return (
                  <CategoryPill
                    key={c.id} active={activeCategory === c.id}
                    label={c.name} count={categoryCounts[c.id] || 0}
                    icon={Icon} color={c.color || undefined}
                    onClick={() => setActiveCategory(c.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 lg:px-10 py-8 space-y-12">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading library…</div>
        ) : isLandingView ? (
          <>
            {recentItems.length > 0 && (
              <section>
                <SectionHeader icon={History} title="Pick up where you left off" subtitle="Recently viewed by you" accent="emerald" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {recentItems.slice(0, 4).map(renderCard)}
                </div>
              </section>
            )}

            {favoriteItems.length > 0 && (
              <section>
                <SectionHeader icon={Star} title="Your Favorites" subtitle="Starred resources" accent="amber" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {favoriteItems.slice(0, 4).map(renderCard)}
                </div>
              </section>
            )}

            {featured.length > 0 && (
              <section>
                <SectionHeader icon={Sparkles} title="Featured Resources" subtitle="Hand-picked must-reads" accent="amber" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{featured.map(renderCard)}</div>
              </section>
            )}

            <section>
              <SectionHeader icon={Clock} title="Recently Added" subtitle="Fresh in the library" accent="emerald" />
              {recent.length === 0 ? (
                <EmptyState canUpload={canUpload} onUpload={() => setUploadOpen(true)} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{recent.map(renderCard)}</div>
              )}
            </section>

            {popular.length > 0 && totalDownloads > 0 && (
              <section>
                <SectionHeader icon={TrendingUp} title="Most Downloaded" subtitle="Reader favourites" accent="rose" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{popular.map(renderCard)}</div>
              </section>
            )}

            <section>
              <SectionHeader icon={FolderOpen} title="Browse by Category" subtitle="Find what you need by topic" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((c) => {
                  const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
                  const count = categoryCounts[c.id] || 0;
                  return (
                    <Card
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className="group cursor-pointer p-4 border-border/60 hover:border-accent/50 hover:shadow-md transition-all"
                    >
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${c.color || "#64748b"}20`, color: c.color || "#64748b" }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-semibold text-sm group-hover:text-accent transition-colors">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{count} {count === 1 ? "resource" : "resources"}</p>
                    </Card>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">
                  {view === "favorites" ? "Your Favorites"
                    : view === "recent" ? "Recently Viewed"
                    : activeCat?.name || (search ? `Results for "${search}"` : "All Resources")}
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
                    {!selectMode && (isAdmin || i.uploaded_by === user?.id) && (
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
                          <DropdownMenuItem
                            onClick={() => setDeleteItem(i)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
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

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur border border-white/15 min-w-[90px]">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/70 mt-0.5">{label}</div>
    </div>
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
