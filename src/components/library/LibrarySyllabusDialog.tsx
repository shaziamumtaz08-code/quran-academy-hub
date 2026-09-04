import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    setIsSyllabus(!!item.is_syllabus);
    setFolder(item.syllabus_folder ?? "");
    setOrder(String(item.syllabus_order ?? 0));
  }, [item]);

  const save = async () => {
    if (!item) return;
    if (isSyllabus && !folder.trim()) {
      toast.error("Give the subject folder a name");
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase.from("library_items") as any)
        .update({
          is_syllabus: isSyllabus,
          syllabus_folder: isSyllabus ? folder.trim() : null,
          syllabus_order: isSyllabus ? Number(order) || 0 : 0,
        })
        .eq("id", item.id);
      if (error) throw error;
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
                <Label htmlFor="folder">Subject folder</Label>
                <Input
                  id="folder"
                  list="syllabus-folders"
                  value={folder}
                  placeholder="e.g. Tajweed"
                  onChange={(e) => setFolder(e.target.value)}
                />
                <datalist id="syllabus-folders">
                  {folders.map((f) => <option key={f} value={f} />)}
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
