import type {
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";

export type { NostrEventTemplate } from "@lapismd/registry-protocol";

export interface RegistrySigner {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
}

export interface Nip46RpcClient {
  request(
    method: "get_public_key" | "sign_event",
    params: string[],
  ): Promise<string>;
}
