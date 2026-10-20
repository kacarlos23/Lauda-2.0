let guard: ((leave: () => void) => void) | null = null;
let originIndex: number | undefined;
let returning = false;

function browserIndex(): number | undefined {
  return (window as Window & { navigation?: { currentEntry?: { index: number } } }).navigation?.currentEntry?.index;
}

export function rememberFormHistoryPosition() {
  if (typeof window !== "undefined") originIndex = browserIndex();
}

// Install before the router's history listener: tab focus changes can unmount
// a form before a listener installed by that form gets its turn to run.
if (typeof window !== "undefined" && typeof window.addEventListener === "function" && typeof window.history !== "undefined") {
  window.addEventListener("popstate", (event) => {
    if (returning) { event.stopImmediatePropagation(); returning = false; return; }
    if (!guard) return;
    const destination = browserIndex();
    const distance = originIndex !== undefined && destination !== undefined ? originIndex - destination : 1;
    let checking = true;
    let proceed = false;
    guard(() => {
      if (checking) proceed = true;
      else window.history.go(-(distance || 1));
    });
    checking = false;
    if (proceed) return;
    event.stopImmediatePropagation();
    returning = true;
    window.history.go(distance || 1);
  }, true);
}

export function registerFormExitGuard(next: (leave: () => void) => void) {
  guard = next;
  rememberFormHistoryPosition();
  return () => { if (guard === next) guard = null; };
}

export function requestFormNavigation(leave: () => void) {
  if (guard) guard(leave);
  else leave();
}
