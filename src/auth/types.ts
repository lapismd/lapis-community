import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export type { NostrEventTemplate } from "../protocol/index.js";

export interface RegistrySigner {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
}

export interface Nip44Provider {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface CommunitySigner extends RegistrySigner {
  nip44?: Nip44Provider;
  dispose?(): void;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
  nip44?: Nip44Provider;
}
