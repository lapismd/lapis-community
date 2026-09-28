import { afterEach, describe, expect, it, vi } from "vitest";

import { canUseTursoCommunityEventStore } from "./turso-browser-capabilities.js";

describe("Turso browser capabilities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("declines Turso when shared WebAssembly memory cannot cross a worker message", () => {
    vi.stubGlobal("navigator", {
      storage: { getDirectory: vi.fn() },
      locks: { request: vi.fn() },
    });
    vi.stubGlobal("SharedArrayBuffer", class SharedArrayBuffer {});
    vi.stubGlobal("Atomics", {});
    vi.stubGlobal("crossOriginIsolated", true);
    vi.stubGlobal(
      "MessageChannel",
      class SafariMessageChannel {
        readonly port1 = {
          postMessage() {
            throw new DOMException(
              "The object can not be cloned.",
              "DataCloneError",
            );
          },
          close() {},
        };
        readonly port2 = { close() {} };
      },
    );

    expect(canUseTursoCommunityEventStore()).toBe(false);
  });
});
