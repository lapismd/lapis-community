import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  CommunityRelay,
  CommunityRelaySubscription,
} from "../nostr/index.js";
import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type { CommunityIdentity } from "./contracts.js";
import { verifiedNostrEvent } from "./verified-events.js";
import {
  automaticPresence,
  parsePresenceEvent,
  type CommunityPresencePreference,
  type CommunityPresenceSession,
  type CommunityPresenceState,
} from "./presence-contracts.js";

export interface PresenceSessionOptions {
  relay: CommunityRelay;
  identity: CommunityIdentity;
  authenticate(signal?: AbortSignal): Promise<void>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

export function createCommunityPresenceSession(
  options: PresenceSessionOptions,
): CommunityPresenceSession {
  return new PresenceSession(options);
}

class PresenceSession implements CommunityPresenceSession {
  #options: PresenceSessionOptions;
  #abort = new AbortController();
  #state: CommunityPresenceState = {
    status: "loading",
    members: {},
    preference: "auto",
    pending: false,
  };
  #listener: ((state: CommunityPresenceState) => void) | undefined;
  #self = "";
  #relayKey = "";
  #watched: string[] = [];
  #subscriptions: CommunityRelaySubscription[] = [];
  #timer: ReturnType<typeof setInterval> | undefined;
  #lastActivity: number;
  #lastHeartbeat = 0;
  #lastSnapshot = 0;
  #lastStatus = "";
  #sequence = 0;
  #busy = false;
  #signingDenied = false;
  #dirty = true;
  #generation = 0;
  #idleSeconds: (() => Promise<number | null>) | undefined;
  #removeActivity: (() => void) | undefined;
  #signQueue: Promise<unknown> = Promise.resolve();

  constructor(options: PresenceSessionOptions) {
    this.#options = options;
    this.#lastActivity = this.#now();
  }

  #now() {
    return (this.#options.now ?? Date.now)();
  }
  #emit(patch: Partial<CommunityPresenceState>) {
    if (this.#abort.signal.aborted) return;
    this.#state = { ...this.#state, ...patch };
    this.#listener?.(this.#state);
  }
  #url() {
    const url = new URL(this.#options.relay.url);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.hash = "";
    url.search = "";
    return url;
  }
  #signal() {
    return AbortSignal.any([this.#abort.signal, AbortSignal.timeout(10_000)]);
  }

  start(
    listener: (state: CommunityPresenceState) => void,
    idleSeconds?: () => Promise<number | null>,
  ) {
    if (this.#listener || this.#abort.signal.aborted) return;
    this.#listener = listener;
    this.#idleSeconds = idleSeconds;
    listener(this.#state);
    if (typeof window !== "undefined") {
      const activity = () => {
        if (this.#now() - this.#lastActivity < 1000) return;
        this.#lastActivity = this.#now();
        void this.#tick();
      };
      const resume = () => {
        this.#dirty = true;
        void this.#tick();
      };
      const events = [
        "pointerdown",
        "pointermove",
        "wheel",
        "keydown",
      ] as const;
      for (const event of events)
        window.addEventListener(event, activity, { passive: true });
      window.addEventListener("online", resume);
      window.addEventListener("pageshow", resume);
      this.#removeActivity = () => {
        for (const event of events) window.removeEventListener(event, activity);
        window.removeEventListener("online", resume);
        window.removeEventListener("pageshow", resume);
      };
    }
    this.#timer = setInterval(() => void this.#tick(), 1000);
    void this.#tick();
  }

  watch(pubkeys: readonly string[]) {
    const keys = [
      ...new Set(pubkeys.filter((key) => /^[a-f0-9]{64}$/.test(key))),
    ].sort();
    if (keys.join() === this.#watched.join()) return;
    this.#watched = keys;
    this.#dirty = true;
    this.#generation++;
    void this.#tick();
  }

  async #sign(template: NostrEventTemplate): Promise<NostrEvent> {
    const run = this.#signQueue.then(async () => {
      this.#abort.signal.throwIfAborted();
      let event: NostrEvent;
      try {
        event = await this.#options.identity.signEvent(template);
      } catch (error) {
        this.#signingDenied = true;
        throw error;
      }
      this.#abort.signal.throwIfAborted();
      if (
        !verifiedNostrEvent(event) ||
        event.pubkey !== this.#self ||
        event.kind !== template.kind ||
        event.created_at !== template.created_at ||
        event.content !== template.content ||
        JSON.stringify(event.tags) !== JSON.stringify(template.tags)
      )
        throw new Error("Signer returned invalid presence data");
      return event;
    });
    this.#signQueue = run.catch(() => undefined);
    return run;
  }

  async #discover() {
    this.#self = await this.#options.identity.getPublicKey();
    const response = await (this.#options.fetch ?? fetch)(this.#url(), {
      headers: { Accept: "application/nostr+json" },
      signal: this.#signal(),
    });
    if (!response.ok) throw new Error("Presence capability lookup failed");
    const info = (await response.json()) as {
      self?: string;
      lapis_presence?: { version?: number };
    };
    if (
      !info.self ||
      !/^[a-f0-9]{64}$/.test(info.self) ||
      info.lapis_presence?.version !== 1
    ) {
      this.#emit({ status: "unavailable", members: {} });
      return false;
    }
    this.#relayKey = info.self;
    await this.#options.authenticate(this.#abort.signal);
    return true;
  }

  #accept(event: NostrEvent, allowed: Set<string>) {
    if (!verifiedNostrEvent(event))
      throw new Error("Invalid presence signature");
    const parsed = parsePresenceEvent(
      event,
      this.#relayKey,
      Math.floor(this.#now() / 1000),
    );
    if (!parsed || !allowed.has(parsed.pubkey))
      throw new Error("Invalid presence snapshot");
    const old = this.#state.members[parsed.pubkey];
    if (
      old &&
      (old.revision > parsed.entry.revision ||
        (old.revision === parsed.entry.revision &&
          old.observedAt > parsed.entry.observedAt))
    )
      return;
    this.#emit({
      members: { ...this.#state.members, [parsed.pubkey]: parsed.entry },
      ...(parsed.pubkey === this.#self
        ? { preference: parsed.entry.preference }
        : {}),
    });
  }

  async #snapshot() {
    const generation = this.#generation;
    const keys = [...new Set([this.#self, ...this.#watched])];
    const allowed = new Set(keys);
    const next: CommunityRelaySubscription[] = [];
    try {
      for (let i = 0; i < keys.length; i += 200) {
        const chunk = keys.slice(i, i + 200);
        let active = true;
        let seeded = false;
        const subscription = await this.#options.relay.subscribe(
          { kinds: [20001], authors: [this.#relayKey], "#p": chunk },
          {
            onevent: (event) => {
              if (!active) return;
              try {
                this.#accept(event, allowed);
              } catch {
                /* Untrusted live events cannot change presence. */
              }
            },
            onclose: () => {
              if (active) {
                this.#dirty = true;
                this.#unknown("Presence connection interrupted");
              }
            },
            oneose: () => {
              if (active && seeded) {
                this.#dirty = true;
                this.#lastHeartbeat = 0;
              }
              seeded = true;
            },
          },
          this.#abort.signal,
        );
        next.push({
          close: () => {
            active = false;
            subscription.close();
          },
        });
        const url = new URL("/query", this.#url());
        const body = JSON.stringify([{ kinds: [40902], authors: chunk }]);
        const auth = await this.#sign({
          kind: 27235,
          created_at: Math.floor(this.#now() / 1000),
          content: "",
          tags: [
            ["u", url.toString()],
            ["method", "POST"],
            ["payload", bytesToHex(sha256(new TextEncoder().encode(body)))],
            ["nonce", crypto.randomUUID()],
          ],
        });
        const response = await (this.#options.fetch ?? fetch)(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: encodeNostrHttpAuthorization(auth),
          },
          body,
          signal: this.#signal(),
        });
        if (!response.ok) throw new Error("Presence lookup failed");
        const events: unknown = await response.json();
        if (!Array.isArray(events) || events.length !== chunk.length)
          throw new Error("Incomplete presence snapshot");
        const subjects = new Set<string>();
        for (const value of events) {
          const event = value as NostrEvent;
          const parsed = parsePresenceEvent(
            event,
            this.#relayKey,
            Math.floor(this.#now() / 1000),
          );
          if (
            !parsed ||
            !chunk.includes(parsed.pubkey) ||
            subjects.has(parsed.pubkey) ||
            !verifiedNostrEvent(event)
          )
            throw new Error("Invalid presence snapshot");
          subjects.add(parsed.pubkey);
        }
        if (generation !== this.#generation || this.#abort.signal.aborted)
          return;
        for (const event of events as NostrEvent[])
          this.#accept(event, allowed);
      }
      const old = this.#subscriptions;
      this.#subscriptions = next.splice(0);
      for (const sub of old) sub.close();
      this.#emit({
        status: "ready",
        error: undefined,
        members: Object.fromEntries(
          Object.entries(this.#state.members).filter(([key]) =>
            allowed.has(key),
          ),
        ),
      });
      this.#dirty = generation !== this.#generation;
      this.#lastSnapshot = this.#now();
    } finally {
      for (const sub of next) sub.close();
    }
  }

  #unknown(message: string) {
    this.#emit({
      status: "error",
      error: message,
      members: Object.fromEntries(
        Object.entries(this.#state.members).map(([key, entry]) => [
          key,
          { ...entry, status: "unknown" as const },
        ]),
      ),
    });
  }

  async #publish(mode?: CommunityPresencePreference) {
    const preference = mode ?? this.#state.preference;
    const idle = this.#idleSeconds
      ? await this.#idleSeconds().catch(() => null)
      : null;
    const status =
      preference === "auto"
        ? automaticPresence(this.#lastActivity, this.#now(), idle)
        : preference;
    if (mode === undefined && status === "offline") return;
    if (
      mode === undefined &&
      status === this.#lastStatus &&
      this.#now() - this.#lastHeartbeat < 60_000
    )
      return;
    this.#sequence = Math.max(this.#sequence + 1, this.#now());
    const tags = [["presence-sequence", String(this.#sequence)]];
    if (mode !== undefined) tags.push(["presence-mode", mode]);
    const event = await this.#sign({
      kind: 20001,
      created_at: Math.floor(this.#now() / 1000),
      content: status,
      tags,
    });
    const result = await this.#options.relay.publish(event, this.#abort.signal);
    if (!result.accepted)
      throw new Error(result.message || "Presence update rejected");
    this.#lastStatus = status;
    this.#lastHeartbeat = this.#now();
  }

  async #tick() {
    if (
      !this.#listener ||
      this.#abort.signal.aborted ||
      this.#state.status === "unavailable"
    )
      return;
    // Confidence expires even while a signer or network request is pending.
    if (
      Object.values(this.#state.members).some(
        (entry) =>
          entry.status !== "unknown" &&
          entry.expiresAt <= Math.floor(this.#now() / 1000),
      )
    ) {
      this.#unknown("Presence is refreshing");
    }
    if (this.#busy || this.#state.pending || this.#signingDenied) return;
    if (
      this.#state.status === "error" &&
      this.#now() - this.#lastSnapshot < 10_000
    )
      return;
    this.#busy = true;
    try {
      if (!this.#relayKey && !(await this.#discover())) return;
      const expired = Object.values(this.#state.members).some(
        (entry) => entry.expiresAt <= Math.floor(this.#now() / 1000),
      );
      if (expired) this.#unknown("Presence is refreshing");
      if (this.#dirty || expired || this.#now() - this.#lastSnapshot >= 60_000)
        await this.#snapshot();
      if (this.#state.status === "ready") await this.#publish();
    } catch (error) {
      if (!this.#abort.signal.aborted) {
        this.#lastSnapshot = this.#now();
        this.#dirty = true;
        this.#unknown(
          error instanceof Error ? error.message : "Presence unavailable",
        );
      }
    } finally {
      this.#busy = false;
    }
  }

  async setPreference(preference: CommunityPresencePreference) {
    if (this.#state.status === "unavailable" || !this.#relayKey)
      throw new Error("Presence is unavailable on this relay");
    if (this.#state.pending || this.#busy)
      throw new Error("Presence is updating; try again");
    this.#emit({ pending: true, error: undefined });
    this.#signingDenied = false;
    if (preference === "auto") this.#lastActivity = this.#now();
    let published = false;
    try {
      await this.#publish(preference);
      published = true;
      await this.#snapshot();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Presence update failed";
      if (published) {
        this.#dirty = true;
        this.#lastSnapshot = this.#now();
        this.#unknown(message);
      } else this.#emit({ error: message });
      throw error;
    } finally {
      this.#emit({ pending: false });
    }
  }

  close() {
    this.#abort.abort();
    if (this.#timer) clearInterval(this.#timer);
    this.#removeActivity?.();
    for (const sub of this.#subscriptions) sub.close();
    this.#subscriptions = [];
    this.#listener = undefined;
  }
}
