/** Keep the final edit available for teardown as well as the debounce timer. */
export function createComposerDraftWriter() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | undefined;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  function flush(): void {
    const write = pending;
    cancel();
    write?.();
  }

  return {
    schedule(write: () => void): void {
      cancel();
      pending = write;
      timer = setTimeout(flush, 250);
    },
    cancel,
    flush,
  };
}
