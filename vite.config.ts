import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Bump this whenever SW behavior changes — forces clients to drop old caches.
const SW_VERSION = `v${Date.now()}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we register manually with iframe/preview guard
      devOptions: { enabled: false },
      manifest: false, // using public/manifest.webmanifest
      workbox: {
        // navigateFallback REMOVED — was causing offline.html to be served
        // even when the network was working.
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api/,
          /\/functions\//,
          /\/auth\//,
        ],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        cacheId: `aqt-${SW_VERSION}`,
        globPatterns: ["**/*.{css,html,ico,png,svg,webp,woff2}"],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        runtimeCaching: [
          {
            // Never cache Supabase or any API calls
            urlPattern: ({ url }) =>
              url.hostname.endsWith("supabase.co") ||
              url.hostname.endsWith("supabase.in") ||
              url.pathname.startsWith("/api/") ||
              url.pathname.includes("/functions/"),
            handler: "NetworkOnly",
          },
          {
            // Navigation requests (HTML pages) — network first, fallback to
            // offline.html ONLY when the network genuinely fails.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: `pages-${SW_VERSION}`,
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: `img-${SW_VERSION}`,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
