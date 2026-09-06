import { Relay } from "nostr-tools/relay";
import type { Filter } from "nostr-tools/filter";
import { verifyEvent } from "nostr-tools/pure";
import { normalizeURL } from "nostr-tools/utils";

import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export type RelayFilter = Filter;

export interface RelayPublishResult {
  accepted: boolean;
  message: string;
}

export interface RelayCountResult {
  count: number;
  approximate: boolean;
  hyperLogLog?: string;
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
  countMany?(
    filters: readonly RelayFilter[],
    signal?: AbortSignal,
  ): Promise<RelayCountResult>;
  query(filter: RelayFilter, signal?: AbortSignal): Promise<NostrEvent[]>;
  publish(event: NostrEvent, signal?: AbortSignal): Promise<RelayPublishResult>;
  close(): void;
}

export interface CommunityRelaySubscription {
  close(reason?: string): void;
}

export interface CommunityRelaySubscriptionHandlers {
  onevent(event: NostrEvent): void;
  oneose?(): void;
  onclose?(reason: string): void;
}

export interface CommunityRelay extends RegistryRelay {
  subscribe(
    filter: RelayFilter,
    handlers: CommunityRelaySubscriptionHandlers,
    signal?: AbortSignal,
  ): Promise<CommunityRelaySubscription>;
}

export interface CommunityRelayFactory {
  create(url: string): CommunityRelay;
}

export interface WebSocketRelayOptions {
  authenticationRelayUrl?: string;
  connectTimeoutMs?: number;
  enableReconnect?: boolean;
  eoseTimeoutMs?: number;
  publishTimeoutMs?: number;
}

interface WebSocketRelayConnectionState {
  signer: RelayAuthSigner | undefined;
  connection: Promise<Relay> | undefined;
  authentication: Promise<string> | undefined;
  pubkey: string | undefined;
}

export class WebSocketRegistryRelay implements CommunityRelay {
  readonly url: string;
  readonly #connectTimeoutMs: number;
  readonly #eoseTimeoutMs: number;
  readonly #publishTimeoutMs: number;
  readonly #authenticationRelayUrl: string | undefined;
  readonly #enableReconnect: boolean;
  readonly #anonymousConnection: WebSocketRelayConnectionState = {
    signer: undefined,
    connection: undefined,
    authentication: undefined,
    pubkey: undefined,
  };
  readonly #authenticatedConnections = new WeakMap<
    RelayAuthSigner,
    WebSocketRelayConnectionState
  >();
  readonly #connectionStates = new Set<WebSocketRelayConnectionState>([
    this.#anonymousConnection,
  ]);
  #activeConnection = this.#anonymousConnection;
  #closed = false;

  constructor(url: string, options: WebSocketRelayOptions = {}) {
    this.url = url;
    this.#authenticationRelayUrl =
      options.authenticationRelayUrl === undefined
        ? undefined
        : normalizeURL(options.authenticationRelayUrl);
    this.#connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.#enableReconnect = options.enableReconnect ?? false;
    this.#eoseTimeoutMs = options.eoseTimeoutMs ?? 5_000;
    this.#publishTimeoutMs = options.publishTimeoutMs ?? 5_000;
  }

  async #connect(
    signal?: AbortSignal,
    state = this.#activeConnection,
  ): Promise<Relay> {
    signal?.throwIfAborted();
    if (this.#closed) throw new Error(`${this.url}: relay is closed`);
    state.connection ??= Relay.connect(this.url, {
      timeout: this.#connectTimeoutMs,
      ...(signal === undefined ? {} : { abort: signal }),
      enableReconnect: this.#enableReconnect,
    });

    try {
      const relay = await state.connection;
      relay.publishTimeout = this.#publishTimeoutMs;
      if (state.signer !== undefined) {
        await this.#authenticateConnection(relay, state, signal);
      }
      return relay;
    } catch (error) {
      state.connection = undefined;
      state.authentication = undefined;
      state.pubkey = undefined;
      throw error;
    }
  }

  async authenticate(
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    signal?.throwIfAborted();
    let state = this.#authenticatedConnections.get(signEvent);
    if (state === undefined) {
      state = {
        signer: signEvent,
        connection: undefined,
        authentication: undefined,
        pubkey: undefined,
      };
      this.#authenticatedConnections.set(signEvent, state);
      this.#connectionStates.add(state);
    }
    this.#activeConnection = state;
    const relay = await this.#connect(signal, state);
    const message = await this.#authenticateConnection(relay, state, signal);
    signal?.throwIfAborted();
    return { accepted: true, message };
  }

  async #authenticateConnection(
    relay: Relay,
    state: WebSocketRelayConnectionState,
    signal?: AbortSignal,
  ): Promise<string> {
    const signEvent = state.signer;
    if (signEvent === undefined) {
      throw new Error(`${this.url}: authenticated connection has no signer`);
    }
    state.authentication ??= this.#authenticateAfterChallenge(
      relay,
      signEvent,
      state,
      signal,
    );
    try {
      return await state.authentication;
    } catch (error) {
      state.authentication = undefined;
      state.pubkey = undefined;
      throw error;
    }
  }

  async #authenticateAfterChallenge(
    relay: Relay,
    signEvent: RelayAuthSigner,
    state: WebSocketRelayConnectionState,
    signal?: AbortSignal,
  ): Promise<string> {
    const expiresAt = Date.now() + this.#connectTimeoutMs;
    for (;;) {
      signal?.throwIfAborted();
      try {
        let pubkey = "";
        const message = await relay.auth(async (template) => {
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
          pubkey = event.pubkey;
          return event;
        });
        state.pubkey = pubkey;
        return message;
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
    signal?.throwIfAborted();
    const relay = await this.#connect(signal, this.#activeConnection);
    const queryFilter = { ...filter };

    return await new Promise<NostrEvent[]>((resolve, reject) => {
      const events: NostrEvent[] = [];
      let settled = false;
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };

      const subscription = relay.subscribe([queryFilter], {
        ...(signal === undefined ? {} : { abort: signal }),
        eoseTimeout: this.#eoseTimeoutMs,
        onevent: (event) => events.push(event),
        oneose: () =>
          settle(() => {
            subscription.close("complete");
            const ordered = events.toSorted(
              (left, right) =>
                right.created_at - left.created_at ||
                right.id.localeCompare(left.id),
            );
            resolve(ordered.slice(0, filter.limit ?? ordered.length));
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
    return (await this.countMany([filter], signal)).count;
  }

  async countMany(
    filters: readonly RelayFilter[],
    signal?: AbortSignal,
  ): Promise<RelayCountResult> {
    if (filters.length === 0) {
      throw new Error(`${this.url}: COUNT requires at least one filter`);
    }
    signal?.throwIfAborted();
    const state = this.#activeConnection;
    const relay = await this.#connect(signal, state);
    return await new Promise<RelayCountResult>((resolve, reject) => {
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
            state.connection = undefined;
            state.authentication = undefined;
            state.pubkey = undefined;
            reject(new Error(`${this.url}: COUNT timed out`));
          }),
        this.#eoseTimeoutMs,
      );
      void relay
        .countWithHLL([...filters], {})
        .then((payload) =>
          settle(() => {
            const response = payload as {
              count?: unknown;
              approximate?: unknown;
              hll?: unknown;
            };
            if (
              typeof response.count !== "number" ||
              !Number.isSafeInteger(response.count) ||
              response.count < 0
            ) {
              reject(new Error(`${this.url}: relay returned an invalid COUNT`));
              return;
            }
            resolve({
              count: response.count,
              approximate: response.approximate === true,
              ...(typeof response.hll === "string"
                ? { hyperLogLog: response.hll }
                : {}),
            });
          }),
        )
        .catch((cause: unknown) => settle(() => reject(cause)));
      signal?.addEventListener(
        "abort",
        () => settle(() => reject(signal.reason)),
        { once: true },
      );
    });
  }

  async subscribe(
    filter: RelayFilter,
    handlers: CommunityRelaySubscriptionHandlers,
    signal?: AbortSignal,
  ): Promise<CommunityRelaySubscription> {
    signal?.throwIfAborted();
    const relay = await this.#connect(signal, this.#activeConnection);
    const subscription = relay.subscribe([filter], {
      ...(signal === undefined ? {} : { abort: signal }),
      onevent: handlers.onevent,
      ...(handlers.oneose === undefined ? {} : { oneose: handlers.oneose }),
      ...(handlers.onclose === undefined ? {} : { onclose: handlers.onclose }),
    });
    const close = (reason = "closed"): void => subscription.close(reason);
    signal?.addEventListener("abort", () => close("aborted"), { once: true });
    return { close };
  }

  async publish(
    event: NostrEvent,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    signal?.throwIfAborted();
    const state =
      [...this.#connectionStates].find(
        (candidate) => candidate.pubkey === event.pubkey,
      ) ?? this.#activeConnection;
    const relay = await this.#connect(signal, state);
    const message = await relay.publish(event);
    signal?.throwIfAborted();
    return { accepted: true, message };
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const state of this.#connectionStates) {
      void state.connection
        ?.then((relay) => relay.close())
        .catch(() => undefined);
      state.connection = undefined;
      state.authentication = undefined;
      state.pubkey = undefined;
    }
  }
}

export interface WebSocketCommunityRelayFactoryOptions
  extends Omit<WebSocketRelayOptions, "authenticationRelayUrl"> {
  authenticationRelayUrl?:
    | string
    | ((relayUrl: string) => string | undefined)
    | undefined;
}

export function createWebSocketCommunityRelayFactory(
  options: WebSocketCommunityRelayFactoryOptions = {},
): CommunityRelayFactory {
  return {
    create(url) {
      const authenticationRelayUrl =
        typeof options.authenticationRelayUrl === "function"
          ? options.authenticationRelayUrl(url)
          : options.authenticationRelayUrl;
      return new WebSocketRegistryRelay(url, {
        ...(authenticationRelayUrl === undefined
          ? { authenticationRelayUrl: url }
          : { authenticationRelayUrl }),
        ...(options.connectTimeoutMs === undefined
          ? {}
          : { connectTimeoutMs: options.connectTimeoutMs }),
        enableReconnect: options.enableReconnect ?? true,
        ...(options.eoseTimeoutMs === undefined
          ? {}
          : { eoseTimeoutMs: options.eoseTimeoutMs }),
        ...(options.publishTimeoutMs === undefined
          ? {}
          : { publishTimeoutMs: options.publishTimeoutMs }),
      });
    },
  };
}
