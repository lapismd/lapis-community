/** Reveal a reply within this chat viewport; never scroll the surrounding shell. */
export function focusReply(
  node: HTMLElement,
  input: { id?: string | undefined; viewport: HTMLElement | null },
) {
  let observer: MutationObserver | undefined;
  let frame = 0;
  function observe(value: typeof input) {
    observer?.disconnect();
    cancelAnimationFrame(frame);
    if (!value.id || !value.viewport) return;
    const reveal = () => {
      const row = [
        ...node.querySelectorAll<HTMLElement>("[data-message-id]"),
      ].find((item) => item.dataset.messageId === value.id);
      if (!row || !value.viewport) return;
      observer?.disconnect();
      frame = requestAnimationFrame(() => {
        if (!row.isConnected || !value.viewport) return;
        const delta =
          row.getBoundingClientRect().top -
          value.viewport.getBoundingClientRect().top;
        value.viewport.scrollTo({
          top: value.viewport.scrollTop + delta - 24,
          behavior: "instant",
        });
      });
    };
    observer = new MutationObserver(reveal);
    observer.observe(node, { childList: true, subtree: true });
    reveal();
  }
  observe(input);
  return {
    update: observe,
    destroy() {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}
