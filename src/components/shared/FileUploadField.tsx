import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, FileText, Image, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadFieldProps {
  label?: string;
  bucket: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  disabled?: boolean;
  hint?: string;
}

export function FileUploadField({
  label = 'Attachment',
  bucket,
  value,
  onChange,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
  disabled = false,
  hint = 'JPEG, PNG or PDF',
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB allowed', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast({ title: 'Uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const isImage = value && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value);
  const isPdf = value && /\.pdf(\?|$)/i.test(value);

  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2 items-center">
        <Input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleUpload}
          disabled={disabled || uploading}
          className="text-xs h-8"
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
      </div>
      {hint && !value && <p className="text-[9px] text-muted-foreground">{hint}</p>}
      {value && (
        <div className="flex items-center gap-2 mt-1">
          {isImage && <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {isPdf && <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px] flex items-center gap-1">
            View Attachment <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}
    </div>
  );
}

/** Inline preview for viewing attachments in tables/sheets */
export function AttachmentPreview({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null;
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs text-primary hover:underline ${className || ''}`}>
      {isImage ? <Image className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      View
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
