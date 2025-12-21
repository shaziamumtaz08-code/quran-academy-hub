import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Link } from "lucide-react";

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadFiles: (files: FileList) => Promise<void>;
  onAddLink: (title: string, url: string) => Promise<void>;
}

export function UploadFileDialog({
  open,
  onOpenChange,
  onUploadFiles,
  onAddLink,
}: UploadFileDialogProps) {
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [files, setFiles] = useState<FileList | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (uploadType === "file" && files) {
        await onUploadFiles(files);
      } else if (uploadType === "link" && linkTitle.trim() && linkUrl.trim()) {
        await onAddLink(linkTitle.trim(), linkUrl.trim());
      }
      resetForm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFiles(null);
    setLinkTitle("");
    setLinkUrl("");
    setUploadType("file");
  };

  const isValid =
    uploadType === "file"
      ? files && files.length > 0
      : linkTitle.trim() && linkUrl.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Upload</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={uploadType === "file" ? "default" : "outline"}
              onClick={() => setUploadType("file")}
              className="flex-1"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Files
            </Button>
            <Button
              type="button"
              variant={uploadType === "link" ? "default" : "outline"}
              onClick={() => setUploadType("link")}
              className="flex-1"
              size="sm"
            >
              <Link className="h-4 w-4 mr-2" />
              Link
            </Button>
          </div>

          {uploadType === "file" ? (
            <div className="space-y-2">
              <Label>Select files</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                PDF, Audio, Video, Images, or Archives
              </p>
              {files && files.length > 0 && (
                <p className="text-xs text-primary font-medium">
                  {files.length} file(s) selected
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Link name"
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {uploadType === "file" ? "Upload" : "Add Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
