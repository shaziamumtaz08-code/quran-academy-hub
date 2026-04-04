import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (content: string, attachmentUrl?: string) => void;
  sending: boolean;
  replyTo: any | null;
  onCancelReply: () => void;
}

export function ChatInput({ onSend, sending, replyTo, onCancelReply }: ChatInputProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim() && !attachmentUrl) return;
    onSend(text.trim(), attachmentUrl || undefined);
    setText('');
    setAttachmentUrl(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `chat/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      setAttachmentUrl(urlData.publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-border bg-card shrink-0">
      {replyTo && (
        <div className="px-3 pt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate flex-1">Replying to <strong>{replyTo.senderName}</strong>: {replyTo.content?.slice(0, 60)}</span>
          <button onClick={onCancelReply}><X className="h-3 w-3" /></button>
        </div>
      )}
      {attachmentUrl && (
        <div className="px-3 pt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          <span className="truncate flex-1">File attached</span>
          <button onClick={() => setAttachmentUrl(null)}><X className="h-3 w-3" /></button>
        </div>
      )}
      <div className="p-2 flex gap-2 items-center">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          className="text-sm h-9"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" disabled={(!text.trim() && !attachmentUrl) || sending} onClick={handleSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
