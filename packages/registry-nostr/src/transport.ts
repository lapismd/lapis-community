import { Relay } from "nostr-tools/relay";
import type { Filter } from "nostr-tools/filter";
import { verifyEvent } from "nostr-tools/pure";
import { normalizeURL } from "nostr-tools/utils";

import type {
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";

export type RelayFilter = Filter;

export interface RelayPublishResult {
  accepted: boolean;
  message: string;
}

export type RelayAuthSigner = (
  template: NostrEventTemplate,
) => Promise<NostrEvent>;

export interface RegistryRelay {
  readonly url: string;
  authenticate?(
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult>;
  count?(filter: RelayFilter, signal?: AbortSignal): Promise<number>;
  query(filter: RelayFilter, signal?: AbortSignal): Promise<NostrEvent[]>;
  publish(event: NostrEvent, signal?: AbortSignal): Promise<RelayPublishResult>;
  close(): void;
}

export interface WebSocketRelayOptions {
  authenticationRelayUrl?: string;
  connectTimeoutMs?: number;
  eoseTimeoutMs?: number;
  publishTimeoutMs?: number;
}

export class WebSocketRegistryRelay implements RegistryRelay {
  readonly url: string;
  readonly #connectTimeoutMs: number;
  readonly #eoseTimeoutMs: number;
  readonly #publishTimeoutMs: number;
  readonly #authenticationRelayUrl: string | undefined;
  #connection: Promise<Relay> | undefined;
  #authSigner: RelayAuthSigner | undefined;
  #authentication: Promise<string> | undefined;

  constructor(url: string, options: WebSocketRelayOptions = {}) {
    this.url = url;
    this.#authenticationRelayUrl =
      options.authenticationRelayUrl === undefined
        ? undefined
        : normalizeURL(options.authenticationRelayUrl);
    this.#connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.#eoseTimeoutMs = options.eoseTimeoutMs ?? 5_000;
    this.#publishTimeoutMs = options.publishTimeoutMs ?? 5_000;
  }

  async #connect(signal?: AbortSignal): Promise<Relay> {
    this.#connection ??= Relay.connect(this.url, {
      timeout: this.#connectTimeoutMs,
      ...(signal === undefined ? {} : { abort: signal }),
      enableReconnect: false,
    });

    try {
      const relay = await this.#connection;
      relay.publishTimeout = this.#publishTimeoutMs;
      if (this.#authSigner !== undefined) {
        await this.#authenticateConnection(relay, this.#authSigner, signal);
      }
      return relay;
    } catch (error) {
      this.#connection = undefined;
      throw error;
    }
  }

  async authenticate(
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    signal?.throwIfAborted();
    if (this.#authSigner !== signEvent) {
      this.#authSigner = signEvent;
      this.#authentication = undefined;
    }
    const relay = await this.#connect(signal);
    const message = await this.#authenticateConnection(
      relay,
      signEvent,
      signal,
    );
    signal?.throwIfAborted();
    return { accepted: true, message };
  }

  async #authenticateConnection(
    relay: Relay,
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<string> {
    this.#authentication ??= this.#authenticateAfterChallenge(
      relay,
      signEvent,
      signal,
    );
    try {
      return await this.#authentication;
    } catch (error) {
      this.#authentication = undefined;
      throw error;
    }
  }

  async #authenticateAfterChallenge(
    relay: Relay,
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<string> {
    const expiresAt = Date.now() + this.#connectTimeoutMs;
    for (;;) {
      signal?.throwIfAborted();
      try {
        return await relay.auth(async (template) => {
          const requestedTemplate =
            this.#authenticationRelayUrl === undefined
              ? template
              : {
                  ...template,
                  tags: template.tags.map((tag) =>
                    tag[0] === "relay"
                      ? ["relay", this.#authenticationRelayUrl!]
                      : [...tag],
                  ),
                };
          const event = await signEvent(requestedTemplate);
          if (!verifyEvent(event)) {
            throw new Error("NIP-42 signer returned an invalid event");
          }
          return event;
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "can't perform auth, no challenge was received" ||
          Date.now() >= expiresAt
        ) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  async query(
    filter: RelayFilter,
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const relay = await this.#connect(signal);

    return await new Promise<NostrEvent[]>((resolve, reject) => {
      const events: NostrEvent[] = [];
      let settled = false;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };

      const subscription = relay.subscribe([filter], {
        ...(signal === undefined ? {} : { abort: signal }),
        eoseTimeout: this.#eoseTimeoutMs,
        onevent: (event) => events.push(event),
        oneose: () =>
          settle(() => {
            subscription.close("complete");
            resolve(events);
          }),
        onclose: (reason) =>
          settle(() => reject(new Error(`${this.url}: ${reason}`))),
      });

      if (signal !== undefined) {
        signal.addEventListener(
          "abort",
          () =>
            settle(() => {
              subscription.close("aborted");
              reject(signal.reason);
            }),
          { once: true },
        );
      }
    });
  }

  async count(filter: RelayFilter, signal?: AbortSignal): Promise<number> {
    signal?.throwIfAborted();
    const relay = await this.#connect(signal);
    return await new Promise<number>((resolve, reject) => {
      let settled = false;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        callback();
      };
      const timeout = setTimeout(
        () =>
          settle(() => {
            relay.close();
            this.#connection = undefined;
            reject(new Error(`${this.url}: COUNT timed out`));
          }),
        this.#eoseTimeoutMs,
      );
      void relay
        .count([filter], {})
        .then((count) => settle(() => resolve(count)))
        .catch((cause: unknown) => settle(() => reject(cause)));
      signal?.addEventListener(
        "abort",
        () => settle(() => reject(signal.reason)),
        { once: true },
      );
    });
  }

  async publish(
    event: NostrEvent,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    signal?.throwIfAborted();
    const relay = await this.#connect(signal);
    const message = await relay.publish(event);
    signal?.throwIfAborted();
    return { accepted: true, message };
  }

  close(): void {
    void this.#connection
      ?.then((relay) => relay.close())
      .catch(() => undefined);
    this.#connection = undefined;
    this.#authentication = undefined;
  }
}
