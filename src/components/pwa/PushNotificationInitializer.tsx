import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAndSavePushToken } from "@/lib/pushNotifications";
import { PUSH_GRANTED_EVENT } from "@/components/pwa/PushPermissionBanner";

/**
 * Headless. Registers/refreshes the FCM device token for an authenticated user
 * whose notification permission is 'granted' — either already granted on mount,
 * or granted just now via the PushPermissionBanner.
 */
export function PushNotificationInitializer() {
  const { user, isAuthenticated } = useAuth();
  const doneForUser = useRef<string | null>(null);

  const register = useCallback((userId: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (doneForUser.current === userId) return;
    doneForUser.current = userId;
    getAndSavePushToken(userId).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    register(user.id);
  }, [isAuthenticated, user?.id, register]);

  // Permission granted from the banner → register immediately.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const onGranted = () => register(user.id);
    window.addEventListener(PUSH_GRANTED_EVENT, onGranted);
    return () => window.removeEventListener(PUSH_GRANTED_EVENT, onGranted);
  }, [isAuthenticated, user?.id, register]);

  return null;
}

export default PushNotificationInitializer;
