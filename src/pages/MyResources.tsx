import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMyResources, useResourceVersions } from "@/hooks/useMyResources";
import {
  restoreVersion, listShares, shareResource, unshareResource,
  type ResourceShare, type UserResource,
} from "@/lib/myResources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SubmitToAssignmentDialog } from "@/components/assignments/SubmitToAssignmentDialog";
import { Label } from "@/components/ui/label";
import {
  BookMarked, Copy, History, Link2, Share2, Trash2, PlayCircle, Users, Loader2,
  Upload, FolderPlus, Folder, FolderOpen, Pencil, ArrowRightLeft, Inbox,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Person = { id: string; full_name: string };

function KindBadge({ kind }: { kind: string }) {
  return kind === "copy" ? (
    <Badge variant="secondary" className="gap-1"><Copy className="h-3 w-3" /> My copy</Badge>
  ) : (
    <Badge variant="outline" className="gap-1"><Link2 className="h-3 w-3" /> Linked to Library</Badge>
  );
}

function UploadDialog({ open, onClose, folderId }: { open: boolean; onClose: () => void; folderId: string | null }) {
  const { upload } = useMyResources();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setTitle(""); setFile(null); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Add a file</DialogTitle>
          <DialogDescription>Just a name and the file — nothing else needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="res-title">Name</Label>
            <Input id="res-title" value={title} placeholder="e.g. Surah Fatiha worksheet"
              onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-file">File</Label>
            <Input id="res-file" type="file" accept="*/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }} />
          </div>
          <Button
            className="w-full" disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              const row = await upload(title, file, folderId);
              setBusy(false);
              if (row) onClose();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to My Resources"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionsDialog({ resource, onClose }: { resource: UserResource | null; onClose: () => void }) {
  const { user } = useAuth();
  const { data: versions = [], isLoading, refetch } = useResourceVersions(resource?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Dialog open={!!resource} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Version history</DialogTitle>
          <DialogDescription>{resource?.title}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No saved versions yet. Mark this resource in a class and save it there.
          </p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Version {v.version_no}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(v.created_at).toLocaleString()}{v.note ? ` · ${v.note}` : ""}
                  </p>
                </div>
                <Button
                  size="sm" variant="outline" disabled={busy === v.id}
                  onClick={async () => {
                    if (!user) return;
                    setBusy(v.id);
                    try {
                      await restoreVersion(v, user.id);
                      toast.success(`Version ${v.version_no} restored onto your copy`);
                      void refetch();
                    } catch (e: any) { toast.error(e?.message ?? "Could not restore"); }
                    finally { setBusy(null); }
                  }}
                >
                  {busy === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({ resource, onClose }: { resource: UserResource | null; onClose: () => void }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [shares, setShares] = useState<ResourceShare[]>([]);
  const [q, setQ] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!resource) return;
    void (async () => {
      const [{ data }, s] = await Promise.all([
        supabase.from("profiles").select("id, full_name").order("full_name").limit(500),
        listShares(resource.id).catch(() => [] as ResourceShare[]),
      ]);
      setPeople(((data as any[]) ?? []) as Person[]);
      setShares(s);
    })();
  }, [resource?.id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [] as Person[];
    return people.filter((p) => p.full_name?.toLowerCase().includes(term) && p.id !== user?.id).slice(0, 8);
  }, [people, q, user?.id]);

  const sharedIds = new Set(shares.map((s) => s.shared_with));

  return (
    <Dialog open={!!resource} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Share with a student</DialogTitle>
          <DialogDescription>{resource?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <Label htmlFor="can-edit" className="cursor-pointer text-sm">Let them mark it too</Label>
            <Switch id="can-edit" checked={canEdit} onCheckedChange={setCanEdit} />
          </div>
          <Input placeholder="Search a person by name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                onClick={async () => {
                  if (!resource || !user) return;
                  setBusy(true);
                  try {
                    await shareResource({ resourceId: resource.id, sharedWith: p.id, sharedBy: user.id, canEdit });
                    setShares(await listShares(resource.id));
                    setQ("");
                    toast.success(`Shared with ${p.full_name}`);
                  } catch (e: any) { toast.error(e?.message ?? "Could not share"); }
                  finally { setBusy(false); }
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm"
              >
                {p.full_name} {sharedIds.has(p.id) && <span className="text-xs text-muted-foreground">· already shared</span>}
              </button>
            ))}
          </div>

          {shares.length > 0 && (
            <div className="rounded-lg border border-border/60 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Shared with
              </p>
              {shares.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{people.find((p) => p.id === s.shared_with)?.full_name ?? "Someone"}{s.can_edit ? " · can mark" : ""}</span>
                  <Button
                    size="sm" variant="ghost"
                    onClick={async () => {
                      if (!resource) return;
                      await unshareResource(resource.id, s.shared_with);
                      setShares(await listShares(resource.id));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyResources() {
  const { user, profile, activeRole } = useAuth();
  const navigate = useNavigate();
  const {
    mine, sharedWithMe, folders, isLoading, remove,
    rename, move, addFolder, editFolder, removeFolder,
  } = useMyResources();
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [versionsFor, setVersionsFor] = useState<UserResource | null>(null);
  const [shareFor, setShareFor] = useState<UserResource | null>(null);
  const [submitFor, setSubmitFor] = useState<UserResource | null>(null);
  const [students, setStudents] = useState<Person[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "copy" | "reference">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "name">("updated");

  const role = (activeRole || (profile as any)?.role) as string | undefined;
  const isStaff = !!role && ["teacher", "admin", "admin_division", "admin_academic", "super_admin"].includes(role);

  useEffect(() => {
    if (!isStaff) return;
    void (async () => {
      const { data } = await supabase
        .from("student_teacher_assignments")
        .select("student_id, profile:student_id(id, full_name)")
        .eq("teacher_id", user?.id ?? "")
        .limit(100);
      const list = ((data as any[]) ?? [])
        .map((r) => r.profile)
        .filter(Boolean) as Person[];
      const seen = new Set<string>();
      setStudents(list.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))));
    })();
  }, [isStaff, user?.id]);

  const openInClass = (resource: UserResource, studentId?: string) => {
    const target = studentId || (isStaff ? students[0]?.id : user?.id);
    if (!target) { toast.info("No class to open this in yet"); return; }
    navigate(`/vcr/${target}?resource=${resource.id}`);
  };

  const base = tab === "mine" ? mine : sharedWithMe;

  const types = useMemo(
    () => Array.from(new Set(base.map((r) => r.type).filter(Boolean))) as string[],
    [base]
  );

  const list = useMemo(() => {
    let rows = [...base];
    if (tab === "mine") rows = rows.filter((r) => ((r as any).folder_id ?? null) === folderId);
    if (kindFilter !== "all") rows = rows.filter((r) => r.kind === kindFilter);
    if (typeFilter !== "all") rows = rows.filter((r) => (r.type ?? "file") === typeFilter);
    const term = search.trim().toLowerCase();
    if (term) rows = rows.filter((r) => r.title?.toLowerCase().includes(term));
    rows.sort((a, b) =>
      sortBy === "name"
        ? (a.title || "").localeCompare(b.title || "")
        : sortBy === "created"
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(b.updated_at) - +new Date(a.updated_at)
    );
    return rows;
  }, [base, tab, folderId, kindFilter, typeFilter, search, sortBy]);

  const childFolders = folders.filter((f) => (f.parent_id ?? null) === folderId);
  const currentFolder = folders.find((f) => f.id === folderId) ?? null;

  const originLabel = (r: UserResource) => {
    const origin = (r as any).origin as string | undefined;
    if (origin === "shared") return "Shared with you";
    if (origin === "review") return "Reviewed work";
    if (r.source_item_id) return "From the Library";
    return "Your upload";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-accent" /> My Resources
          </h1>
          <p className="text-sm text-muted-foreground">
            Your own space. Library links always show the original; your own copies keep your marks and notes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={async () => {
              const name = window.prompt("Folder name");
              if (name?.trim()) await addFolder(name.trim(), folderId);
            }}>
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Add a file
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="mine">Mine ({mine.length})</TabsTrigger>
          <TabsTrigger value="shared">Shared with me ({sharedWithMe.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "mine" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setFolderId(null)}>
            All files
          </button>
          {currentFolder && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{currentFolder.name}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2"
                onClick={async () => {
                  const name = window.prompt("Rename folder", currentFolder.name);
                  if (name?.trim()) await editFolder(currentFolder.id, name.trim());
                }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2"
                onClick={async () => {
                  if (!window.confirm("Delete this folder? Files inside move back to All files.")) return;
                  await removeFolder(currentFolder.id);
                  setFolderId(currentFolder.parent_id ?? null);
                }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full sm:w-64" />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}
          className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm">
          <option value="all">All kinds</option>
          <option value="copy">My copies</option>
          <option value="reference">Library links</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm">
          <option value="all">All types</option>
          {types.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
          className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm">
          <option value="updated">Recently updated</option>
          <option value="created">Recently added</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {tab === "mine" && childFolders.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {childFolders.map((f) => (
            <button key={f.id} onClick={() => setFolderId(f.id)}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-left text-sm hover:bg-muted">
              <Folder className="h-4 w-4 text-accent" /> <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Loading…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border/60 bg-muted/20">
          {tab === "mine" ? <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" /> : <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />}
          <p className="text-sm text-muted-foreground">
            {tab === "mine" ? "Nothing here yet — add a file or save one from the Library." : "Nothing has been shared with you yet."}
          </p>
          {tab === "mine" && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => setUploadOpen(true)}>Add a file</Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/library")}>Browse the Library</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight line-clamp-2">{r.title}</h3>
                  <KindBadge kind={r.kind} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.type || "file"}
                  {r.current_version > 0 ? ` · v${r.current_version}` : ""}
                  {` · ${originLabel(r)}`}
                  {` · updated ${new Date(r.updated_at).toLocaleDateString()}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="default" className="gap-1.5" onClick={() => openInClass(r)}>
                  <PlayCircle className="h-3.5 w-3.5" /> Open in class
                </Button>
                {r.kind === "copy" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setVersionsFor(r)}>
                    <History className="h-3.5 w-3.5" /> Versions
                  </Button>
                )}
                {!isStaff && tab === "mine" && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSubmitFor(r)}>
                    <Share2 className="h-3.5 w-3.5" /> Submit to assignment
                  </Button>
                )}

                {tab === "mine" && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShareFor(r)}>
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </Button>
                    <Button size="sm" variant="ghost" title="Rename"
                      onClick={async () => {
                        const name = window.prompt("Rename", r.title);
                        if (name?.trim()) await rename(r.id, name.trim());
                      }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {tab === "mine" && folders.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={(r as any).folder_id ?? ""}
                    onChange={(e) => void move(r.id, e.target.value || null)}
                    className="h-8 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs"
                  >
                    <option value="">All files (no folder)</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {isStaff && students.length > 1 && (
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && openInClass(r, e.target.value)}
                  className={cn("w-full h-8 rounded-md border border-border/60 bg-background px-2 text-xs")}
                >
                  <option value="">Open in a specific student's class…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              )}
            </Card>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} folderId={folderId} />
      <VersionsDialog resource={versionsFor} onClose={() => setVersionsFor(null)} />
      <ShareDialog resource={shareFor} onClose={() => setShareFor(null)} />

      <SubmitToAssignmentDialog
        open={!!submitFor}
        onOpenChange={(v) => { if (!v) setSubmitFor(null); }}
        studentId={user?.id ?? ""}
        source={submitFor ? { kind: "resource", resource: submitFor } : null}
        origin="my_resources"
      />
    </div>
  );
}

