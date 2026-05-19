export function detectIOS(): { isIOS: boolean; version: string | null } {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const m = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
  const version = m ? `${m[1]}.${m[2]}${m[3] ? "." + m[3] : ""}` : null;
  return { isIOS, version };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS-specific
    window.navigator.standalone === true
  );
}

export function supportsPush(): boolean {
  return "PushManager" in window && "Notification" in window;
}

export function supportsDeclarativePush(): boolean {
  // Heuristic: window.pushManager exists on Safari with Declarative Web Push.
  return "pushManager" in window;
}

export function supportsServiceWorkerPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
