import type {
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";

export type { NostrEventTemplate } from "@lapismd/registry-protocol";

export interface RegistrySigner {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
  close?(): Promise<void>;
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
  close?(): Promise<void>;
}

export interface Nip55Permission {
  type: "sign_event";
  kind?: number;
}

export interface Nip55Connection {
  pubkey: string;
  packageName: string;
}

export interface Nip55Bridge {
  connect(permissions: readonly Nip55Permission[]): Promise<Nip55Connection>;
  signEvent(request: {
    packageName: string;
    pubkey: string;
    template: NostrEventTemplate;
  }): Promise<NostrEvent>;
  disconnect?(connection: Nip55Connection): Promise<void>;
}
