import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export type { NostrEventTemplate } from "../protocol/index.js";

export interface RegistrySigner {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
}
