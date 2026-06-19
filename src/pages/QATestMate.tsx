import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, PlayCircle, CheckCircle2, XCircle, AlertCircle, RotateCcw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

interface QaRun {
  id: string;
  kind: string;
  status: string;
  summary: string | null;
  passed_count: number;
  failed_count: number;
  total_count: number;
  started_at: string;
  finished_at: string | null;
  trigger_source: string;
}

interface PersistedMessage {
  id: string;
  role: string;
  content: string;
  parts: any;
  created_at: string;
}

function statusTone(status: string) {
  if (status === "passed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-700 border-red-200";
  if (status === "running") return "bg-sky-100 text-sky-700 border-sky-200";
  if (status === "error") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-600" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-sky-600 animate-spin" />;
  return <AlertCircle className="h-4 w-4 text-amber-600" />;
}

export default function QATestMate() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get bearer token for the chat transport
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load persisted single shared conversation
  const { data: history } = useQuery({
    queryKey: ["qa-chat-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_chat_messages" as any)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PersistedMessage[];
    },
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!history) return [];
    return history.map((m) => ({
      id: m.id,
      role: (m.role as UIMessage["role"]) ?? "assistant",
      parts: m.parts ?? [{ type: "text", text: m.content }],
    }));
  }, [history]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${SUPABASE_URL}/functions/v1/qa-chat`,
        headers: () => ({
          Authorization: `Bearer ${authToken ?? PUBLISHABLE_KEY}`,
          apikey: PUBLISHABLE_KEY,
        }),
      }),
    [authToken]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: "qa-testmate-singleton",
    transport,
    messages: initialMessages,
    onError: (err) => {
      console.error("qa-chat error", err);
      toast.error(err.message || "Chat failed");
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["qa-runs"] });
    },
  });

  // Hydrate messages once history loads
  useEffect(() => {
    if (history && messages.length === 0 && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // Recent runs panel
  const { data: runs } = useQuery({
    queryKey: ["qa-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_runs" as any)
        .select("*")
        .order("started_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as QaRun[];
    },
    refetchInterval: 10000,
  });

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Keep composer focused
  useEffect(() => {
    textareaRef.current?.focus();
  }, [status]);

  const busy = status === "submitted" || status === "streaming";

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !authToken) return;
    setInput("");
    await sendMessage({ text });
  }

  async function handleRunNow() {
    if (!authToken) return;
    toast.info("Starting QA run…");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-run-checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        apikey: PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ kind: "full", trigger_source: "manual" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error || "Run failed");
      return;
    }
    toast.success(body.summary || "Run finished");
    qc.invalidateQueries({ queryKey: ["qa-runs"] });
  }

  async function handleClearChat() {
    if (!confirm("Clear the QA chat history?")) return;
    const { error } = await supabase.from("qa_chat_messages" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["qa-chat-history"] });
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QA Test-Mate</h1>
            <p className="text-sm text-muted-foreground">
              v1 scope · Demo Link Flow · RLS Isolation · Super Admin only
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClearChat}>
              <RotateCcw className="h-4 w-4 mr-1" /> Clear chat
            </Button>
            <Button size="sm" onClick={handleRunNow}>
              <PlayCircle className="h-4 w-4 mr-1" /> Run checks now
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chat */}
          <Card className="lg:col-span-2 flex flex-col h-[calc(100vh-220px)] min-h-[520px]">
            <div className="border-b px-4 py-3">
              <div className="font-semibold text-sm">Conversation</div>
              <div className="text-xs text-muted-foreground">Shared across Super Admins.</div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground text-center pt-12 space-y-2">
                  <p>👋 Ask me to verify the demo link flow or RLS isolation.</p>
                  <p className="text-xs">Try: <em>"Run all checks and tell me what failed"</em> or <em>"Did anything break overnight?"</em></p>
                </div>
              )}
              {messages.map((m) => {
                const text = (m.parts ?? [])
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join("\n");
                const toolCalls = (m.parts ?? []).filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-"));
                return (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {toolCalls.length > 0 && (
                        <div className="text-[11px] opacity-70 mb-1 flex flex-wrap gap-1">
                          {toolCalls.map((t: any, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              🔧 {String(t.type).replace("tool-", "")} · {t.state ?? "done"}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {text && (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {status === "submitted" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                  </div>
                </div>
              )}
              {error && (
                <div className="text-xs text-red-600 px-2">Error: {error.message}</div>
              )}
            </div>
            <div className="border-t p-3 flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask the QA test-mate…"
                className="min-h-[44px] max-h-32 resize-none"
                disabled={busy || !authToken}
              />
              <Button onClick={handleSend} disabled={busy || !input.trim() || !authToken}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          {/* Recent runs */}
          <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[520px]">
            <div className="border-b px-4 py-3">
              <div className="font-semibold text-sm">Recent runs</div>
              <div className="text-xs text-muted-foreground">Nightly auto-checks + manual runs</div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {(runs ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground p-4 text-center">No runs yet.</div>
                )}
                {(runs ?? []).map((r) => (
                  <details key={r.id} className="rounded-lg border bg-card group">
                    <summary className="px-3 py-2 flex items-center gap-2 cursor-pointer list-none">
                      <StatusIcon status={r.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{r.kind} · {r.trigger_source}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                        </div>
                      </div>
                      <Badge className={`text-[10px] border ${statusTone(r.status)}`} variant="outline">
                        {r.passed_count}/{r.total_count}
                      </Badge>
                    </summary>
                    <div className="px-3 pb-3 text-[11px] text-muted-foreground space-y-1">
                      <div>{r.summary}</div>
                      <div className="text-[10px]">
                        {r.finished_at ? format(new Date(r.finished_at), "PP p") : "—"}
                      </div>
                      <RunDetailsLoader runId={r.id} />
                    </div>
                  </details>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function RunDetailsLoader({ runId }: { runId: string }) {
  const { data } = useQuery({
    queryKey: ["qa-run", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_runs" as any)
        .select("results")
        .eq("id", runId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const results = (data?.results ?? []) as any[];
  if (!results.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {results.map((r) => (
        <li key={r.id} className="flex items-start gap-1.5">
          <StatusIcon status={r.status} />
          <div className="flex-1">
            <div className="font-medium text-foreground">{r.name}</div>
            {r.details && <div className="text-[10px] opacity-80">{r.details}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
