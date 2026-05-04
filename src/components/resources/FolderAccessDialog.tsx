import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type FolderAccess = "all" | "teachers" | "students" | "admin_only" | "custom";

export interface FolderFormValue {
  name: string;
  visibility: FolderAccess;
  visible_to_user_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<FolderFormValue>;
  title?: string;
  onSubmit: (v: FolderFormValue) => Promise<void>;
}

const ACCESS_OPTIONS: { value: FolderAccess; label: string }[] = [
  { value: "all", label: "Public — everyone" },
  { value: "teachers", label: "Teachers only" },
  { value: "students", label: "Students only" },
  { value: "admin_only", label: "Admin only" },
  { value: "custom", label: "Specific people" },
];

export function FolderAccessDialog({ open, onOpenChange, initial, title = "New Folder", onSubmit }: Props) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<FolderAccess>("all");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setAccess((initial?.visibility as FolderAccess) ?? "all");
      setUserIds(initial?.visible_to_user_ids ?? []);
      setSearch("");
    }
  }, [open, initial]);

  const { data: people = [] } = useQuery({
    queryKey: ["folder-access-people-search", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, email").limit(20);
      if (search.trim()) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: access === "custom",
  });

  const { data: selectedPeople = [] } = useQuery({
    queryKey: ["folder-access-selected", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      return data || [];
    },
    enabled: access === "custom" && userIds.length > 0,
  });

  const toggle = (id: string) =>
    setUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        visibility: access,
        visible_to_user_ids: access === "custom" ? userIds : [],
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="fname">Name</Label>
            <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Access</Label>
            <Select value={access} onValueChange={(v) => setAccess(v as FolderAccess)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCESS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {access === "custom" && (
            <div className="space-y-2">
              <Label>People with access</Label>
              {selectedPeople.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-md border bg-muted/30">
                  {selectedPeople.map((p: any) => (
                    <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                      {p.full_name || p.email}
                      <button onClick={() => toggle(p.id)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-8" />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {people.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">Type to search…</p>
                )}
                {people.map((p: any) => {
                  const checked = userIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`w-full flex items-center justify-between p-2 text-left text-sm hover:bg-muted/50 ${checked ? "bg-accent/10" : ""}`}
                    >
                      <div>
                        <p className="font-medium">{p.full_name || "(no name)"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      {checked && <Badge variant="default" className="text-[10px]">Selected</Badge>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ACCESS_META: Record<FolderAccess, { label: string; stripe: string; dot: string; badge: string }> = {
  all: { label: "Public", stripe: "bg-emerald-500", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  teachers: { label: "Teachers", stripe: "bg-sky-500", dot: "bg-sky-500", badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" },
  students: { label: "Students", stripe: "bg-orange-500", dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  admin_only: { label: "Admin Only", stripe: "bg-red-500", dot: "bg-red-500", badge: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
  custom: { label: "Custom", stripe: "bg-purple-500", dot: "bg-purple-500", badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
};
