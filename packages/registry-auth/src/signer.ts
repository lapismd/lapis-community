import { verifyEvent } from "nostr-tools/pure";

import { canonicalJson } from "@lapismd/registry-protocol";
import type { JsonValue, NostrEvent } from "@lapismd/registry-protocol";

import type {
  Nip07Provider,
  Nip46RpcClient,
  NostrEventTemplate,
  RegistrySigner,
} from "./types.js";

function assertSignedTemplate(
  template: NostrEventTemplate,
  event: NostrEvent,
  expectedPubkey: string,
): NostrEvent {
  if (
    event.pubkey !== expectedPubkey ||
    event.kind !== template.kind ||
    event.created_at !== template.created_at ||
    event.content !== template.content ||
    canonicalJson(event.tags as unknown as JsonValue) !==
      canonicalJson(template.tags as unknown as JsonValue) ||
    !verifyEvent(event)
  ) {
    throw new Error(
      "Signer returned an event that does not match the requested template",
    );
  }
  return event;
}

export class Nip07RegistrySigner implements RegistrySigner {
  readonly #provider: Nip07Provider;

  constructor(provider?: Nip07Provider) {
    const discovered = provider ?? globalThis.window?.nostr;
    if (discovered === undefined) {
      throw new Error("No NIP-07 window.nostr provider is available");
    }
    this.#provider = discovered;
  }

  async getPublicKey(): Promise<string> {
    return await this.#provider.getPublicKey();
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    return assertSignedTemplate(
      template,
      await this.#provider.signEvent(template),
      expectedPubkey,
    );
  }
}

export class Nip46RegistrySigner implements RegistrySigner {
  readonly #rpc: Nip46RpcClient;

  constructor(rpc: Nip46RpcClient) {
    this.#rpc = rpc;
  }

  async getPublicKey(): Promise<string> {
    return await this.#rpc.request("get_public_key", []);
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    const result = await this.#rpc.request("sign_event", [
      JSON.stringify(template),
    ]);
    return assertSignedTemplate(
      template,
      JSON.parse(result) as NostrEvent,
      expectedPubkey,
    );
  }
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}
