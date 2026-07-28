import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { requestNotificationPermission, getAndSavePushToken } from "@/lib/pushNotifications";
import { toast } from "@/hooks/use-toast";

const DISMISS_KEY = "aqt_push_permission_dismissed_v1";

/** Fired after the user grants permission from this banner. */
export const PUSH_GRANTED_EVENT = "aqta:push-permission-granted";

/**
 * Non-intrusive prompt asking authenticated users to enable notifications.
 * Shows once per session, never when permission is 'denied' or 'granted'.
 * Mirrors the visual/dismissal pattern of InstallBanner.
 */
export function PushPermissionBanner() {
  const { user, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!isAuthenticated || !user?.id) return;
    if (Notification.permission !== "default") return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore storage errors */
    }
    setVisible(true);
  }, [isAuthenticated, user?.id]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === "granted" && user?.id) {
        const token = await getAndSavePushToken(user.id);
        window.dispatchEvent(new CustomEvent(PUSH_GRANTED_EVENT, { detail: { userId: user.id } }));
        toast({
          title: token ? "Notifications enabled" : "Notifications allowed",
          description: token
            ? "This device will now receive class and fee reminders."
            : "We couldn't register this device yet — try again later.",
        });
      } else if (permission === "denied") {
        toast({
          title: "Notifications blocked",
          description: "You can re-enable them from your browser's site settings.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
      dismiss();
    }
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[99] md:left-auto md:right-4 md:bottom-4 md:w-[360px]">
      <div className="bg-card border border-border shadow-lg rounded-xl px-3 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground leading-tight">
            Turn on notifications
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Class reminders, fee alerts and messages
          </p>
        </div>
        <Button size="sm" onClick={enable} disabled={busy} className="h-8 px-3 text-[11px]">
          {busy ? "…" : "Enable"}
        </Button>
        <button
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default PushPermissionBanner;
