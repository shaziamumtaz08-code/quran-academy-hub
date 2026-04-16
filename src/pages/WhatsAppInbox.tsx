import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare, Send, Search, Phone, Check, CheckCheck, Clock,
  XCircle, Forward, ListTodo, ArrowLeft, FileText, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CommThemeProvider, CommThemeToggle, useCommTheme,
  colorFromName, initialsFromName, formatCommTime,
} from "@/components/comm/CommThemeProvider";
import { CreateTicketDialog } from "@/components/hub/CreateTicketDialog";

type WhatsAppContact = {
  id: string;
  phone: string;
  name: string | null;
  profile_id: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_message?: string;
};

type WhatsAppMessage = {
  id: string;
  contact_id: string;
  direction: string;
  message_text: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  delivery_status: string;
  wa_message_id: string | null;
  template_name: string | null;
  is_forwarded: boolean;
  forwarded_to_task_id: string | null;
  created_at: string;
  sent_by: string | null;
};

const deliveryIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3 w-3 opacity-60" />,
  sent: <Check className="h-3 w-3 opacity-60" />,
  delivered: <CheckCheck className="h-3 w-3 opacity-60" />,
  read: <CheckCheck className="h-3 w-3 text-blue-500" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
};

function WhatsAppInner() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { palette } = useCommTheme();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<WhatsAppMessage | null>(null);
  const [forwardTarget, setForwardTarget] = useState<"task" | "group" | "user">("task");
  const [taskFromMsg, setTaskFromMsg] = useState<WhatsAppMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["whatsapp-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts").select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppContact[];
    },
  });

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ["whatsapp-messages", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages").select("*")
        .eq("contact_id", selectedContactId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!selectedContactId,
  });

  // Last message preview per contact
  const { data: lastMap = {} } = useQuery({
    queryKey: ["whatsapp-last-msg", contacts.length],
    queryFn: async () => {
      if (!contacts.length) return {};
      const ids = contacts.map(c => c.id);
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("contact_id, message_text, direction, delivery_status, created_at")
        .in("contact_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);
      const out: Record<string, any> = {};
      (data || []).forEach((m: any) => { if (!out[m.contact_id]) out[m.contact_id] = m; });
      return out;
    },
    enabled: contacts.length > 0,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedContactId] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-last-msg"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedContactId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { contact_id: selectedContactId, message_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedContactId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
    },
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  // Forward to task
  const forwardToTask = useMutation({
    mutationFn: async (msg: WhatsAppMessage) => {
      const contact = contacts.find(c => c.id === msg.contact_id);
      const { data, error } = await supabase.from("tasks").insert({
        title: `WhatsApp: ${(msg.message_text || "").slice(0, 60)}...`,
        description: `From: ${contact?.name || contact?.phone}\n\n${msg.message_text || "[Attachment]"}`,
        created_by: profile?.id, priority: "medium", status: "open",
        source_type: "whatsapp", source_id: msg.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("whatsapp_messages")
        .update({ is_forwarded: true, forwarded_to_task_id: data.id }).eq("id", msg.id);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Task created from WhatsApp message" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedContactId] });
      setShowForwardDialog(false);
    },
  });

  const markRead = async (contactId: string) => {
    await supabase.from("whatsapp_contacts").update({ unread_count: 0 }).eq("id", contactId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
  };

  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const filteredContacts = contacts.filter(c =>
    !searchQuery || (c.name || c.phone).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectContact = (id: string) => {
    setSelectedContactId(id);
    markRead(id);
  };

  const showThreadView = isMobile ? !!selectedContactId : true;
  const showContactList = isMobile ? !selectedContactId : true;
  const totalUnread = contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // WhatsApp brand green for outgoing bubbles, regardless of theme
  const waGreen = '#25D366';
  const waGreenDark = '#075E54';

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" style={{ backgroundColor: palette.bg, color: palette.text }}>
      {/* Top header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: palette.panel, borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: waGreen }}>
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-bold" style={{ color: palette.text }}>WhatsApp Inbox</h1>
        </div>
        {totalUnread > 0 && (
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: waGreen, color: 'white' }}
          >
            {totalUnread} unread
          </span>
        )}
        <div className="ml-auto">
          <CommThemeToggle />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Contact list */}
        {showContactList && (
          <div
            className={cn("flex flex-col", isMobile ? "w-full" : "w-80 shrink-0")}
            style={{ backgroundColor: palette.panel, borderRight: `1px solid ${palette.border}` }}
          >
            <div className="p-3" style={{ borderBottom: `1px solid ${palette.border}` }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: palette.textMuted }} />
                <input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-full text-sm outline-none"
                  style={{
                    backgroundColor: palette.panelAlt,
                    color: palette.text,
                    border: `1px solid ${palette.border}`,
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {filteredContacts.map(contact => {
                const isActive = selectedContactId === contact.id;
                const name = contact.name || contact.phone;
                const initials = initialsFromName(name);
                const color = colorFromName(name);
                const last = lastMap[contact.id];
                const preview = last?.message_text
                  ? last.message_text.slice(0, 40) + (last.message_text.length > 40 ? '…' : '')
                  : 'No messages yet';
                const ts = contact.last_message_at || last?.created_at;

                return (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact.id)}
                    className="w-full text-left rounded-xl p-2.5 transition-all duration-150"
                    style={{
                      backgroundColor: isActive ? palette.accentSoft : 'transparent',
                      border: `1px solid ${isActive ? palette.accent + '55' : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: palette.text }}>{name}</p>
                          {ts && (
                            <span className="text-[10px] shrink-0" style={{ color: palette.textMuted }}>
                              {formatCommTime(ts)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] truncate flex-1" style={{ color: palette.textMuted }}>
                            {last?.direction === 'outbound' && (
                              <span className="inline-flex mr-1">
                                {deliveryIcons[last.delivery_status]}
                              </span>
                            )}
                            {preview}
                          </p>
                          {contact.unread_count > 0 && (
                            <span
                              className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0 text-white"
                              style={{ backgroundColor: waGreen }}
                            >
                              {contact.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredContacts.length === 0 && (
                <div className="p-6 text-center" style={{ color: palette.textMuted }}>
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No contacts yet</p>
                  <p className="text-xs mt-1">Incoming WhatsApp messages will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thread view */}
        {showThreadView && (
          <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: palette.bg }}>
            {selectedContact ? (
              <>
                {/* Thread header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ backgroundColor: palette.panel, borderBottom: `1px solid ${palette.border}` }}
                >
                  {isMobile && (
                    <Button variant="ghost" size="icon" onClick={() => setSelectedContactId(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: colorFromName(selectedContact.name || selectedContact.phone) }}
                  >
                    {initialsFromName(selectedContact.name || selectedContact.phone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: palette.text }}>
                      {selectedContact.name || selectedContact.phone}
                    </p>
                    <p className="text-xs truncate" style={{ color: palette.textMuted }}>
                      {selectedContact.phone}
                      {selectedContact.profile_id && ' • Linked profile'}
                    </p>
                  </div>
                  {selectedContact.profile_id && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <User className="h-3 w-3" /> Linked
                    </Badge>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 animate-fade-in">
                  {messages.map(msg => {
                    const isOut = msg.direction === 'outbound';
                    return (
                      <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                        <div
                          className="max-w-[75%] rounded-2xl px-3 py-2 shadow-sm group relative"
                          style={{
                            backgroundColor: isOut
                              ? (palette.bg === '#ffffff' ? '#dcf8c6' : waGreenDark)
                              : palette.panel,
                            color: isOut
                              ? (palette.bg === '#ffffff' ? '#111b21' : '#ffffff')
                              : palette.text,
                            borderTopRightRadius: isOut ? 4 : undefined,
                            borderTopLeftRadius: !isOut ? 4 : undefined,
                          }}
                        >
                          {msg.is_forwarded && (
                            <div className="flex items-center gap-1 mb-1 opacity-70">
                              <Forward className="h-3 w-3" />
                              <span className="text-[10px]">Forwarded to task</span>
                            </div>
                          )}

                          {msg.template_name && (
                            <span
                              className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mb-1"
                              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
                            >
                              TEMPLATE
                            </span>
                          )}

                          {msg.attachment_url && (
                            <div className="mb-1">
                              {msg.attachment_type?.startsWith("image") ? (
                                <img src={msg.attachment_url} alt="attachment" className="rounded max-w-full max-h-48 object-cover" />
                              ) : (
                                <a
                                  href={msg.attachment_url} target="_blank" rel="noopener"
                                  className="flex items-center gap-1 text-xs underline"
                                >
                                  <FileText className="h-3 w-3" /> Attachment
                                </a>
                              )}
                            </div>
                          )}

                          {msg.message_text && (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                          )}

                          <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
                            <span className="text-[10px] opacity-70">
                              {formatCommTime(msg.created_at)}
                            </span>
                            {isOut && deliveryIcons[msg.delivery_status]}
                          </div>

                          {/* Hover actions */}
                          <div className="absolute top-0 right-0 -mt-2 -mr-1 hidden group-hover:flex gap-1">
                            <Button
                              variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow"
                              onClick={() => { setForwardingMessage(msg); setShowForwardDialog(true); }}
                            >
                              <Forward className="h-3 w-3" />
                            </Button>
                            {!msg.forwarded_to_task_id && (
                              <Button
                                variant="secondary" size="icon" className="h-6 w-6 rounded-full shadow"
                                onClick={() => forwardToTask.mutate(msg)}
                              >
                                <ListTodo className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div
                  className="p-3 flex items-end gap-2"
                  style={{ backgroundColor: palette.panel, borderTop: `1px solid ${palette.border}` }}
                >
                  <Textarea
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    className="min-h-[40px] max-h-24 resize-none"
                    style={{
                      backgroundColor: palette.panelAlt,
                      color: palette.text,
                      borderColor: palette.border,
                    }}
                    rows={1}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (messageText.trim()) sendMessage.mutate(messageText.trim());
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="shrink-0"
                    style={{ backgroundColor: waGreen, color: 'white' }}
                    disabled={!messageText.trim() || sendMessage.isPending}
                    onClick={() => { if (messageText.trim()) sendMessage.mutate(messageText.trim()); }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              // Polished empty state with pulse ring
              <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="relative w-28 h-28 mx-auto">
                    <div className="absolute inset-0 rounded-full pulse" style={{ backgroundColor: 'rgba(37,211,102,0.2)' }} />
                    <div
                      className="absolute inset-3 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: waGreen }}
                    >
                      <MessageSquare className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: palette.text }}>Select a conversation</h3>
                  <p className="text-sm" style={{ color: palette.textMuted }}>
                    Incoming messages from students and parents will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forward Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded text-sm">
              {forwardingMessage?.message_text || "[Attachment]"}
            </div>
            <div>
              <Label>Forward as</Label>
              <Select value={forwardTarget} onValueChange={(v: any) => setForwardTarget(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">WorkHub Task</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => { if (forwardingMessage) forwardToTask.mutate(forwardingMessage); }}
              disabled={forwardToTask.isPending}
            >
              {forwardToTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WhatsAppInbox() {
  return (
    <DashboardLayout>
      <CommThemeProvider>
        <WhatsAppInner />
      </CommThemeProvider>
    </DashboardLayout>
  );
}
