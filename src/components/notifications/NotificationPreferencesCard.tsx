import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { BellRing } from "lucide-react";

type PrefKey = "class_reminders" | "fee_reminders" | "attendance_alerts" | "announcements" | "messages";

const PREFS: { key: PrefKey; label: string; description: string }[] = [
  { key: "class_reminders", label: "Class reminders", description: "Daily reminder of today's scheduled classes" },
  { key: "fee_reminders", label: "Fee reminders", description: "Invoice due and overdue alerts" },
  { key: "attendance_alerts", label: "Attendance alerts", description: "Absence and late-join notifications" },
  { key: "announcements", label: "Announcements", description: "Academy-wide news and updates" },
  { key: "messages", label: "Message alerts", description: "New direct messages and class pings" },
];

const DEFAULTS: Record<PrefKey, boolean> = {
  class_reminders: true,
  fee_reminders: true,
  attendance_alerts: true,
  announcements: true,
  messages: true,
};

export function NotificationPreferencesCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs = DEFAULTS } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...(data ?? {}) } as Record<PrefKey, boolean>;
    },
    enabled: !!user?.id,
  });

  const updatePref = useMutation({
    mutationFn: async ({ key, value }: { key: PrefKey; value: boolean }) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user!.id, ...prefs, [key]: value }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
      toast({ title: "Preferences updated" });
    },
    onError: (e: unknown) =>
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" /> Notification preferences
        </CardTitle>
        <CardDescription>
          Choose what you get notified about. These apply to push notifications and your in-app inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PREFS.map((p) => (
          <div key={p.key} className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`pref-${p.key}`} className="font-medium">{p.label}</Label>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <Switch
              id={`pref-${p.key}`}
              checked={prefs[p.key] ?? true}
              onCheckedChange={(value) => updatePref.mutate({ key: p.key, value })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
