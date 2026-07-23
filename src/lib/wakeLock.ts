/**
 * Screen Wake Lock — keeps the tablet/phone display from sleeping while ImproWiz is open.
 *
 * Automatic, no UI: `App.svelte` calls `initWakeLock()` once on mount and tears it down on unmount,
 * mirroring the `initMidi`/`initComputerKeys` lib shape (an init that returns a cleanup).
 *
 * Two facts drive the design:
 *  - The OS silently *releases* the lock whenever the tab is hidden (backgrounded, screen off, tab
 *    switch), so we re-request on `visibilitychange` when the page is visible again rather than assuming
 *    a single request lasts forever.
 *  - `navigator.wakeLock.request()` rejects if the page isn't visible or the browser's gesture policy
 *    blocks it — we swallow that quietly, since a missing wake lock is a graceful degradation, not an
 *    error worth surfacing.
 */
export function initWakeLock(): () => void {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return () => {}; // unsupported (e.g. older Safari) — no-op
  }

  let sentinel: WakeLockSentinel | null = null;

  async function request() {
    if (sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      // Drop our stale reference when the OS auto-releases (tab hidden), so the next
      // visibility change re-requests instead of short-circuiting on a dead sentinel.
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      sentinel = null; // page not visible / blocked by policy — degrade quietly
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void request();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  void request();

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    void sentinel?.release();
    sentinel = null;
  };
}
