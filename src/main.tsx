import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import { registerPWA } from "./pwa/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

registerPWA();
