export type CommunityLoginMethodKind =
  | "browser-extension"
  | "remote-signer"
  | "create-account"
  | "private-key"
  | "other";

export interface CommunityLoginMethodModel {
  id: string;
  kind: CommunityLoginMethodKind;
  label: string;
  description: string;
  disabled?: boolean;
}

export const COMMUNITY_LOGIN_METHODS = {
  browserExtension: {
    id: "browser-extension",
    kind: "browser-extension",
    label: "Browser extension",
    description: "NIP-07 — Alby, nos2x, Flamingo",
  },
  remoteSigner: {
    id: "remote-signer",
    kind: "remote-signer",
    label: "Remote signer",
    description: "NIP-46 — Amber, Nsec.app",
  },
  createAccount: {
    id: "create-account",
    kind: "create-account",
    label: "Create a new account",
    description: "Generate a fresh keypair with your chosen key manager",
  },
  privateKey: {
    id: "private-key",
    kind: "private-key",
    label: "Use a private key",
    description: "Import an nsec through a host-provided secure flow",
  },
} as const satisfies Record<string, CommunityLoginMethodModel>;

export const DEFAULT_COMMUNITY_LOGIN_METHODS: readonly CommunityLoginMethodModel[] =
  [COMMUNITY_LOGIN_METHODS.browserExtension];
