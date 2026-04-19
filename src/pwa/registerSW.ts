export function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()));

    caches.keys().then(keys =>
      keys.forEach(key => caches.delete(key)));
  }
}
