export function focusTranscriptItem(
  node: HTMLElement,
  revision: number | undefined,
) {
  let frame = 0;
  function reveal(next: number | undefined) {
    cancelAnimationFrame(frame);
    if (next === undefined) return;
    frame = requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      node.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "instant",
      });
    });
  }
  reveal(revision);
  return {
    update: reveal,
    destroy() {
      cancelAnimationFrame(frame);
    },
  };
}
