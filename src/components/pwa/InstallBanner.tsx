import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "aqt_pwa_install_dismissed_v1";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS has no beforeinstallprompt — show manual hint
    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[100] md:hidden">
      <div className="bg-card border border-border shadow-lg rounded-xl px-3 py-2.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">
          AQT
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground leading-tight">
            Install the app for faster access
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
            {iosHint ? "Tap Share → Add to Home Screen" : "Works offline · feels native"}
          </p>
        </div>
        {!iosHint && (
          <Button size="sm" onClick={install} className="h-8 px-3 text-[11px] gap-1">
            <Download className="h-3.5 w-3.5" /> Install
          </Button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
