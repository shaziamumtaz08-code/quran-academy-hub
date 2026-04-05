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
    <div className={`space-y-2 ${className || ''}`}>
      <p className="text-xs font-medium text-sky-200 flex items-center gap-1.5">
        <Mic className="h-3.5 w-3.5" />
        Voice Note (optional)
      </p>

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
              className="gap-1.5 border-sky-400/30 text-sky-200 hover:bg-sky-900/30 bg-transparent"
            >
              <Mic className="h-3.5 w-3.5" />
              Record
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <Button type="button" size="icon" variant="ghost" onClick={togglePlay} className="h-8 w-8 text-sky-200 hover:bg-sky-900/40">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full w-full" />
            </div>
            <p className="text-[10px] text-sky-300/70 mt-0.5">{formatTime(duration)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={uploadVoiceNote}
            disabled={isUploading}
            className="gap-1 text-xs border-emerald-400/30 text-emerald-300 hover:bg-emerald-900/30 bg-transparent"
          >
            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : '✓'} Save
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={removeRecording} className="h-8 w-8 text-red-300 hover:bg-red-900/30">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
