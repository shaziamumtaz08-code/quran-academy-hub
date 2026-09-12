import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const NO_SUBJECT = "__none__";

/** Edit the syllabus placement (subject folder + order) of an existing Library item. */
export function LibrarySyllabusDialog({
  item, open, onOpenChange, folders = [], onSaved,
}: {
  item: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders?: string[];
  onSaved?: () => void;
}) {
  const [isSyllabus, setIsSyllabus] = useState(false);
  const [folder, setFolder] = useState("");
  const [order, setOrder] = useState("0");
  const [subjectId, setSubjectId] = useState<string>(NO_SUBJECT);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setIsSyllabus(!!item.is_syllabus);
    setFolder(item.syllabus_folder ?? "");
    setOrder(String(item.syllabus_order ?? 0));
    setSubjectId(NO_SUBJECT);
  }, [item]);

  /* Subjects drive subject-wise folders: pick the subject and the folder is
     named after it, then everyone studying that subject sees the material. */
  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      setSubjects(((data as any[]) ?? []) as { id: string; name: string }[]);
    })();
  }, [open]);

  const save = async () => {
    if (!item) return;
    if (isSyllabus && !folder.trim()) {
      toast.error("Give the subject folder a name");
      return;
    }
    setBusy(true);
    try {
      const name = folder.trim();
      const { error } = await (supabase.from("library_items") as any)
        .update({
          is_syllabus: isSyllabus,
          syllabus_folder: isSyllabus ? name : null,
          syllabus_order: isSyllabus ? Number(order) || 0 : 0,
        })
        .eq("id", item.id);
      if (error) throw error;

      /* Connect the folder to the subject so enrolled students get it. */
      if (isSyllabus && subjectId !== NO_SUBJECT) {
        const { data: existing } = await (supabase.from("syllabus_folder_links") as any)
          .select("id")
          .eq("folder", name)
          .eq("subject_id", subjectId)
          .maybeSingle();
        if (!existing) {
          const { error: linkErr } = await (supabase.from("syllabus_folder_links") as any)
            .insert({ folder: name, subject_id: subjectId });
          if (linkErr) throw linkErr;
        }
      }

      toast.success("Syllabus placement saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Syllabus placement</DialogTitle>
          <DialogDescription>{item?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <Label htmlFor="in-syllabus" className="text-sm">Show in syllabus folders</Label>
            <Switch id="in-syllabus" checked={isSyllabus} onCheckedChange={setIsSyllabus} />
          </div>

          {isSyllabus && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={subjectId}
                  onValueChange={(v) => {
                    setSubjectId(v);
                    const s = subjects.find((x) => x.id === v);
                    if (s && !folder.trim()) setFolder(s.name);
                  }}
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Choose a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SUBJECT}>No subject — folder only</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Everyone studying this subject will see this folder in their syllabus.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="folder">Folder name</Label>
                <Input
                  id="folder"
                  list="syllabus-folders"
                  value={folder}
                  placeholder="e.g. Tajweed"
                  onChange={(e) => setFolder(e.target.value)}
                />
                <datalist id="syllabus-folders">
                  {folders.map((f) => <option key={f} value={f} />)}
                  {subjects.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="order">Order in folder</Label>
                <Input
                  id="order"
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
