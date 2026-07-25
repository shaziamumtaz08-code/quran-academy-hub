import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Loader2, FileText, Image, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSignedUrl, resolveFileUrl } from '@/lib/signedUrl';

interface FileUploadFieldProps {
  label?: string;
  bucket: string;
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  disabled?: boolean;
  hint?: string;
  onUploadStateChange?: (uploading: boolean) => void;
  /** Optional folder prefix. If omitted, buckets with per-user RLS auto-derive `proofs/<uid>/`. */
  pathPrefix?: string;
}

export function FileUploadField({
  label = 'Attachment',
  bucket,
  value,
  onChange,
  accept = 'image/*,application/pdf',
  disabled = false,
  hint = 'JPEG, PNG or PDF',
  onUploadStateChange,
  pathPrefix,
}: FileUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [showLinkFallback, setShowLinkFallback] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 20MB allowed', variant: 'destructive' });
      return;
    }

    setUploading(true);
    onUploadStateChange?.(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(urlData.publicUrl);
      toast({ title: 'Uploaded successfully' });
    } catch (err: any) {
      const msg: string = err?.message || '';
      // Storage service schema mismatch — surface the paste-link fallback so users aren't blocked.
      if (/schema is invalid or incompatible|Bucket not found/i.test(msg)) {
        setShowLinkFallback(true);
        toast({
          title: 'Uploads temporarily unavailable',
          description: 'Paste a link to the proof (Drive, Dropbox, WhatsApp export, etc.) as a workaround.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSaveLink = () => {
    const url = linkInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Invalid link', description: 'Enter a full URL starting with http(s)://', variant: 'destructive' });
      return;
    }
    onChange(url);
    setLinkInput('');
    toast({ title: 'Link saved' });
  };

  const isImage = value && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value);
  const isPdf = value && /\.pdf(\?|$)/i.test(value);
  const viewHref = useSignedUrl(value || null);

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
      {!value && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={() => setShowLinkFallback((v) => !v)}
          >
            {showLinkFallback ? 'Hide link option' : 'Or paste a link instead'}
          </button>
        </div>
      )}
      {showLinkFallback && !value && (
        <div className="flex gap-2 items-center">
          <Input
            type="url"
            placeholder="https://drive.google.com/…"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="text-xs h-8"
          />
          <Button type="button" size="sm" className="h-8" onClick={handleSaveLink} disabled={!linkInput.trim()}>
            Save
          </Button>
        </div>
      )}
      {hint && !value && <p className="text-[9px] text-muted-foreground">{hint}</p>}
      {value && (
        <div className="flex items-center gap-2 mt-1">
          {isImage && <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {isPdf && <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <a
            href={viewHref || value}
            target="_blank"
            rel="noreferrer"
            onClick={async (e) => {
              // Always resolve a fresh URL on click. The stored URL may be a
              // stale /object/public/... path for a now-private bucket, which
              // 404s with "Bucket not found".
              e.preventDefault();
              const fresh = await resolveFileUrl(value);
              if (fresh) window.open(fresh, '_blank', 'noopener,noreferrer');
            }}
            className="text-xs text-primary hover:underline truncate max-w-[200px] flex items-center gap-1"
          >
            View Attachment <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      )}
    </div>
  );
}

/** Inline preview for viewing attachments in tables/sheets */
export function AttachmentPreview({ url, className }: { url: string | null; className?: string }) {
  const href = useSignedUrl(url);
  if (!url) return null;
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  return (
    <a
      href={href || url}
      target="_blank"
      rel="noreferrer"
      onClick={async (e) => {
        e.preventDefault();
        const fresh = await resolveFileUrl(url);
        if (fresh) window.open(fresh, '_blank', 'noopener,noreferrer');
      }}
      className={`inline-flex items-center gap-1 text-xs text-primary hover:underline ${className || ''}`}
    >
      {isImage ? <Image className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
      View
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
