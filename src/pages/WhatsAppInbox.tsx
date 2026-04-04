import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare, Send, Search, Phone, Check, CheckCheck, Clock,
  XCircle, Paperclip, Forward, ListTodo, ArrowLeft, Image, FileText, User
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  queued: <Clock className="h-3 w-3 text-muted-foreground" />,
  sent: <Check className="h-3 w-3 text-muted-foreground" />,
  delivered: <CheckCheck className="h-3 w-3 text-muted-foreground" />,
  read: <CheckCheck className="h-3 w-3 text-blue-500" />,
  failed: <XCircle className="h-3 w-3 text-destructive" />,
};

export default function WhatsAppInbox() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<WhatsAppMessage | null>(null);
  const [forwardTarget, setForwardTarget] = useState<"task" | "group" | "user">("task");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["whatsapp-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppContact[];
    },
  });

  // Fetch messages for selected contact
  const { data: messages = [] } = useQuery({
    queryKey: ["whatsapp-messages", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_id", selectedContactId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!selectedContactId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedContactId] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedContactId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
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
        created_by: profile?.id,
        priority: "medium",
        status: "open",
        source_type: "whatsapp",
        source_id: msg.id,
      }).select().single();
      if (error) throw error;

      // Mark message as forwarded
      await supabase.from("whatsapp_messages")
        .update({ is_forwarded: true, forwarded_to_task_id: data.id })
        .eq("id", msg.id);

      return data;
    },
    onSuccess: () => {
      toast({ title: "Task created from WhatsApp message" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedContactId] });
      setShowForwardDialog(false);
    },
  });

  // Mark as read
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

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">WhatsApp Inbox</h1>
          </div>
          <Badge variant="secondary" className="text-xs">
            {contacts.reduce((sum, c) => sum + (c.unread_count || 0), 0)} unread
          </Badge>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Contact List */}
          {showContactList && (
            <div className={cn("border-r flex flex-col", isMobile ? "w-full" : "w-80 shrink-0")}>
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredContacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition text-left border-b",
                      selectedContactId === contact.id && "bg-muted"
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                        {(contact.name || contact.phone).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{contact.name || contact.phone}</p>
                        {contact.last_message_at && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {format(new Date(contact.last_message_at), "HH:mm")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                    </div>
                    {contact.unread_count > 0 && (
                      <span className="bg-green-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {contact.unread_count}
                      </span>
                    )}
                  </button>
                ))}
                {filteredContacts.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No contacts yet</p>
                    <p className="text-xs mt-1">Incoming WhatsApp messages will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thread View */}
          {showThreadView && (
            <div className="flex-1 flex flex-col min-w-0">
              {selectedContact ? (
                <>
                  {/* Thread Header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
                    {isMobile && (
                      <Button variant="ghost" size="icon" onClick={() => setSelectedContactId(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-green-100 text-green-700 text-sm">
                        {(selectedContact.name || selectedContact.phone).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{selectedContact.name || selectedContact.phone}</p>
                      <p className="text-xs text-muted-foreground">{selectedContact.phone}</p>
                    </div>
                    {selectedContact.profile_id && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <User className="h-3 w-3" /> Linked
                      </Badge>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === "outbound" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-xl px-3 py-2 shadow-sm group relative",
                            msg.direction === "outbound"
                              ? "bg-green-600 text-white rounded-br-sm"
                              : "bg-card border rounded-bl-sm"
                          )}
                        >
                          {msg.is_forwarded && (
                            <div className="flex items-center gap-1 mb-1 opacity-70">
                              <Forward className="h-3 w-3" />
                              <span className="text-[10px]">Forwarded to task</span>
                            </div>
                          )}

                          {msg.attachment_url && (
                            <div className="mb-1">
                              {msg.attachment_type?.startsWith("image") ? (
                                <img src={msg.attachment_url} alt="attachment" className="rounded max-w-full max-h-48 object-cover" />
                              ) : (
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener"
                                  className={cn("flex items-center gap-1 text-xs underline", msg.direction === "outbound" ? "text-white/90" : "text-primary")}
                                >
                                  <FileText className="h-3 w-3" /> Attachment
                                </a>
                              )}
                            </div>
                          )}

                          {msg.message_text && (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                          )}

                          <div className={cn("flex items-center gap-1 mt-1", msg.direction === "outbound" ? "justify-end" : "justify-start")}>
                            <span className={cn("text-[10px]", msg.direction === "outbound" ? "text-white/70" : "text-muted-foreground")}>
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                            {msg.direction === "outbound" && deliveryIcons[msg.delivery_status]}
                          </div>

                          {/* Hover actions */}
                          <div className="absolute top-0 right-0 -mt-2 -mr-1 hidden group-hover:flex gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6 rounded-full shadow"
                              onClick={() => { setForwardingMessage(msg); setShowForwardDialog(true); }}
                            >
                              <Forward className="h-3 w-3" />
                            </Button>
                            {!msg.forwarded_to_task_id && (
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-6 w-6 rounded-full shadow"
                                onClick={() => forwardToTask.mutate(msg)}
                              >
                                <ListTodo className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t bg-card flex items-end gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      className="min-h-[40px] max-h-24 resize-none"
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
                      className="shrink-0 bg-green-600 hover:bg-green-700"
                      disabled={!messageText.trim() || sendMessage.isPending}
                      onClick={() => { if (messageText.trim()) sendMessage.mutate(messageText.trim()); }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="font-medium text-lg">WhatsApp Inbox</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Select a contact to view messages
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
    </DashboardLayout>
  );
}
