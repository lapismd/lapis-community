/**
 * Turso's worker pool posts its shared WebAssembly memory to child workers.
 * WebKit exposes the surrounding OPFS and shared-memory APIs but rejects that
 * structured clone, so test the exact boundary before selecting Turso.
 */
export function canUseTursoCommunityEventStore(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof navigator.locks?.request === "function" &&
    typeof SharedArrayBuffer !== "undefined" &&
    typeof Atomics !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    globalThis.crossOriginIsolated === true &&
    canCloneSharedWebAssemblyMemory()
  );
}

function canCloneSharedWebAssemblyMemory(): boolean {
  if (typeof MessageChannel === "undefined") return false;
  const channel = new MessageChannel();
  try {
    const memory = new WebAssembly.Memory({
      initial: 1,
      maximum: 1,
      shared: true,
    });
    channel.port1.postMessage(memory);
    return true;
  } catch {
    return false;
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
}
