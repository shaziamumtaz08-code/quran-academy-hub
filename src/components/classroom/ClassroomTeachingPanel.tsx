import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Book, ClipboardList, MessageCircle, Check, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type PanelTab = 'plan' | 'attendance' | 'chat';
type AttendanceStatus = 'present' | 'late' | 'absent' | null;

interface Props {
  courseId: string;
  classId?: string;
  sessionId: string;
  participants: { id: string; name: string }[];
}

export default function ClassroomTeachingPanel({ courseId, classId, sessionId, participants }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<PanelTab>('plan');
  const [collapsed, setCollapsed] = useState(false);

  // Session plan state
  const [activities, setActivities] = useState<any[]>([]);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
  const [planLoading, setPlanLoading] = useState(false);

  // Attendance state
  const [attMap, setAttMap] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  // Chat state
  const [chatGroupId, setChatGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch session plan
  useEffect(() => {
    if (!courseId) return;
    setPlanLoading(true);
    (async () => {
      // Get syllabus for this course
      const { data: syl } = await supabase
        .from('syllabi')
        .select('id')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!syl) { setPlanLoading(false); return; }

      // Get latest session plan
      const { data: plan } = await supabase
        .from('session_plans')
        .select('*')
        .eq('syllabus_id', syl.id)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (plan?.activities) {
        const acts = Array.isArray(plan.activities) ? plan.activities : [];
        setActivities(acts);
      }
      setPlanLoading(false);
    })();
  }, [courseId]);

  // Fetch chat group
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const { data } = await supabase
        .from('chat_groups')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_dm', false)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data) setChatGroupId(data.id);
    })();
  }, [courseId]);

  // Fetch chat messages + realtime
  useEffect(() => {
    if (!chatGroupId) return;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles!chat_messages_sender_id_fkey(full_name)')
        .eq('group_id', chatGroupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    })();

    const channel = supabase
      .channel(`classroom-chat-${chatGroupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${chatGroupId}` }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => [...prev, newMsg]);
        if (tab !== 'chat') setUnread(u => u + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatGroupId]);

  // Auto-scroll chat
  useEffect(() => {
    if (tab === 'chat') {
      setUnread(0);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages.length, tab]);

  const toggleDone = (i: number) => {
    setDoneSet(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  const saveAttendance = async () => {
    const entries = Object.entries(attMap).filter(([, v]) => v);
    if (!entries.length) { toast.error('No attendance marked'); return; }
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const rows = entries.map(([studentId, status]) => ({
      student_id: studentId,
      teacher_id: user?.id || '',
      course_id: courseId,
      class_date: today,
      class_time: new Date().toTimeString().slice(0, 5),
      status: status as string,
      duration_minutes: 30,
    }));

    const { error } = await supabase.from('attendance').insert(rows);
    if (error) { toast.error('Failed to save attendance'); }
    else { toast.success(`Attendance saved for ${entries.length} students`); }
    setSaving(false);
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !chatGroupId || !user) return;
    const { error } = await supabase.from('chat_messages').insert({
      group_id: chatGroupId,
      sender_id: user.id,
      content: msgInput.trim(),
    });
    if (!error) setMsgInput('');
  };

  const tabs: { key: PanelTab; icon: React.ElementType; label: string; badge?: number }[] = [
    { key: 'plan', icon: Book, label: 'Session Plan' },
    { key: 'attendance', icon: ClipboardList, label: 'Attendance' },
    { key: 'chat', icon: MessageCircle, label: 'Chat', badge: unread },
  ];

  const doneCount = doneSet.size;
  const totalActs = activities.length;

  if (collapsed) {
    return (
      <div className="border-t border-white/10 shrink-0">
        <button onClick={() => setCollapsed(false)} className="w-full h-8 flex items-center justify-center text-white/50 hover:text-white text-[10px] transition-colors">
          ▲ Teaching Panel
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 flex flex-col shrink-0" style={{ height: 260, background: '#0f172a' }}>
      {/* Tab strip */}
      <div className="flex items-center border-b border-white/10 shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 h-8 flex items-center justify-center gap-1 text-[10px] font-medium transition-colors relative ${
                tab === t.key ? 'text-[#3b82f6] border-b-2 border-[#3b82f6]' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Icon className="h-3 w-3" />
              {t.label}
              {t.badge && t.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[8px] rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
        <button onClick={() => setCollapsed(true)} className="px-2 text-white/30 hover:text-white/60 text-[10px]">▼</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'plan' && (
          <div className="h-full flex flex-col">
            {/* Progress */}
            {totalActs > 0 && (
              <div className="px-3 pt-2 pb-1 shrink-0">
                <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
                  <span>Progress</span>
                  <span>{doneCount}/{totalActs}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full transition-all" style={{ width: `${totalActs ? (doneCount / totalActs) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <ScrollArea className="flex-1 px-3">
              {planLoading ? (
                <p className="text-white/40 text-[11px] text-center py-4">Loading plan…</p>
              ) : activities.length === 0 ? (
                <p className="text-white/40 text-[11px] text-center py-4">No session plan found for this course</p>
              ) : (
                <div className="space-y-1 py-1">
                  {activities.map((act: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${doneSet.has(i) ? 'bg-green-500/10' : 'hover:bg-white/5'}`}>
                      <button onClick={() => toggleDone(i)} className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${doneSet.has(i) ? 'bg-green-500 border-green-500 text-white' : 'border-white/20 text-transparent'}`}>
                        <Check className="h-2.5 w-2.5" />
                      </button>
                      <span className={`flex-1 text-white/80 ${doneSet.has(i) ? 'line-through opacity-50' : ''}`}>
                        {act.title || act.name || `Activity ${i + 1}`}
                      </span>
                      {act.type && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">{act.type}</span>}
                      {act.duration && <span className="text-[9px] text-white/30">{act.duration}m</span>}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {tab === 'attendance' && (
          <div className="h-full flex flex-col">
            <ScrollArea className="flex-1 px-3">
              {participants.length === 0 ? (
                <p className="text-white/40 text-[11px] text-center py-4">No students enrolled</p>
              ) : (
                <div className="space-y-1 py-2">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      <span className="text-white/80 text-[11px] truncate max-w-[100px]">{p.name}</span>
                      <div className="flex gap-1">
                        {(['present', 'late', 'absent'] as AttendanceStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => setAttMap(prev => ({ ...prev, [p.id]: prev[p.id] === s ? null : s }))}
                            className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                              attMap[p.id] === s
                                ? s === 'present' ? 'bg-green-500 text-white' : s === 'late' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                                : 'text-white/40 hover:text-white/60 bg-white/5'
                            }`}
                          >
                            {s === 'present' ? 'P' : s === 'late' ? 'L' : 'A'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="px-3 py-2 border-t border-white/10 shrink-0">
              <button
                onClick={saveAttendance}
                disabled={saving}
                className="w-full h-7 rounded text-[11px] font-medium bg-[#3b82f6] text-white hover:bg-[#3b82f6]/80 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
        )}

        {tab === 'chat' && (
          <div className="h-full flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {messages.length === 0 ? (
                <p className="text-white/40 text-[11px] text-center py-4">No messages yet</p>
              ) : (
                messages.map((m: any) => (
                  <div key={m.id} className={`text-[11px] ${m.sender_id === user?.id ? 'text-right' : ''}`}>
                    <span className="text-white/40 text-[9px]">{m.sender?.full_name || 'Unknown'}</span>
                    <div className={`mt-0.5 inline-block px-2 py-1 rounded-lg max-w-[200px] text-left ${
                      m.sender_id === user?.id ? 'bg-[#3b82f6] text-white ml-auto' : 'bg-white/10 text-white/80'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-3 py-2 border-t border-white/10 shrink-0 flex gap-2">
              <input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 h-7 bg-white/10 text-white text-[11px] rounded px-2 outline-none placeholder:text-white/30"
              />
              <button onClick={sendMessage} className="text-[#3b82f6] hover:text-white transition-colors">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
