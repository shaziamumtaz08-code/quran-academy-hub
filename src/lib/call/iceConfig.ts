/**
 * ICE configuration for the in-app VCR call (Phase 3, audio only).
 *
 * Google's public STUN server is always used. A TURN relay can be added later
 * purely through environment variables — no code change required:
 *
 *   VITE_TURN_URL         e.g. turn:turn.example.com:3478  (comma separated for multiple)
 *   VITE_TURN_USERNAME
 *   VITE_TURN_CREDENTIAL
 *
 * The call still attempts to connect when TURN is absent (STUN-only / same-network peers).
 */

const STUN_URLS = ['stun:stun.l.google.com:19302'];

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: STUN_URLS }];

  const env = import.meta.env as Record<string, string | undefined>;
  const turnUrl = env.VITE_TURN_URL?.trim();
  const username = env.VITE_TURN_USERNAME?.trim();
  const credential = env.VITE_TURN_CREDENTIAL?.trim();

  if (turnUrl) {
    const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean);
    if (urls.length) {
      servers.push(
        username && credential ? { urls, username, credential } : { urls }
      );
    }
  }

  return servers;
}

/** True when a relay is configured — used to explain likely failures to the user. */
export function hasTurnConfigured(): boolean {
  return Boolean((import.meta.env as Record<string, string | undefined>).VITE_TURN_URL?.trim());
}
