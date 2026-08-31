import { Relay } from "nostr-tools/relay";
import type { Filter } from "nostr-tools/filter";

import type { NostrEvent } from "@lapismd/registry-protocol";

export type RelayFilter = Filter;

export interface RelayPublishResult {
  accepted: boolean;
  message: string;
}

export interface RegistryRelay {
  readonly url: string;
  query(filter: RelayFilter, signal?: AbortSignal): Promise<NostrEvent[]>;
  publish(event: NostrEvent, signal?: AbortSignal): Promise<RelayPublishResult>;
  close(): void;
}

export interface WebSocketRelayOptions {
  connectTimeoutMs?: number;
  eoseTimeoutMs?: number;
}

export class WebSocketRegistryRelay implements RegistryRelay {
  readonly url: string;
  readonly #connectTimeoutMs: number;
  readonly #eoseTimeoutMs: number;
  #connection: Promise<Relay> | undefined;

  constructor(url: string, options: WebSocketRelayOptions = {}) {
    this.url = url;
    this.#connectTimeoutMs = options.connectTimeoutMs ?? 5_000;
    this.#eoseTimeoutMs = options.eoseTimeoutMs ?? 5_000;
  }

  async #connect(signal?: AbortSignal): Promise<Relay> {
    this.#connection ??= Relay.connect(this.url, {
      timeout: this.#connectTimeoutMs,
      ...(signal === undefined ? {} : { abort: signal }),
      enableReconnect: false,
    });

    try {
      return await this.#connection;
    } catch (error) {
      this.#connection = undefined;
      throw error;
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
        oneose: () => settle(() => resolve(events)),
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
  }
}
