import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TODO: REPLACE WITH REAL FIREBASE WEB CONFIG (public/client-safe values).
// Firebase console -> Project settings -> General -> Your apps -> Web app.
// These MUST match the config in public/firebase-messaging-sw.js.
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDZyIVucuObX1HQh0ecV7nxdGvJYIWgIqI",
  authDomain: "aqta-lms.firebaseapp.com",
  projectId: "aqta-lms",
  storageBucket: "aqta-lms.firebasestorage.app",
  messagingSenderId: "1025089138581",
  appId: "1:1025089138581:web:980cf022ec55cb4278d09c",
};

// ============================================================================
// TODO: REPLACE WITH REAL VAPID PUBLIC KEY.
// Firebase console -> Project settings -> Cloud Messaging -> Web Push certificates.
// ============================================================================
export const FIREBASE_VAPID_KEY = "REPLACE_WITH_FIREBASE_VAPID_PUBLIC_KEY";

const CONFIG_IS_PLACEHOLDER = firebaseConfig.apiKey.startsWith("REPLACE_WITH_");

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

function getDeviceInfo() {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform ?? null,
    language: navigator.language ?? null,
  };
}

/** Wraps Notification.requestPermission() with SSR/unsupported guards. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

async function getMessagingSwRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    console.warn("[push] Failed to register firebase-messaging-sw.js", e);
    return undefined;
  }
}

/**
 * Initializes FCM, retrieves the device token, and upserts it into push_tokens.
 * Returns the token, or null when unsupported / not permitted / not configured.
 */
export async function getAndSavePushToken(userId: string): Promise<string | null> {
  if (CONFIG_IS_PLACEHOLDER) {
    console.info("[push] Firebase config not set yet — skipping token registration.");
    return null;
  }
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  if (!(await isSupported().catch(() => false))) return null;

  try {
    const messaging = getMessaging(getFirebaseApp());
    const serviceWorkerRegistration = await getMessagingSwRegistration();
    const token = await getToken(messaging, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration,
    });
    if (!token) return null;

    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          device_info: getDeviceInfo(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    if (error) console.warn("[push] Failed to save push token", error.message);

    try {
      localStorage.setItem("aqta_push_token", token);
    } catch {
      /* ignore storage errors */
    }
    return token;
  } catch (e) {
    console.warn("[push] getAndSavePushToken failed", e);
    return null;
  }
}

/** Removes this device's token from push_tokens (call on logout). */
export async function deletePushToken(userId: string): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem("aqta_push_token");
  } catch {
    /* ignore */
  }

  try {
    if (!CONFIG_IS_PLACEHOLDER && (await isSupported().catch(() => false))) {
      const messaging = getMessaging(getFirebaseApp());
      await deleteToken(messaging).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  if (token) {
    await supabase.from("push_tokens").delete().eq("token", token).eq("user_id", userId);
    try {
      localStorage.removeItem("aqta_push_token");
    } catch {
      /* ignore */
    }
  }
}
