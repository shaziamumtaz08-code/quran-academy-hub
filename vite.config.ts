import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /\/functions\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
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
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "img-cache",
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
