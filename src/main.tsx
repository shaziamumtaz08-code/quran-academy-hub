import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import { registerPWA } from "./pwa/registerSW";

// Stop the browser from restoring the previous scroll offset on refresh /
// back-forward navigation, which made pages land mid-way down long tables.
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

createRoot(document.getElementById("root")!).render(<App />);

registerPWA();

// Initialize the Zoom Apps SDK so the app can run inside Zoom's embedded
// browser (Zoom client sidebar / in-meeting app). Outside Zoom this resolves
// harmlessly; any failure is swallowed so the normal web app is unaffected.
void (async () => {
  try {
    const { default: zoomSdk } = await import("@zoom/appssdk");
    await zoomSdk.config({
      version: "0.16",
      popoutSize: { width: 480, height: 360 },
      capabilities: [
        "shareApp",
        "getMeetingContext",
        "getUserContext",
        "getRunningContext",
      ],
    });
  } catch {
    // Not running inside the Zoom client — safe to ignore.
  }
})();

