import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAndSavePushToken } from "@/lib/pushNotifications";

/**
 * Headless. For an authenticated user whose notification permission is already
 * 'granted', silently registers/refreshes their FCM device token.
 * Never prompts — the permission request UX lands in a later stage.
 */
export function PushNotificationInitializer() {
  const { user, isAuthenticated } = useAuth();
  const doneForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (doneForUser.current === user.id) return;

    doneForUser.current = user.id;
    getAndSavePushToken(user.id).catch(() => {});
  }, [isAuthenticated, user?.id]);

  return null;
}

export default PushNotificationInitializer;
