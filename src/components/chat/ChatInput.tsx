import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, X, Loader2, Mic, Square } from 'lucide-react';
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
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSend = () => {
    if (!text.trim() && !attachmentUrl) return;
    onSend(text.trim(), attachmentUrl || undefined);
    setText('');
    setAttachmentUrl(null);
  };

  const uploadFile = async (file: File | Blob, ext: string): Promise<string | null> => {
    setUploading(true);
    try {
      const path = `chat/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    const ext = file.name.split('.').pop() || 'bin';
    const url = await uploadFile(file, ext);
    if (url) setAttachmentUrl(url);
    if (fileRef.current) fileRef.current.value = '';
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) {
          toast({ title: 'Recording too short' });
          return;
        }
        const url = await uploadFile(blob, 'webm');
        if (url) {
          onSend('🎤 Voice note', url);
        }
      };

      mediaRecorder.start(250);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  }, [onSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setRecordingTime(0);
    chunksRef.current = [];
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

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

        {recording ? (
          <>
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive" onClick={cancelRecording} title="Cancel">
              <X className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/20">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-medium text-destructive">{formatTime(recordingTime)}</span>
              <span className="text-xs text-muted-foreground">Recording...</span>
            </div>
            <Button size="icon" className="h-9 w-9 shrink-0 bg-destructive hover:bg-destructive/90" onClick={stopRecording} title="Send voice note">
              <Send className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
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
            {text.trim() || attachmentUrl ? (
              <Button size="icon" className="h-9 w-9 shrink-0" disabled={(!text.trim() && !attachmentUrl) || sending} onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={startRecording} title="Record voice note">
                <Mic className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
