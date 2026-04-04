import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Bell, MessageSquare, Mail, Send, Plus, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-4 w-4 text-green-600" />,
  sms: <MessageSquare className="h-4 w-4 text-blue-500" />,
  email: <Mail className="h-4 w-4 text-orange-500" />,
  in_app: <Bell className="h-4 w-4 text-purple-500" />,
};

const statusConfig: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  sent: { icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  delivered: { icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
};

export default function NotificationCenter() {
  const queryClient = useQueryClient();
  const [templateDialog, setTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "", channel: "whatsapp", event_trigger: "", template_text: "", is_active: true,
  });

  // Fetch templates
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
  });

  // Fetch recent events
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
      setNewTemplate({ name: "", channel: "whatsapp", event_trigger: "", template_text: "", is_active: true });
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

  // Stats
  const totalSent = events.filter((e: any) => e.status === "sent" || e.status === "delivered").length;
  const totalFailed = events.filter((e: any) => e.status === "failed").length;
  const totalQueued = events.filter((e: any) => e.status === "queued").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notification Center</h1>
            <p className="text-muted-foreground">Manage WhatsApp, SMS, and email notifications</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Templates</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{totalSent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{totalQueued}</p>
              <p className="text-xs text-muted-foreground">Queued</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="history">Notification History</TabsTrigger>
          </TabsList>

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
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="in_app">In-App</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Event Trigger</Label>
                      <Select value={newTemplate.event_trigger} onValueChange={v => setNewTemplate(p => ({ ...p, event_trigger: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select trigger" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fee_reminder">Fee Reminder</SelectItem>
                          <SelectItem value="attendance_absent">Attendance Alert</SelectItem>
                          <SelectItem value="class_reminder">Class Reminder</SelectItem>
                          <SelectItem value="enrollment_complete">Enrollment Complete</SelectItem>
                          <SelectItem value="exam_result">Exam Result</SelectItem>
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
                      <p className="text-xs text-muted-foreground mt-1">Variables: {"{{student_name}}"}, {"{{parent_name}}"}, {"{{amount}}"}, {"{{date}}"}, etc.</p>
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
                        {channelIcons[t.channel]}
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

          <TabsContent value="history" className="space-y-4">
            <div className="space-y-3">
              {events.map((e: any) => {
                const sc = statusConfig[e.status] || statusConfig.queued;
                return (
                  <Card key={e.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {channelIcons[e.channel]}
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
