import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { v2 as nip44 } from "nostr-tools/nip44";

import { canonicalJson } from "../protocol/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import type {
  Nip07Provider,
  Nip44Provider,
  NostrEventTemplate,
  RegistrySigner,
} from "./types.js";

export class SecretKeyRegistrySigner implements RegistrySigner {
  readonly #secretKey: Uint8Array;
  readonly nip44: Nip44Provider;

  constructor(secretKey: Uint8Array) {
    if (secretKey.byteLength !== 32) {
      throw new Error("Nostr secret key must contain exactly 32 bytes");
    }
    this.#secretKey = secretKey.slice();
    this.nip44 = {
      encrypt: async (pubkey, plaintext) =>
        nip44.encrypt(
          plaintext,
          nip44.utils.getConversationKey(this.#secretKey, pubkey),
        ),
      decrypt: async (pubkey, ciphertext) =>
        nip44.decrypt(
          ciphertext,
          nip44.utils.getConversationKey(this.#secretKey, pubkey),
        ),
    };
  }

  async getPublicKey(): Promise<string> {
    return getPublicKey(this.#secretKey);
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    return finalizeEvent(template, this.#secretKey);
  }
}

export class Nip07RegistrySigner implements RegistrySigner {
  readonly #provider: Nip07Provider;
  readonly nip44: Nip44Provider | undefined;

  constructor(provider?: Nip07Provider) {
    const discovered = provider ?? globalThis.window?.nostr;
    if (discovered === undefined) {
      throw new Error("No NIP-07 window.nostr provider is available");
    }
    this.#provider = discovered;
    this.nip44 = discovered.nip44;
  }

  async getPublicKey(): Promise<string> {
    return await this.#provider.getPublicKey();
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const expectedPubkey = await this.getPublicKey();
    const event = await this.#provider.signEvent(template);
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
}

declare global {
  interface Window {
    nostr?: Nip07Provider;
  }
}
