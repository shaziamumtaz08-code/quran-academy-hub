import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ConditionalDashboardLayout as DashboardLayout } from "@/components/layout/ConditionalDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Bell, MessageSquare, Mail, Send, Plus, Clock, CheckCircle, XCircle, AlertCircle, Check } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-4 w-4 text-emerald-600" />,
  sms: <MessageSquare className="h-4 w-4 text-blue-500" />,
  email: <Mail className="h-4 w-4 text-amber-500" />,
  in_app: <Bell className="h-4 w-4 text-violet-500" />,
  lms: <Bell className="h-4 w-4 text-primary" />,
};

const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  queued: { icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  sent: { icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  read: { icon: <Check className="h-3 w-3" />, variant: "outline" },
  delivered: { icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

export default function NotificationCenter() {
  const { user, activeRole } = useAuth();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("my-notifications");
  const [templateDialog, setTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "", channel: "lms", event_trigger: "", template_text: "", is_active: true,
  });

  // My notifications (notification_queue for current user)
  const { data: myNotifications = [] } = useQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_queue")
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch templates (admin view)
  const { data: templates = [] } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch recent events (admin view)
  const { data: events = [] } = useQuery({
    queryKey: ["notification-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_events")
        .select("*, notification_templates(name, event_trigger), profiles:recipient_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Mark notification as read
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_queue")
        .update({ status: "read", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notification_queue")
        .update({ status: "read", sent_at: new Date().toISOString() })
        .eq("recipient_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  // Create template
  const createTemplate = useMutation({
    mutationFn: async (tmpl: typeof newTemplate) => {
      const variables = (tmpl.template_text.match(/\{\{(\w+)\}\}/g) || []).map(
        (v: string) => v.replace(/\{\{|\}\}/g, "")
      );
      const { error } = await supabase.from("notification_templates").insert({
        ...tmpl,
        variables,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setTemplateDialog(false);
      setNewTemplate({ name: "", channel: "lms", event_trigger: "", template_text: "", is_active: true });
      toast({ title: "Template created" });
    },
  });

  // Toggle template active
  const toggleTemplate = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("notification_templates").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-templates"] }),
  });

  const unreadCount = myNotifications.filter((n: any) => n.status === 'pending').length;
  const totalSent = events.filter((e: any) => e.status === "sent" || e.status === "delivered").length;
  const totalFailed = events.filter((e: any) => e.status === "failed").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">Your notifications and system templates</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
              Mark all as read ({unreadCount})
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-notifications">
              My Notifications {unreadCount > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px] h-4 min-w-4 px-1">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="history">Send History</TabsTrigger>
          </TabsList>

          {/* My Notifications */}
          <TabsContent value="my-notifications" className="space-y-3">
            {myNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              myNotifications.map((n: any) => {
                const isUnread = n.status === 'pending';
                return (
                  <Card key={n.id}
                    className={`cursor-pointer transition-colors ${isUnread ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                    onClick={() => { if (isUnread) markRead.mutate(n.id); }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUnread ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Bell className={`h-4 w-4 ${isUnread ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> New Template</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Notification Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Template Name</Label>
                      <Input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Fee Reminder" />
                    </div>
                    <div>
                      <Label>Channel</Label>
                      <Select value={newTemplate.channel} onValueChange={v => setNewTemplate(p => ({ ...p, channel: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lms">In-App (LMS)</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Event Trigger</Label>
                      <Select value={newTemplate.event_trigger} onValueChange={v => setNewTemplate(p => ({ ...p, event_trigger: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enrollment_created">Enrollment Created</SelectItem>
                          <SelectItem value="application_submitted">Application Submitted</SelectItem>
                          <SelectItem value="application_approved">Application Approved</SelectItem>
                          <SelectItem value="application_rejected">Application Rejected</SelectItem>
                          <SelectItem value="class_reminder">Class Reminder</SelectItem>
                          <SelectItem value="assignment_due">Assignment Due</SelectItem>
                          <SelectItem value="exam_published">Exam Published</SelectItem>
                          <SelectItem value="certificate_awarded">Certificate Awarded</SelectItem>
                          <SelectItem value="fee_overdue">Fee Overdue</SelectItem>
                          <SelectItem value="fee_reminder">Fee Reminder</SelectItem>
                          <SelectItem value="attendance_absent">Attendance Alert</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Message Template</Label>
                      <Textarea
                        value={newTemplate.template_text}
                        onChange={e => setNewTemplate(p => ({ ...p, template_text: e.target.value }))}
                        placeholder="Use {{variable_name}} for dynamic values"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Variables: {"{{student_name}}"}, {"{{course_name}}"}, {"{{amount}}"}, {"{{date}}"}</p>
                    </div>
                    <Button onClick={() => createTemplate.mutate(newTemplate)} disabled={!newTemplate.name || !newTemplate.event_trigger || !newTemplate.template_text}>
                      Create Template
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {templates.map((t: any) => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {channelIcons[t.channel] || channelIcons.lms}
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <Badge variant="outline" className="text-xs mt-1">{t.event_trigger}</Badge>
                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{t.template_text}</p>
                          {t.variables?.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {t.variables.map((v: string) => (
                                <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={t.is_active}
                          onCheckedChange={checked => toggleTemplate.mutate({ id: t.id, is_active: checked })}
                        />
                        <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {templates.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No templates yet. Create one to get started.</p>
              )}
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalSent}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{events.filter((e: any) => e.status === "queued").length}</p>
                  <p className="text-xs text-muted-foreground">Queued</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalFailed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              {events.map((e: any) => {
                const sc = statusConfig[e.status] || statusConfig.queued;
                return (
                  <Card key={e.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {channelIcons[e.channel] || channelIcons.lms}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {(e.profiles as any)?.full_name || e.recipient_phone || "Unknown"}
                              </p>
                              <Badge variant={sc.variant} className="text-xs flex items-center gap-1">
                                {sc.icon} {e.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{e.rendered_text}</p>
                            {e.error_message && <p className="text-xs text-destructive mt-1">{e.error_message}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {format(new Date(e.created_at), "MMM d, HH:mm")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {events.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No notifications sent yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
