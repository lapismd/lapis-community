import { afterEach, describe, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { createCommunityPresenceSession } from "./presence-session.js";
import {
  automaticPresence,
  parsePresenceEvent,
  type CommunityPresenceState,
} from "./presence-contracts.js";
import { createPresenceFixture } from "../testing/presence-fixture.js";
import { InMemoryCommunityRelay } from "../testing/in-memory-community-relay.js";
import type { NostrEventTemplate } from "../protocol/index.js";

const userKey = new Uint8Array(32).fill(91);
const relayKey = new Uint8Array(32).fill(92);

function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  const fixture = createPresenceFixture(relayKey);
  const relay = new InMemoryCommunityRelay({
    url: "wss://relay.example",
    policy: fixture.policy,
  });
  const publish = vi.spyOn(relay, "publish");
  const signEvent = vi.fn(async (template: NostrEventTemplate) =>
    finalizeEvent(template, userKey),
  );
  let state: CommunityPresenceState | undefined;
  const fetcher = vi.fn(fixture.fetch);
  const session = createCommunityPresenceSession({
    relay,
    identity: { getPublicKey: async () => getPublicKey(userKey), signEvent },
    authenticate: async () => {},
    fetch: fetcher,
  });
  session.watch([getPublicKey(userKey)]);
  session.start((value) => {
    state = value;
  });
  return { session, relay, publish, signEvent, fetcher, state: () => state };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("community presence lifecycle", () => {
  it("queues a manual preference behind an in-flight background refresh", async () => {
    const env = setup();
    let release: (() => void) | undefined;
    let result: Promise<unknown> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.signEvent.mockImplementationOnce(
        (template) =>
          new Promise((resolve) => {
            release = () => resolve(finalizeEvent(template, userKey));
          }),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      expect(release).toBeDefined();
      result = env.session.setPreference("away").then(
        () => null,
        (error: unknown) => error,
      );
      expect(env.state()?.pending).toBe(true);
      await expect(env.session.setPreference("offline")).rejects.toThrow(
        "Presence is updating; try again",
      );
      release!();
      expect(await result).toBeNull();
      expect(env.state()?.pending).toBe(false);
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe("away");
    } finally {
      env.session.close();
      release?.();
      await result;
    }
  });

  it("does not publish a queued preference after disposal", async () => {
    const env = setup();
    let release: (() => void) | undefined;
    let result: Promise<unknown> | undefined;
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.signEvent.mockImplementationOnce(
        (template) =>
          new Promise((resolve) => {
            release = () => resolve(finalizeEvent(template, userKey));
          }),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      result = env.session.setPreference("away").then(
        () => null,
        (error: unknown) => error,
      );
      expect(env.state()?.pending).toBe(true);
      const calls = env.publish.mock.calls.length;
      env.session.close();
      release!();
      expect(await result).toMatchObject({ name: "AbortError" });
      expect(env.publish).toHaveBeenCalledTimes(calls);
    } finally {
      env.session.close();
      release?.();
      await result;
    }
  });

  it("expires confidence while a signer prompt is still unanswered", async () => {
    const env = setup();
    let release: (() => void) | undefined;
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.signEvent.mockImplementationOnce(
        (template) =>
          new Promise((resolve) => {
            release = () => resolve(finalizeEvent(template, userKey));
          }),
      );
      await vi.advanceTimersByTimeAsync(180_000);
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "unknown",
      );
    } finally {
      env.session.close();
      release?.();
    }
  });
  it("shows unknown when a published preference cannot be confirmed and retries the snapshot", async () => {
    const env = setup();
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.fetcher.mockRejectedValueOnce(new Error("Confirmation unavailable"));
      await expect(env.session.setPreference("away")).rejects.toThrow(
        "Confirmation unavailable",
      );
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "unknown",
      );
      await vi.advanceTimersByTimeAsync(11_000);
      expect(env.state()?.status).toBe("ready");
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe("away");
    } finally {
      env.session.close();
    }
  });
  it("publishes on startup and each minute, keeps events ephemeral, and stops on disposal", async () => {
    const env = setup();
    try {
      await vi.advanceTimersByTimeAsync(10);
      expect(env.state()?.status).toBe("ready");
      expect(env.publish).toHaveBeenCalledTimes(1);
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "online",
      );
      expect(env.relay.events).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.publish).toHaveBeenCalledTimes(2);
      env.session.close();
      await vi.advanceTimersByTimeAsync(180_000);
      expect(env.publish).toHaveBeenCalledTimes(2);
    } finally {
      env.session.close();
    }
  });
  it("persists manual offline, stops heartbeats and resumes automatic presence", async () => {
    const env = setup();
    try {
      await vi.advanceTimersByTimeAsync(10);
      await env.session.setPreference("offline");
      expect(env.state()?.preference).toBe("offline");
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "offline",
      );
      const calls = env.publish.mock.calls.length;
      await vi.advanceTimersByTimeAsync(61_000);
      expect(env.publish).toHaveBeenCalledTimes(calls);
      await env.session.setPreference("auto");
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "online",
      );
    } finally {
      env.session.close();
    }
  });
  it("shows unknown on lookup failure and recovers without treating absence as offline", async () => {
    const env = setup();
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.fetcher.mockRejectedValueOnce(new Error("network unavailable"));
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.state()?.status).toBe("error");
      expect(env.state()?.members[getPublicKey(userKey)]?.status).toBe(
        "unknown",
      );
      await vi.advanceTimersByTimeAsync(11_000);
      expect(env.state()?.status).toBe("ready");
    } finally {
      env.session.close();
    }
  });
  it("does not repeatedly prompt after the signer refuses a heartbeat", async () => {
    const env = setup();
    try {
      await vi.advanceTimersByTimeAsync(10);
      env.signEvent.mockRejectedValueOnce(new Error("User rejected signing"));
      await vi.advanceTimersByTimeAsync(60_000);
      const calls = env.signEvent.mock.calls.length;
      await vi.advanceTimersByTimeAsync(300_000);
      expect(env.signEvent).toHaveBeenCalledTimes(calls);
      expect(env.state()?.status).toBe("error");
    } finally {
      env.session.close();
    }
  });
});

it("uses ten-minute idle detection and lets host idle override browser inactivity", () => {
  expect(automaticPresence(0, 599_999)).toBe("online");
  expect(automaticPresence(0, 600_000)).toBe("away");
  expect(automaticPresence(0, 600_000, 0)).toBe("online");
});

it("rejects forged aggregate subjects, expired updates and ambiguous tags", () => {
  const now = 1_700_000_000;
  const template = {
    kind: 20001,
    created_at: now,
    content: "online",
    tags: [
      ["p", getPublicKey(userKey)],
      ["presence-mode", "auto"],
      ["presence-revision", "1"],
      ["expiration", String(now + 180)],
    ],
  };
  expect(
    parsePresenceEvent(
      finalizeEvent(template, userKey),
      getPublicKey(relayKey),
      now,
    ),
  ).toBeUndefined();
  const valid = finalizeEvent(template, relayKey);
  expect(
    parsePresenceEvent(valid, getPublicKey(relayKey), now)?.entry.status,
  ).toBe("online");
  expect(
    parsePresenceEvent(valid, getPublicKey(relayKey), now + 180),
  ).toBeUndefined();
  expect(
    parsePresenceEvent(
      { ...valid, tags: [...valid.tags, ["p", getPublicKey(relayKey)]] },
      getPublicKey(relayKey),
      now,
    ),
  ).toBeUndefined();
});
