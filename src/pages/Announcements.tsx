import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Megaphone, Image as ImageIcon, Mic, Video, FileText, Pin, Trash2, Upload, Loader2, Users } from 'lucide-react';

type MediaType = 'text' | 'image' | 'audio' | 'video';

const MEDIA_TYPES: { value: MediaType; label: string; icon: React.ElementType; accept: string }[] = [
  { value: 'text', label: 'Text', icon: FileText, accept: '' },
  { value: 'image', label: 'Image', icon: ImageIcon, accept: 'image/*' },
  { value: 'audio', label: 'Audio', icon: Mic, accept: 'audio/*' },
  { value: 'video', label: 'Video', icon: Video, accept: 'video/*' },
];

const AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' },
  { value: 'admin', label: 'Admins' },
];

interface AnnouncementRow {
  id: string;
  title: string;
  body: string | null;
  media_type: MediaType;
  media_url: string | null;
  audiences: string[];
  is_pinned: boolean;
  published_at: string;
  created_by: string;
  authorName?: string;
}

function MediaPlayer({ path, type }: { path: string; type: MediaType }) {
  const { data: url } = useQuery({
    queryKey: ['announcement-media', path],
    queryFn: async () => {
      const { data } = await supabase.storage.from('announcements').createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
    staleTime: 50 * 60 * 1000,
  });
  if (!url) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (type === 'image') return <img src={url} alt="Announcement attachment" loading="lazy" className="max-h-80 w-full rounded-xl object-cover" />;
  if (type === 'audio') return <audio controls src={url} className="w-full" />;
  if (type === 'video') return <video controls src={url} className="max-h-96 w-full rounded-xl bg-black" />;
  return null;
}

function Composer({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('text');
  const [file, setFile] = useState<File | null>(null);
  const [audiences, setAudiences] = useState<string[]>(['all']);
  const [pinned, setPinned] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const toggleAudience = (value: string) => {
    setAudiences((prev) => {
      if (value === 'all') return ['all'];
      const next = prev.filter((item) => item !== 'all');
      return next.includes(value) ? (next.filter((item) => item !== value).length ? next.filter((item) => item !== value) : ['all']) : [...next, value];
    });
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');
      if (mediaType !== 'text' && !file) throw new Error('Please attach a file for this announcement type');
      let mediaPath: string | null = null;
      if (file && user?.id) {
        const ext = file.name.split('.').pop() || 'bin';
        mediaPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('announcements').upload(mediaPath, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase.from('announcements' as any).insert({
        title: title.trim(),
        body: body.trim() || null,
        media_type: mediaType,
        media_url: mediaPath,
        audiences,
        is_pinned: pinned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Announcement published — notifications sent');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setTitle(''); setBody(''); setFile(null); setMediaType('text'); setAudiences(['all']); setPinned(false);
      onDone();
    },
    onError: (error: any) => toast.error(error.message || 'Could not publish announcement'),
  });

  const active = MEDIA_TYPES.find((item) => item.value === mediaType)!;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2">
        {MEDIA_TYPES.map((item) => {
          const Icon = item.icon;
          const isActive = item.value === mediaType;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => { setMediaType(item.value); setFile(null); }}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition-colors ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor="ann-title">Title</Label>
        <Input id="ann-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Eid holidays schedule" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea id="ann-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the announcement details…" />
      </div>

      {mediaType !== 'text' && (
        <div className="space-y-2">
          <Label>{active.label} file</Label>
          <input ref={fileRef} type="file" accept={active.accept} className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted"
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : `Choose ${active.label.toLowerCase()} to attach`}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Audience</Label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => toggleAudience(item.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${audiences.includes(item.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-3">
        <div className="flex items-center gap-2 text-sm"><Pin className="h-4 w-4" /> Pin to top</div>
        <Switch checked={pinned} onCheckedChange={setPinned} />
      </div>

      <Button className="w-full" onClick={() => mutate()} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
        Publish announcement
      </Button>
    </div>
  );
}

export default function Announcements() {
  const { user, activeRole } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const canPost = useMemo(
    () => activeRole === 'teacher' || activeRole === 'admin' || activeRole === 'super_admin' || !!activeRole?.startsWith('admin_'),
    [activeRole],
  );

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements' as any)
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data || []) as unknown as AnnouncementRow[];
      const authorIds = [...new Set(rows.map((row) => row.created_by))];
      if (!authorIds.length) return rows;
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      const map = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.full_name]));
      return rows.map((row) => ({ ...row, authorName: map[row.created_by] || 'Academy' }));
    },
  });

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('announcements' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Announcement removed');
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
  }, [queryClient]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary/15 to-primary/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><Megaphone className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold">Announcements</h2>
            <p className="text-sm text-muted-foreground">Academy-wide updates in text, image, audio, or video.</p>
          </div>
        </div>
        {canPost && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Megaphone className="mr-2 h-4 w-4" /> New announcement</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Create announcement</DialogTitle></DialogHeader>
              <Composer onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm text-muted-foreground">{canPost ? 'Publish the first update for your academy.' : 'Updates from the academy will appear here.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <Card key={item.id} className={item.is_pinned ? 'border-primary/40' : undefined}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {item.is_pinned && <Pin className="h-4 w-4 text-primary" />}
                    <span className="truncate">{item.title}</span>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.authorName} · {new Date(item.published_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.audiences.map((audience) => (
                    <Badge key={audience} variant="secondary" className="capitalize">{audience}</Badge>
                  ))}
                  {(item.created_by === user?.id || activeRole === 'admin' || activeRole === 'super_admin') && (
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Delete announcement">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.body && <p className="whitespace-pre-wrap text-sm">{item.body}</p>}
                {item.media_url && item.media_type !== 'text' && <MediaPlayer path={item.media_url} type={item.media_type} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
