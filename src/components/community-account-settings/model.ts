import type {
  CommunityAccountSession,
  CommunityGitHubStatus,
  CommunityRelayAuthConfig,
  RelayCustodyTransferHandoff,
} from "../../auth/index.js";

export type CommunityAccountModel = CommunityAccountSession;

export type CommunityAccountResumeAction = "register-passkey";

export type CommunityAccountAuthenticationState =
  | "idle"
  | "restoring"
  | "anonymous"
  | "connected"
  | "reconnect-required"
  | "redirecting";

export interface CommunityAccountManagementActions {
  copyPublicKey?(pubkey: string): void | Promise<void>;
  connectGitHub?(): void | Promise<void>;
  disconnectGitHub?(): void | Promise<void>;
  registerPasskey?(): void | Promise<void>;
  connectRemoteSigner?(bunkerUrl: string): void | Promise<void>;
  switchRemoteSignerRelays?(): Promise<readonly string[]>;
  disconnectRemoteSigner?(): void | Promise<void>;
  reconnectSigner?(): void | Promise<void>;
  beginCustodyTransfer?(): Promise<RelayCustodyTransferHandoff>;
  completeCustodyTransfer?(
    handoff: RelayCustodyTransferHandoff,
    bunkerUrl: string,
  ): void | Promise<void>;
  signOut?(): void | Promise<void>;
  clearResumeAction?(): void;
}

export function communityAccountCapability(
  config: CommunityRelayAuthConfig | undefined,
  capability: keyof CommunityRelayAuthConfig["capabilities"],
): boolean {
  return config === undefined || config.capabilities[capability] === true;
}

export interface CommunityAccountSignerDetails {
  label:
    | "Managed by Lapis"
    | "Remote signer"
    | "Browser/device signer"
    | "Migration pending"
    | "Unavailable";
  state: "active" | "pending" | "unavailable";
  description: string;
}

export function communityAccountSignerDetails(
  account: CommunityAccountSession,
  authenticationState?: CommunityAccountAuthenticationState,
): CommunityAccountSignerDetails {
  if (account.signer_status === "migration_pending") {
    return {
      label: "Migration pending",
      state: "pending",
      description: "This identity is waiting for its signing migration.",
    };
  }
  if (account.signer_status === "disabled") {
    return {
      label: "Unavailable",
      state: "unavailable",
      description: "This account does not currently have a usable signer.",
    };
  }
  if (account.signer_type === "managed") {
    return {
      label: "Managed by Lapis",
      state: "active",
      description: "The relay signs with this account's encrypted Nostr key.",
    };
  }
  if (account.signer_type === "nip46") {
    return {
      label: "Remote signer",
      state: "active",
      description:
        "The relay delegates signing to the connected NIP-46 signer.",
    };
  }
  if (authenticationState === "reconnect-required") {
    return {
      label: "Browser/device signer",
      state: "pending",
      description:
        "Reconnect this signer on this device before Community can sign events.",
    };
  }
  return {
    label: "Browser/device signer",
    state: "active",
    description:
      "Reconnect this signer on this device when Community needs a signature.",
  };
}

export function communityGitHubActionLabel(
  status: CommunityGitHubStatus,
): "Connect GitHub" | "Reconnect GitHub" | undefined {
  if (status === "active") return undefined;
  return status === "unlinked" ? "Connect GitHub" : "Reconnect GitHub";
}

export function formatCommunityAccountExpiry(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
