/** Report a rendered content boundary once it enters a visible document viewport. */
export function observeReadEnd(
  node: HTMLElement,
  initial: { key: string; onRead?: () => void },
) {
  let current = initial;
  let notifiedKey: string | undefined;
  let observer: IntersectionObserver;

  function observe() {
    observer?.disconnect();
    const key = current.key;
    observer = new IntersectionObserver((entries) => {
      if (
        key !== current.key ||
        key === notifiedKey ||
        !current.onRead ||
        document.visibilityState === "hidden" ||
        node.closest('[inert], [aria-hidden="true"]') ||
        !entries.some((entry) => entry.isIntersecting)
      )
        return;
      notifiedKey = key;
      current.onRead();
    });
    observer.observe(node);
  }

  observe();
  document.addEventListener("visibilitychange", observe);
  return {
    update(next: typeof initial) {
      const changed =
        next.key !== current.key || !!next.onRead !== !!current.onRead;
      if (next.key !== current.key) notifiedKey = undefined;
      current = next;
      if (changed) observe();
    },
    destroy() {
      observer.disconnect();
      document.removeEventListener("visibilitychange", observe);
    },
  };
}
