import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, BookOpen, FileText, Link2, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Category = { id: string; name: string; slug: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  defaultCategoryId?: string | null;
  /** Pre-tick "Add to syllabus folder" (e.g. when uploading from the VCR room). */
  defaultSyllabus?: boolean;
  onSaved: () => void;
}

const EXT_TO_TYPE: Record<string, string> = {
  pdf: "pdf", epub: "ebook", mobi: "ebook",
  mp3: "audio", wav: "audio", m4a: "audio",
  mp4: "video", webm: "video", mov: "video",
  jpg: "image", jpeg: "image", png: "image", webp: "image",
  doc: "document", docx: "document", ppt: "document", pptx: "document",
  xls: "spreadsheet", xlsx: "spreadsheet",
  zip: "archive", rar: "archive",
};
const getType = (n: string) => EXT_TO_TYPE[n.split(".").pop()?.toLowerCase() || ""] || "file";

export function LibraryAddItemDialog({ open, onOpenChange, categories, defaultCategoryId, defaultSyllabus = false, onSaved }: Props) {
  const { user, profile, activeRole, isSuperAdmin } = useAuth();
  const role = (activeRole || (profile as any)?.role) as string | undefined;
  const isStaff = !!isSuperAdmin || !!role && ["admin","admin_division","admin_admissions","admin_fees","admin_academic","super_admin","teacher"].includes(role);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId || "");
  const [resourceType, setResourceType] = useState("ebook");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [year, setYear] = useState("");
  const [edition, setEdition] = useState("");
  const [isbn, setIsbn] = useState("");
  const [language, setLanguage] = useState("English");
  const [pages, setPages] = useState("");
  const [tags, setTags] = useState("");
  const [url, setUrl] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [status, setStatus] = useState("published");
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isSyllabus, setIsSyllabus] = useState(defaultSyllabus);
  const [syllabusFolder, setSyllabusFolder] = useState("");
  const [syllabusOrder, setSyllabusOrder] = useState("");
  const [syllabusSubjectId, setSyllabusSubjectId] = useState("");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      setSubjects(((data as any[]) ?? []) as { id: string; name: string }[]);
    })();
  }, [open]);


  const reset = () => {
    setFile(null); setCover(null); setTitle(""); setDescription("");
    setAuthor(""); setPublisher(""); setYear(""); setEdition(""); setIsbn("");
    setLanguage("English"); setPages(""); setTags(""); setUrl("");
    setVisibility("all"); setStatus("published"); setAllowDownloads(true);
    setIsFeatured(false); setMode("file"); setResourceType("ebook");
    setIsSyllabus(defaultSyllabus); setSyllabusFolder(""); setSyllabusOrder(""); setSyllabusSubjectId("");
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!categoryId) { toast.error("Choose a category"); return; }
    if (mode === "file" && !file) { toast.error("Upload a file"); return; }
    if (mode === "link" && !url.trim()) { toast.error("Enter a URL"); return; }

    setSaving(true);
    try {
      let file_path: string | null = null;
      let detected_type = resourceType;
      let file_size_bytes: number | null = null;
      let cover_image: string | null = null;

      if (mode === "file" && file) {
        const ext = file.name.split(".").pop();
        const fname = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        file_path = `library/${fname}`;
        const { error } = await supabase.storage.from("resources").upload(file_path, file);
        if (error) throw error;
        detected_type = getType(file.name);
        file_size_bytes = file.size;
      }

      if (cover) {
        const ext = cover.name.split(".").pop();
        const fname = `library-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("resources").upload(fname, cover);
        if (error) throw error;
        cover_image = fname;
      }

      const tagArr = tags.split(",").map((t) => t.trim()).filter(Boolean);

      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        type: detected_type,
        url: mode === "link" ? url.trim() : null,
        file_path,
        cover_image,
        tags: tagArr,
        author: author.trim() || null,
        publisher: publisher.trim() || null,
        publication_year: year ? parseInt(year) : null,
        edition: edition.trim() || null,
        isbn: isbn.trim() || null,
        language: language.trim() || "English",
        pages_count: pages ? parseInt(pages) : null,
        file_size_bytes,
        status,
        allow_downloads: allowDownloads,
        is_featured: isFeatured,
        visibility,
        uploaded_by: user?.id,
        /* Non-staff uploads are always personal (private to the uploader). */
        is_personal: !isStaff,
        is_syllabus: isStaff && isSyllabus,
        syllabus_folder: isStaff && isSyllabus ? (syllabusFolder.trim() || null) : null,
        syllabus_order: isStaff && isSyllabus && syllabusOrder ? parseInt(syllabusOrder) : 0,
        syllabus_subject_id: isStaff && isSyllabus && syllabusSubjectId ? syllabusSubjectId : null,
      };

      const { error } = await (supabase.from("library_items") as any).insert(payload);
      if (error) throw error;

      toast.success("Resource added to library");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Add Resource to Library
          </DialogTitle>
          <DialogDescription>
            Add an e-book, paper, link or any learning resource with full metadata.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file"><Upload className="h-4 w-4 mr-1.5" /> File Upload</TabsTrigger>
            <TabsTrigger value="link"><Link2 className="h-4 w-4 mr-1.5" /> External Link</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-2 pt-3">
            <Label>File *</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
          </TabsContent>
          <TabsContent value="link" className="space-y-2 pt-3">
            <Label>URL *</Label>
            <Input placeholder="https://example.com/resource.pdf" value={url} onChange={(e) => setUrl(e.target.value)} />
          </TabsContent>
        </Tabs>

        <div className="space-y-4 mt-2">
          {/* Basics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. JavaScript: The First 20 Years" />
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resource Type</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebook">E-Book</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="paper">Research Paper</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="file">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this resource about?" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Tags <span className="text-muted-foreground text-xs">(comma separated)</span></Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="javascript, history, web" />
            </div>
          </div>

          {/* Bibliographic */}
          <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Author & Publication
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Author(s)</Label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Brendan Eich" /></div>
              <div className="space-y-1.5"><Label>Publisher</Label>
                <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="ACM Digital Library" /></div>
              <div className="space-y-1.5"><Label>Publication Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" /></div>
              <div className="space-y-1.5"><Label>Edition</Label>
                <Input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="1st" /></div>
              <div className="space-y-1.5"><Label>ISBN</Label>
                <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Language</Label>
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Pages</Label>
                <Input type="number" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="189" /></div>
            </div>
          </div>

          {/* Cover */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Cover Image (optional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Recommended: 300×400px</p>
          </div>

          {/* Publishing */}
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Publishing Options</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Access Level</Label>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone (signed in)</SelectItem>
                    <SelectItem value="students">Students only</SelectItem>
                    <SelectItem value="teachers">Teachers only</SelectItem>
                    <SelectItem value="admin">Admins only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="allow-dl" className="cursor-pointer">Allow Downloads</Label>
              <Switch id="allow-dl" checked={allowDownloads} onCheckedChange={setAllowDownloads} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <Label htmlFor="featured" className="cursor-pointer">Mark as Featured</Label>
              <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>

            {!isStaff && (
              <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                This file goes to your personal space — only you (and anyone you share it with in class) can see it.
              </p>
            )}
            {isStaff && (
            <div className="rounded-md border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is-syllabus" className="cursor-pointer">Use as syllabus material</Label>
                  <p className="text-xs text-muted-foreground">Shows up in the classroom reader for lessons.</p>
                </div>
                <Switch id="is-syllabus" checked={isSyllabus} onCheckedChange={setIsSyllabus} />
              </div>
              {isSyllabus && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs">Syllabus folder</Label>
                    <Input
                      value={syllabusFolder}
                      onChange={(e) => setSyllabusFolder(e.target.value)}
                      placeholder="e.g. Nazra · Grade 1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Order</Label>
                    <Input
                      type="number"
                      value={syllabusOrder}
                      onChange={(e) => setSyllabusOrder(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1.5">
                    <Label className="text-xs">Subject (optional)</Label>
                    <Select value={syllabusSubjectId} onValueChange={setSyllabusSubjectId}>
                      <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            )}

          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
