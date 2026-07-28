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

