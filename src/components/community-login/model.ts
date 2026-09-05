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

export interface CommunityLoginCredentials {
  privateKey?: string;
  remoteSignerUrl?: string;
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
    description: "NIP-46 — connect with a bunker URL",
  },
  createAccount: {
    id: "create-account",
    kind: "create-account",
    label: "Create a new account",
    description: "Generate and back up a fresh Nostr key",
  },
  privateKey: {
    id: "private-key",
    kind: "private-key",
    label: "Paste a private key",
    description: "Import an existing nsec through a secure host flow",
  },
} as const satisfies Record<string, CommunityLoginMethodModel>;

export const DEFAULT_COMMUNITY_LOGIN_METHODS: readonly CommunityLoginMethodModel[] =
  [
    COMMUNITY_LOGIN_METHODS.browserExtension,
    COMMUNITY_LOGIN_METHODS.remoteSigner,
  ];

export function resolveCommunityLoginMethods(
  methods: readonly CommunityLoginMethodModel[] = DEFAULT_COMMUNITY_LOGIN_METHODS,
  allowLocalKeyMethods = false,
): readonly CommunityLoginMethodModel[] {
  const visible = methods.filter(
    (method) =>
      allowLocalKeyMethods ||
      (method.kind !== "create-account" && method.kind !== "private-key"),
  );
  if (!allowLocalKeyMethods || methods !== DEFAULT_COMMUNITY_LOGIN_METHODS)
    return visible;
  return [
    ...visible,
    COMMUNITY_LOGIN_METHODS.createAccount,
    COMMUNITY_LOGIN_METHODS.privateKey,
  ];
}
