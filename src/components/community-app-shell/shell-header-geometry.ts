/** Keep the application header aligned with the shell's main surface. */
export function observeShellHeaderGeometry(
  surface: HTMLElement,
  main: HTMLElement,
  publish: (start: number, width: number) => void,
): () => void {
  let frame: number | undefined;
  let active = true;
  const measure = () => {
    const surfaceBounds = surface.getBoundingClientRect();
    const mainBounds = main.getBoundingClientRect();
    publish(
      Math.max(0, Math.round(mainBounds.left - surfaceBounds.left)),
      Math.max(0, Math.round(mainBounds.width)),
    );
  };
  measure();
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver(() => {
    if (!active || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      measure();
    });
  });
  observer.observe(surface);
  observer.observe(main);
  return () => {
    active = false;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
