import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface PolicyDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  audience: string[];
  language: string;
  version: string;
  file_path: string | null;
  external_url: string | null;
  sort_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  policy: "Policy",
  sop: "SOP",
  contract: "Contract",
  agreement: "Agreement",
  guideline: "Guideline",
  form: "Form",
};

export function usePolicyDocuments(audience?: string) {
  return useQuery({
    queryKey: ["policy-documents", audience ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_documents")
        .select(
          "id,title,description,category,audience,language,version,file_path,external_url,sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as PolicyDocument[];
      if (!audience) return rows;
      return rows.filter(
        (row) => row.audience.includes("all") || row.audience.includes(audience),
      );
    },
  });
}

export async function openPolicyDocument(doc: PolicyDocument) {
  if (doc.external_url) {
    window.open(doc.external_url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!doc.file_path) return;
  const { data, error } = await supabase.storage
    .from("policy-documents")
    .createSignedUrl(doc.file_path, 60 * 60);
  if (error || !data?.signedUrl) {
    toast.error("Could not open the document. Please try again.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function AddPolicyDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("policy");
  const [language, setLanguage] = useState("en");
  const [version, setVersion] = useState("v1");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let filePath: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "-");
        filePath = `${category}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("policy-documents")
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from("policy_documents").insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        language,
        version: version.trim() || "v1",
        file_path: filePath,
        external_url: externalUrl.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document published");
      queryClient.invalidateQueries({ queryKey: ["policy-documents"] });
      setOpen(false);
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setFile(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish a policy or SOP</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ur">Urdu</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Upload file (PDF)</Label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label>…or link to an external document</Label>
            <Input
              placeholder="https://"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || (!file && !externalUrl.trim()) || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PolicyLibraryProps {
  audience?: string;
  canManage?: boolean;
  compact?: boolean;
}

export function PolicyLibrary({ audience, canManage = false, compact = false }: PolicyLibraryProps) {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading } = usePolicyDocuments(audience);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("policy_documents")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document archived");
      queryClient.invalidateQueries({ queryKey: ["policy-documents"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const grouped = docs.reduce<Record<string, PolicyDocument[]>>((acc, doc) => {
    (acc[doc.category] ??= []).push(doc);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <AddPolicyDialog />
        </div>
      )}

      {docs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No policies published yet.
            </p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category} className="overflow-hidden">
          <CardHeader className="border-b bg-muted/40 py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              {CATEGORY_LABELS[category] ?? category}
              <Badge variant="secondary" className="ml-1">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {items.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {doc.title}
                    </p>
                    {!compact && doc.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {doc.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {doc.language}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {doc.version}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => openPolicyDocument(doc)}
                  >
                    {doc.external_url ? (
                      <ExternalLink className="h-3.5 w-3.5" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Open
                  </Button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove.mutate(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
