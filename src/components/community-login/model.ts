export type CommunityLoginMethodKind =
  | "github"
  | "google"
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
  github: {
    id: "github",
    kind: "github",
    label: "Continue with GitHub",
    description: "Sign in and use your GitHub identity for Forge actions",
  },
  google: {
    id: "google",
    kind: "google",
    label: "Continue with Google",
    description: "Create or restore a managed Nostr identity",
  },
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
  providers: readonly ("github" | "google")[] = [],
): readonly CommunityLoginMethodModel[] {
  const visible = methods.filter(
    (method) =>
      allowLocalKeyMethods ||
      (method.kind !== "create-account" && method.kind !== "private-key"),
  );
  const nostrMethods =
    !allowLocalKeyMethods || methods !== DEFAULT_COMMUNITY_LOGIN_METHODS
      ? visible
      : [
          ...visible,
          COMMUNITY_LOGIN_METHODS.createAccount,
          COMMUNITY_LOGIN_METHODS.privateKey,
        ];
  return [
    ...(providers.includes("github") ? [COMMUNITY_LOGIN_METHODS.github] : []),
    ...(providers.includes("google") ? [COMMUNITY_LOGIN_METHODS.google] : []),
    ...nostrMethods,
  ];
}
