export type CommunityLoginMethodKind =
  | "github"
  | "google"
  | "keytr"
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
  keytr?: {
    gateways: readonly {
      id: string;
      label: string;
      rpId: string;
    }[];
    allowSetup?: boolean;
    allowImport?: boolean;
    defaultPasskeyLabel?: string;
  };
}

export interface CommunityLoginCredentials {
  privateKey?: string;
  remoteSignerUrl?: string;
  keytr?: {
    action: "login" | "create" | "import";
    gatewayId: string;
    passkeyLabel?: string;
    privateKey?: string;
  };
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
  keytr: {
    id: "keytr",
    kind: "keytr",
    label: "Continue with Keytr",
    description: "Use a passkey-protected Nostr key",
    keytr: {
      gateways: [{ id: "keytr.org", label: "Keytr", rpId: "keytr.org" }],
      allowSetup: true,
      allowImport: false,
      defaultPasskeyLabel: "Lapis Community",
    },
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
  const providerMethods = [
    ...(providers.includes("github") ? [COMMUNITY_LOGIN_METHODS.github] : []),
    ...(providers.includes("google") ? [COMMUNITY_LOGIN_METHODS.google] : []),
  ];
  const providerIds = new Set<string>(
    providerMethods.map((method) => method.id),
  );
  const configuredProviderMethods = nostrMethods.filter(
    (method) =>
      (method.kind === "github" || method.kind === "google") &&
      !providerIds.has(method.id),
  );
  const keytrMethods = nostrMethods.filter((method) => method.kind === "keytr");
  const otherNostrMethods = nostrMethods.filter(
    (method) =>
      method.kind !== "keytr" &&
      method.kind !== "github" &&
      method.kind !== "google",
  );
  return [
    ...providerMethods,
    ...configuredProviderMethods,
    ...keytrMethods,
    ...otherNostrMethods,
  ];
}
