import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquare, Send, ShieldAlert, Lock } from "lucide-react";

interface ChatMessage {
  id: string;
  sender_role: "teacher" | "student" | "admin";
  sender_label: string;
  body: string;
  created_at: string;
  mine: boolean;
}

interface ChatPayload {
  audience: "teacher" | "student";
  open: boolean;
  disabled_reason: string | null;
  messages: ChatMessage[];
}

const TEACHER_QUICK_REPLIES = [
  "Assalamu alaikum — looking forward to our demo class, in sha Allah.",
  "Please join 5 minutes early so we can check the audio.",
  "Which Surah or lesson is the student currently on?",
  "Please keep a Mushaf/Qaida and a notebook handy.",
];

const STUDENT_QUICK_REPLIES = [
  "Assalamu alaikum, we are ready for the demo class.",
  "Can we confirm the class time again please?",
  "The student is a complete beginner.",
];

function timeLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function DemoChatPanel({ token, otherPartyName }: { token: string; otherPartyName: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["demo-chat", token],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("get_demo_chat", { _token: token });
      if (error) throw error;
      return (res as unknown as ChatPayload) ?? null;
    },
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });

  const messages = data?.messages ?? [];
  const isOpen = data?.open ?? false;
  const audience = data?.audience ?? "student";
  const quickReplies = audience === "teacher" ? TEACHER_QUICK_REPLIES : STUDENT_QUICK_REPLIES;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { data: res, error } = await supabase.rpc("send_demo_chat", { _token: token, _body: body });
      if (error) throw error;
      const payload = res as unknown as { ok: boolean; error?: string };
      if (!payload?.ok) throw new Error(payload?.error || "Could not send message");
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["demo-chat", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(body?: string) {
    const value = (body ?? text).trim();
    if (!value) return;
    send.mutate(value);
  }

  if (isLoading) {
    return (
      <Card className="p-5 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#0f2044]" />
          Message {otherPartyName || (audience === "teacher" ? "the student" : "your teacher")}
        </h3>
        {!isOpen && (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Lock className="h-3 w-3" /> Read only
          </Badge>
        )}
      </div>

      <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex gap-2 text-[11px] text-amber-900">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>
          Please do <strong>not</strong> share phone numbers, WhatsApp, email addresses, links, or fee and payment
          details here. This conversation is monitored by Al Quran Time Academy for everyone's safety.
        </p>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-4 space-y-2.5 bg-white">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No messages yet. Send a short introduction before the class.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2",
                  m.sender_role === "admin"
                    ? "bg-slate-100 border border-slate-200"
                    : m.mine
                      ? "bg-[#0f2044] text-white"
                      : "bg-slate-100"
                )}
              >
                {!m.mine && <p className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender_label}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("text-[10px] mt-1", m.mine ? "text-white/60" : "text-muted-foreground")}>
                  {timeLabel(m.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {isOpen ? (
        <div className="p-3 border-t space-y-2 bg-white">
          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submit(q)}
                disabled={send.isPending}
                className="text-[10px] px-2 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {q.length > 42 ? `${q.slice(0, 42)}…` : q}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              rows={2}
              placeholder="Type your message..."
              className="resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              onClick={() => submit()}
              disabled={!text.trim() || send.isPending}
              className="bg-[#0f2044] hover:bg-[#1a2d54] shrink-0"
              size="icon"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t bg-slate-50 text-xs text-muted-foreground text-center">
          {data.disabled_reason || "This conversation has been closed by the academy. History remains visible."}
        </div>
      )}
    </Card>
  );
}
