/** Two-tone alert chime via Web Audio API (no bundled audio asset). */
export function playPingChime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tone = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.16);
    };
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    tone(880, 0);
    tone(1174.66, 0.18);
    tone(880, 0.4);
    tone(1174.66, 0.58);
    try { (navigator as any).vibrate?.([120, 90, 120]); } catch { /* no haptics */ }
    setTimeout(() => ctx.close().catch(() => {}), 1400);
  } catch {
    /* audio unavailable — banner still shows */
  }
}
