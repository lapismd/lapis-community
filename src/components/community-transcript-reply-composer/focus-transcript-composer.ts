/** Editor creation is asynchronous; focus this composer without moving the chat viewport. */
export function focusTranscriptComposer(node: HTMLElement) {
  const focus = () => {
    const editor = node.querySelector<HTMLElement>('[role="textbox"]');
    if (!editor) return;
    observer.disconnect();
    editor.focus({ preventScroll: true });
  };
  const observer = new MutationObserver(focus);
  observer.observe(node, { subtree: true, childList: true });
  focus();
  return () => observer.disconnect();
}
