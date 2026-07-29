import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MessageSquare, AlertTriangle, Ban, Unlock, ChevronDown, ChevronUp } from 'lucide-react';

interface DemoChatAdminPanelProps {
  sessionId: string;
  chatEnabled: boolean;
  chatDisabledReason: string | null;
  onChanged?: () => void;
}

export function DemoChatAdminPanel({ sessionId, chatEnabled, chatDisabledReason, onChanged }: DemoChatAdminPanelProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState('');

  const { data: messages = [] } = useQuery({
    queryKey: ['demo-messages', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('demo_messages')
        .select('id, sender_role, sender_label, body, raw_body, is_flagged, flag_reasons, created_at')
        .eq('demo_session_id', sessionId)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: expanded,
  });

  const { data: counts } = useQuery({
    queryKey: ['demo-messages-count', sessionId],
    queryFn: async () => {
      const [{ count: total }, { count: flagged }] = await Promise.all([
        supabase.from('demo_messages').select('id', { count: 'exact', head: true }).eq('demo_session_id', sessionId),
        supabase.from('demo_messages').select('id', { count: 'exact', head: true }).eq('demo_session_id', sessionId).eq('is_flagged', true),
      ]);
      return { total: total || 0, flagged: flagged || 0 };
    },
  });

  const toggleChat = useMutation({
    mutationFn: async (enable: boolean) => {
      const { error } = await supabase
        .from('demo_sessions')
        .update({
          chat_enabled: enable,
          chat_disabled_reason: enable ? null : (reason.trim() || 'Chat closed by the academy.'),
        } as never)
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: (_d, enable) => {
      toast({ title: enable ? 'Chat re-opened' : 'Chat disabled' });
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['demo-sessions'] });
      onChanged?.();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="rounded-lg border border-dashed bg-background/60">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          Pre-demo chat
          <Badge variant="secondary" className="text-[10px]">{counts?.total ?? 0}</Badge>
          {(counts?.flagged ?? 0) > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <AlertTriangle className="h-2.5 w-2.5" /> {counts?.flagged}
            </Badge>
          )}
          {!chatEnabled && <Badge variant="outline" className="text-[10px]">Disabled</Badge>}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {messages.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2 text-center">No messages exchanged yet.</p>
            ) : (
              messages.map((m: any) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-md p-2 text-[11px] border',
                    m.is_flagged ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' : 'bg-muted/40 border-transparent'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {m.sender_label}
                      <span className="text-muted-foreground font-normal capitalize"> · {m.sender_role}</span>
                    </span>
                    <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                  {m.is_flagged && (
                    <div className="mt-1 space-y-1">
                      <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Flagged: {(m.flag_reasons || []).join(', ')}
                      </p>
                      {m.raw_body && m.raw_body !== m.body && (
                        <p className="text-[10px] text-muted-foreground">Original: {m.raw_body}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {chatEnabled ? (
            <div className="flex gap-1.5">
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-7 text-[11px]"
              />
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-[10px] shrink-0"
                disabled={toggleChat.isPending}
                onClick={() => toggleChat.mutate(false)}
              >
                <Ban className="h-3 w-3 mr-1" /> Disable chat
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">{chatDisabledReason || 'Chat disabled.'}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] shrink-0"
                disabled={toggleChat.isPending}
                onClick={() => toggleChat.mutate(true)}
              >
                <Unlock className="h-3 w-3 mr-1" /> Re-open
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
