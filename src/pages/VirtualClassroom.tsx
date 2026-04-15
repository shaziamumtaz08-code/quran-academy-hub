import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, Hand, Smile,
  Users, Maximize, LogOut, MessageCircle, X, CameraOff,
} from 'lucide-react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏'];

export default function VirtualClassroom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const { toast } = useToast();

  // Local toggles (scaffold only)
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showEmojis, setShowEmojis] = useState(false);
  const [raisedHands, setRaisedHands] = useState<{ id: string; name: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const isTeacher = activeRole === 'teacher' || activeRole === 'admin' || activeRole === 'super_admin';

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Fetch session info
  const { data: session } = useQuery({
    queryKey: ['virtual-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_sessions' as any)
        .select('*, courses(name), course_classes(name)')
        .eq('id', sessionId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!sessionId,
  });

  // Fetch class students
  const { data: participants = [] } = useQuery({
    queryKey: ['classroom-participants', session?.class_id],
    queryFn: async () => {
      if (!session?.class_id) return [];
      const { data } = await supabase
        .from('course_class_students')
        .select('student_id, student:profiles!course_class_students_student_id_fkey(id, full_name)')
        .eq('class_id', session.class_id)
        .eq('status', 'active');
      return (data || []).map((d: any) => ({
        id: d.student_id,
        name: d.student?.full_name || 'Student',
      }));
    },
    enabled: !!session?.class_id,
  });

  const courseName = session?.courses?.name || 'Virtual Classroom';
  const className = session?.course_classes?.name || '';

  // Placeholder tiles — show first 6 participants or grey placeholders
  const tiles = participants.length > 0
    ? participants.slice(0, 6)
    : Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Participant ${i + 1}` }));

  const handleRaiseHand = () => {
    if (!user) return;
    const already = raisedHands.find(h => h.id === user.id);
    if (already) {
      setRaisedHands(prev => prev.filter(h => h.id !== user.id));
    } else {
      setRaisedHands(prev => [...prev, { id: user.id, name: user.email?.split('@')[0] || 'You' }]);
    }
  };

  const lowerHand = (id: string) => {
    setRaisedHands(prev => prev.filter(h => h.id !== id));
  };

  const handleLeave = () => {
    navigate(-1);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(var(--background))] text-foreground overflow-hidden">
      {/* ─── Top Bar ─── */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-sm truncate max-w-[200px] md:max-w-none">{courseName}</h1>
          {className && (
            <Badge variant="secondary" className="text-xs">{className}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground font-mono">{formatDuration(elapsed)}</span>
          <Badge variant="outline" className="gap-1 text-xs">
            <Users className="h-3 w-3" /> {participants.length}
          </Badge>
          <Button variant="destructive" size="sm" onClick={handleLeave}>
            <LogOut className="h-4 w-4 mr-1" /> Leave
          </Button>
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 relative">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3 h-full auto-rows-fr">
            {tiles.map(tile => (
              <div
                key={tile.id}
                className="bg-muted rounded-xl flex flex-col items-center justify-center gap-2 border border-border relative min-h-[120px]"
              >
                <CameraOff className="h-8 w-8 text-muted-foreground/40" />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                  {getInitials(tile.name)}
                </div>
                <span className="text-xs text-muted-foreground absolute bottom-2 left-3 bg-background/80 px-2 py-0.5 rounded">
                  {tile.name}
                </span>
              </div>
            ))}
          </div>

          {/* Raised Hand Queue */}
          {raisedHands.length > 0 && (
            <div className="absolute top-4 right-4 space-y-2 z-10">
              {raisedHands.map(h => (
                <div key={h.id} className="bg-card border border-amber-300 rounded-lg px-3 py-2 flex items-center gap-2 shadow-md text-sm">
                  <span>✋</span>
                  <span className="font-medium">{h.name}</span>
                  {isTeacher && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => lowerHand(h.id)}>
                      Lower
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Emoji reaction overlay */}
          {showEmojis && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-card border rounded-full px-4 py-2 flex gap-2 shadow-lg z-10">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  className="text-2xl hover:scale-125 transition-transform"
                  onClick={() => { toast({ title: `${e} sent!` }); setShowEmojis(false); }}
                >
                  {e}
                </button>
              ))}
              <button className="text-muted-foreground hover:text-foreground ml-1" onClick={() => setShowEmojis(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-[300px] border-l border-border bg-card flex flex-col shrink-0 hidden lg:flex">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">Chat</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowChat(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
              Chat will be connected to the class chat group when LiveKit is integrated.
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Bar ─── */}
      <div className="h-[70px] flex items-center justify-between px-4 border-t border-border bg-card shrink-0">
        {/* Left controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={micOn ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setMicOn(!micOn)}
            title={micOn ? 'Mute' : 'Unmute'}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-destructive" />}
          </Button>
          <Button
            variant={camOn ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setCamOn(!camOn)}
            title={camOn ? 'Camera Off' : 'Camera On'}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-destructive" />}
          </Button>
          <Button
            variant={screenShare ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setScreenShare(!screenShare)}
            title="Screen Share"
          >
            <MonitorUp className="h-5 w-5" />
          </Button>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={raisedHands.some(h => h.id === user?.id) ? 'default' : 'outline'}
            size="sm"
            onClick={handleRaiseHand}
          >
            <Hand className="h-4 w-4 mr-1" /> Raise Hand
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEmojis(!showEmojis)}>
            <Smile className="h-4 w-4 mr-1" /> React
          </Button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setShowParticipants(true)} title="Participants">
            <Users className="h-5 w-5" />
          </Button>
          {!showChat && (
            <Button variant="outline" size="icon" onClick={() => setShowChat(true)} title="Chat" className="hidden lg:flex">
              <MessageCircle className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => document.documentElement.requestFullscreen?.()}
            title="Fullscreen"
          >
            <Maximize className="h-5 w-5" />
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLeave}>
            {isTeacher ? 'End Session' : 'Leave'}
          </Button>
        </div>
      </div>

      {/* ─── Participants Sheet ─── */}
      <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
        <SheetContent side="right" className="w-[320px]">
          <SheetHeader>
            <SheetTitle>Participants ({participants.length + 1})</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-1">
              {/* Teacher / Host */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium flex-1">
                  {isTeacher ? 'You' : 'Teacher'}
                </span>
                <Badge variant="secondary" className="text-[10px]">HOST</Badge>
              </div>

              <Separator className="my-2" />

              {participants.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-xs text-emerald-600">Present</span>
                </div>
              ))}

              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No students joined yet</p>
              )}
            </div>

            {isTeacher && participants.length > 0 && (
              <div className="mt-4">
                <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: 'Mute All', description: 'All participants muted (scaffold)' })}>
                  Mute All
                </Button>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
