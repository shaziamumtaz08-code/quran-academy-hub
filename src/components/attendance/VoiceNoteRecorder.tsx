import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Play, Pause, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceNoteRecorderProps {
  onUploadComplete: (url: string | null) => void;
  uploadPath?: string;
  className?: string;
}

export function VoiceNoteRecorder({ onUploadComplete, uploadPath, className }: VoiceNoteRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch {
      toast({ title: 'Microphone access denied', description: 'Please allow microphone access to record voice notes.', variant: 'destructive' });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const uploadVoiceNote = useCallback(async () => {
    if (!blobRef.current) return;
    setIsUploading(true);
    try {
      const fileName = `${uploadPath || 'note'}-${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, blobRef.current, { contentType: 'audio/webm' });

      if (error) throw error;

      const { data: publicData } = supabase.storage.from('voice-notes').getPublicUrl(data.path);
      onUploadComplete(publicData.publicUrl);
      toast({ title: 'Voice note saved' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [uploadPath, onUploadComplete, toast]);

  const removeRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setDuration(0);
    onUploadComplete(null);
  }, [audioUrl, onUploadComplete]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audioUrl]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={`space-y-3 rounded-lg border border-border bg-muted p-3 ${className || ''}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-md bg-background p-1.5">
          <Mic className="h-4 w-4 text-foreground" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Voice note <span className="font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground">Record a short pronunciation, practice, or parent note.</p>
        </div>
      </div>


      {!audioUrl ? (
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                className="gap-1.5"
              >
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-mono text-destructive-foreground">{formatTime(duration)}</span>
              </div>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startRecording}
                className="gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              Record
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-background p-2">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <Button type="button" size="icon" variant="ghost" onClick={togglePlay} className="h-8 w-8">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTime(duration)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={uploadVoiceNote}
            disabled={isUploading}
            className="gap-1 text-xs"
          >
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'} Save
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={removeRecording} className="h-8 w-8 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
