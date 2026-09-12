import type { CommunityIdentity } from "../../community/index.js";
import type {
  CommunityAccountSession,
  CommunityRelayAuthConfig,
  RelayAuthAccountResult,
  RelayAuthConnectResult,
  RelayCustodyTransferHandoff,
  RelayAuthRestoreResult,
} from "../../auth/index.js";
import type {
  CommunityLoginCredentials,
  CommunityLoginMethodModel,
} from "../community-login/model.js";

export interface CommunityApplicationLoginOptions {
  methods?: readonly CommunityLoginMethodModel[];
  allowLocalKeyMethods?: boolean;
  title?: string;
  description?: string;
  footnote?: string;
  connect?(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<CommunityIdentity>;
  auth?: CommunityApplicationAuthAdapter;
}

export interface CommunityApplicationAuthAdapter {
  restore(): Promise<RelayAuthRestoreResult>;
  connect(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<RelayAuthConnectResult>;
  signOut(): Promise<void>;
  connectGitHub(): Promise<void>;
  registerPasskey?(): Promise<RelayAuthAccountResult>;
  disconnectGitHub?(): Promise<RelayAuthAccountResult>;
  connectRemoteSigner?(bunkerUrl: string): Promise<RelayAuthAccountResult>;
  switchRemoteSignerRelays?(): Promise<readonly string[]>;
  disconnectRemoteSigner?(): Promise<RelayAuthAccountResult>;
  beginCustodyTransfer?(): Promise<RelayCustodyTransferHandoff>;
  completeCustodyTransfer?(
    handoff: RelayCustodyTransferHandoff,
    bunkerUrl: string,
  ): Promise<RelayAuthAccountResult>;
  onSessionExpired?(listener: () => void): () => void;
}

export type CommunityApplicationAuthenticationStatus =
  | "idle"
  | "restoring"
  | "anonymous"
  | "connected"
  | "reconnect-required"
  | "redirecting";

export interface CommunityApplicationAccountState {
  status: CommunityApplicationAuthenticationStatus;
  config?: CommunityRelayAuthConfig;
  session?: CommunityAccountSession;
}
