import type { NostrEvent } from "@lapismd/registry-protocol";

export interface NostrEventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

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
