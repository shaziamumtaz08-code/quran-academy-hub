import { useState, useRef } from "react";
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
import { Loader2, Upload, Link, FolderUp } from "lucide-react";

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadFiles: (files: FileList) => Promise<void>;
  onUploadFolder?: (files: File[], relativePaths: string[]) => Promise<void>;
  onAddLink: (title: string, url: string) => Promise<void>;
}

export function UploadFileDialog({
  open,
  onOpenChange,
  onUploadFiles,
  onUploadFolder,
  onAddLink,
}: UploadFileDialogProps) {
  const [uploadType, setUploadType] = useState<"file" | "folder" | "link">("file");
  const [files, setFiles] = useState<FileList | null>(null);
  const [folderFiles, setFolderFiles] = useState<{ files: File[]; paths: string[] } | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (uploadType === "file" && files) {
        await onUploadFiles(files);
      } else if (uploadType === "folder" && folderFiles && onUploadFolder) {
        await onUploadFolder(folderFiles.files, folderFiles.paths);
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
    setFolderFiles(null);
    setLinkTitle("");
    setLinkUrl("");
    setUploadType("file");
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray: File[] = [];
    const pathsArray: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      filesArray.push(file);
      // webkitRelativePath contains the relative path including folder name
      pathsArray.push((file as any).webkitRelativePath || file.name);
    }

    setFolderFiles({ files: filesArray, paths: pathsArray });
  };

  const getFolderName = () => {
    if (!folderFiles || folderFiles.paths.length === 0) return null;
    // Extract folder name from first path
    const firstPath = folderFiles.paths[0];
    return firstPath.split("/")[0];
  };

  const isValid =
    uploadType === "file"
      ? files && files.length > 0
      : uploadType === "folder"
      ? folderFiles && folderFiles.files.length > 0
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
            {onUploadFolder && (
              <Button
                type="button"
                variant={uploadType === "folder" ? "default" : "outline"}
                onClick={() => setUploadType("folder")}
                className="flex-1"
                size="sm"
              >
                <FolderUp className="h-4 w-4 mr-2" />
                Folder
              </Button>
            )}
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
          ) : uploadType === "folder" ? (
            <div className="space-y-2">
              <Label>Select folder</Label>
              <Input
                ref={folderInputRef}
                type="file"
                // @ts-ignore - webkitdirectory is not in React types but works in browsers
                webkitdirectory=""
                // @ts-ignore
                directory=""
                multiple
                onChange={handleFolderSelect}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Select a folder to upload all its contents
              </p>
              {folderFiles && folderFiles.files.length > 0 && (
                <p className="text-xs text-primary font-medium">
                  Folder "{getFolderName()}" with {folderFiles.files.length} file(s) selected
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
            {uploadType === "file" ? "Upload" : uploadType === "folder" ? "Upload Folder" : "Add Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
