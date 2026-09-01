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

export interface RegistryPrivateSigner extends RegistrySigner {
  nip44Encrypt(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface Nip07Provider {
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

export interface Nip46RpcClient {
  request(
    method: "get_public_key" | "nip44_decrypt" | "nip44_encrypt" | "sign_event",
    params: string[],
  ): Promise<string>;
  close?(): Promise<void>;
}

export type Nip55Permission =
  | { type: "nip44_decrypt" }
  | { type: "nip44_encrypt" }
  | { type: "sign_event"; kind?: number };

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
  nip44Encrypt?(request: {
    packageName: string;
    pubkey: string;
    recipientPubkey: string;
    plaintext: string;
  }): Promise<string>;
  nip44Decrypt?(request: {
    packageName: string;
    pubkey: string;
    senderPubkey: string;
    ciphertext: string;
  }): Promise<string>;
  disconnect?(connection: Nip55Connection): Promise<void>;
}
