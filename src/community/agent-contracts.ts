import type { AgentActivityFreshnessState } from "./activity-freshness.js";
import type { CommunityAgentPermissionRequest } from "./agent-permission-contracts.js";
import type { AgentPermissionNotice } from "./agent-permission-notices.js";
import type {
  AgentTurnActions,
  AgentTurnControlState,
  ContinueTurnControl,
} from "./agent-turn-control-contracts.js";
import type { CommunityAgentControllerScope } from "./agent-controller-scope.js";
import type { NostrEvent } from "../protocol/index.js";
import type { CommunityStorageMode } from "./contracts.js";

export type CommunityAgentNameMode = "inherited" | "instance";

export interface CommunityAgentPersona {
  ownerPubkey: string;
  slug: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  systemPrompt?: string;
  /** Unknown NIP-AP fields are retained when the owner edits presentation. */
  content: Readonly<Record<string, unknown>>;
  event: NostrEvent;
}

export interface CommunityAgentInstance {
  dmAllowlist?: readonly string[];
  agentPubkey: string;
  personaId?: string;
  name: string;
  nameMode: CommunityAgentNameMode;
  event: NostrEvent;
}

export interface CommunityAgentPersonaSaveInput {
  personaSlug: string;
  displayName: string;
  description?: string;
  avatarUrl?: string;
  systemPrompt?: string;
}

export interface CommunityAgentSaveInput
  extends CommunityAgentPersonaSaveInput {
  pubkey: string;
  nameMode: CommunityAgentNameMode;
  instanceName?: string;
  dmAllowlist?: readonly string[];
}

export interface CommunityAgentSaveResult {
  persona: NostrEvent;
  instance?: NostrEvent;
}

export interface CommunityAgentIdentity {
  pubkey: string;
  ownerPubkey: string;
  name: string;
  about: string;
  avatarUrl?: string;
  agentType: string;
  channelIds: readonly string[];
  followed: boolean;
  persona?: CommunityAgentPersona;
  instance?: CommunityAgentInstance;
  personaStatus: "none" | "linked" | "unresolved";
  /** Signed ownership provenance, never an unsigned directory claim. */
  profile: NostrEvent;
  custody?: CommunityManagedAgentCustody;
}

export interface CommunityManagedAgentCapability {
  version: 1;
  provisioningUrl: string;
  bunkerUrl: string;
  relayPubkey: string;
  authorizationType: "lapis-managed-v1";
}

export interface CommunityManagedAgentCustody {
  kind: "relay-managed";
  state: "pending" | "active" | "revoked";
  connectionState: "none" | "pending" | "active" | "replacement_pending";
  expiresAt: string;
  activatedAt?: string;
}

export interface CommunityManagedAgentCreateInput
  extends CommunityAgentPersonaSaveInput {
  nameMode: CommunityAgentNameMode;
  instanceName?: string;
  groupIds?: readonly string[];
}

export interface CommunityAgentControllerBootstrap {
  schema: "lapis.agent-controller-bootstrap/1";
  relay: { url: string; pubkey: string; id: string };
  agent: {
    id: string;
    pubkey: string;
    ownerPubkey: string;
    persona: string;
    prompt: string;
  };
  ownerAuthorization: {
    kind: "lapis-managed-v1";
    relayPubkey: string;
  };
  signer: {
    id: string;
    kind: "nip46";
    bunkerUrlEnv: string;
    clientSecretEnv: string;
  };
  environment: Record<string, string>;
  confirmedGroups: string[];
  controllerDefaults: { respondTo: "members"; enabled: true };
  requiredLocalChoices: {
    hostId: null;
    runtimeAgent: null;
    remainingGroups: string[];
  };
  custody: { state: "active"; invitationExpiresAt: string };
}

export interface CommunityAgentCapabilities {
  directory: boolean;
  presence: boolean;
  activity: boolean;
  managedAgents?: CommunityManagedAgentCapability;
}

export interface CommunityAgentDirectory {
  publicAgents?: readonly CommunityAgentIdentity[];
  agents: readonly CommunityAgentIdentity[];
  personas: readonly CommunityAgentPersona[];
  events: readonly NostrEvent[];
  relayPubkey: string;
  capabilities: CommunityAgentCapabilities;
  partial: boolean;
  reason?: string;
}

export interface CommunityAgentPresence {
  status: "online" | "unknown";
  updatedAt?: number;
  expiresAt?: number;
}

/** Buzz ObserverEvent payload. ACP data remains untrusted display content. */
export interface CommunityAgentObserver {
  version: 2;
  seq: number;
  streamId?: string;
  timestamp: string;
  kind: string;
  agentIndex?: number | null;
  channelId?: string | null;
  sessionId?: string | null;
  turnId?: string | null;
  startedAt?: string;
  payload: unknown;
}

export interface CommunityAgentSession {
  loadDirectory(signal?: AbortSignal): Promise<CommunityAgentDirectory>;
  loadPresence(
    pubkeys: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]>;
  subscribe(
    pubkeys: readonly string[],
    handlers: {
      onevent(event: NostrEvent, origin?: "live" | "replay"): void;
      onclose(reason: string): void;
    },
    signal?: AbortSignal,
  ): Promise<{ close(): void }>;
  setFollow(
    pubkey: string,
    following: boolean,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
  registerAgent?(pubkey: string, signal?: AbortSignal): Promise<NostrEvent>;
  savePersona?(
    input: CommunityAgentPersonaSaveInput,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
  saveAgent?(
    input: CommunityAgentSaveInput,
    signal?: AbortSignal,
  ): Promise<CommunityAgentSaveResult>;
  unlinkAgent?(
    pubkey: string,
    fallbackName: string,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
  deletePersona?(slug: string, signal?: AbortSignal): Promise<NostrEvent>;
  createManagedAgent?(
    input: CommunityManagedAgentCreateInput,
    signal?: AbortSignal,
  ): Promise<CommunityAgentControllerBootstrap>;
  clearManagedAgentDraft?(): void;
  createManagedAgentReplacement?(
    pubkey: string,
    signal?: AbortSignal,
  ): Promise<CommunityAgentControllerBootstrap>;
  revokeManagedAgent?(pubkey: string, signal?: AbortSignal): Promise<void>;
  deleteManagedAgent?(pubkey: string, signal?: AbortSignal): Promise<void>;
  sendControl?(
    agentPubkey: string,
    control: CommunityAgentControl,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
}

export type CommunityAgentPermissionDecision =
  | "allow_once"
  | "allow_always"
  | "reject_once"
  | "reject_always"
  | "cancel";

export type CommunityAgentControl =
  | ContinueTurnControl
  | { version: 2; command: "processing_get"; requestId: string }
  | {
      version: 2;
      command: "processing_set";
      requestId: string;
      enabled: boolean;
      expectedRevision: number;
    }
  | {
      version: 1;
      command: "cancel_turn";
      scopeKey: string;
      expectedSessionId?: string;
      expectedTurnId?: string;
      channelId?: string;
    }
  | {
      version: 1;
      command: "reset_conversation";
      expectedSessionId?: string;
      expectedTurnId?: string;
      scopeKey: string;
      channelId?: string;
    }
  | {
      version: 1;
      command: "permission_response";
      requestId: string;
      decision: CommunityAgentPermissionDecision;
      channelId?: string;
    }
  | {
      version: 2;
      command: "sync_activity";
      requestId: string;
      context: CommunityAgentActivitySyncContext;
      cursor?: { streamId: string; offset: number };
      highWaterMark?: number;
      notBefore?: number;
      channelId?: string;
    }
  | {
      version: 2;
      command: "runtime_get";
      requestId: string;
    }
  | CommunityAgentRuntimeSetControl
  | {
      version: 2;
      command: "memory_list";
      requestId: string;
      channelId: string;
      status?: "approved" | "review" | "rejected" | "retracted";
      query?: string;
    }
  | {
      version: 2;
      command: "memory_action";
      requestId: string;
      channelId: string;
      action: "approve" | "reject" | "retract";
      candidateId?: string;
      memoryId?: string;
    };

export interface CommunityAgentProcessingState {
  enabled: boolean;
  revision: number;
  status: "applied" | "cancelling" | "error";
  updatedAt: number;
  error?: string;
  applied?: boolean;
}

export type {
  CommunityAgentRuntimeAgent,
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeState,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import type { CommunityAgentRuntimeSetControl } from "./agent-runtime-set.js";

export type CommunityAgentMemoryRecord =
  | {
      type: "candidate";
      candidateId: string;
      kind: string;
      claim: string;
      origin: string;
      status: "review" | "approved" | "rejected";
      createdAt: number;
      evidence: readonly {
        eventId: string;
        evidenceHash: string;
        conversationKey: string;
        observedAt: number;
      }[];
    }
  | {
      type: "memory";
      memoryId: string;
      kind: string;
      content: string;
      status: "active" | "retracted";
      revision: number;
      evidenceHashes: readonly string[];
      createdAt: number;
    };

export interface CommunityAgentMemoryState {
  channelId: string;
  records: readonly CommunityAgentMemoryRecord[];
}

export type CommunityAgentActivitySyncContext =
  | { kind: "dm"; conversationId?: string }
  | { kind: "channel"; channelId: string }
  | {
      kind: "thread" | "forum-topic";
      channelId: string;
      threadRootId: string;
    };

export interface CommunityAgentActivityCheckpoint {
  streamId?: string;
  offset: number;
  notBefore?: number;
  updatedAt: number;
}

export interface CommunityAgentArchiveScope {
  communityId: string;
  /** Normalized primary and read relay URLs, not merely a display name. */
  relayUrls: readonly string[];
  ownerPubkey: string;
  /** Current verified relay identity used to validate managed ownership. */
  relayPubkey?: string;
}

export interface CommunityAgentArchiveRecord {
  event: NostrEvent;
  profile: NostrEvent;
  /** Current owner-signed instance; required to prove relay-managed ownership. */
  instance?: NostrEvent;
  receivedAt: number;
}

export interface CommunityAgentArchiveCursor {
  createdAt: number;
  eventId: string;
}

export interface CommunityAgentArchiveQuery {
  scope: CommunityAgentArchiveScope;
  agentPubkey?: string;
  channelId?: string;
  before?: CommunityAgentArchiveCursor;
  limit?: number;
}

export interface CommunityAgentArchivePage {
  records: readonly CommunityAgentArchiveRecord[];
  hasOlder: boolean;
  cursor?: CommunityAgentArchiveCursor;
}

/** Encrypted archive, independent of disposable message-cache retention. */
export interface CommunityAgentActivityStore {
  append(
    scope: CommunityAgentArchiveScope,
    records: readonly CommunityAgentArchiveRecord[],
  ): Promise<void>;
  page(query: CommunityAgentArchiveQuery): Promise<CommunityAgentArchivePage>;
  agents(
    scope: CommunityAgentArchiveScope,
  ): Promise<readonly CommunityAgentIdentity[]>;
  clear(scope: CommunityAgentArchiveScope, agentPubkey?: string): Promise<void>;
  checkpoint(
    scope: CommunityAgentArchiveScope,
    agentPubkey: string,
    context: CommunityAgentActivitySyncContext,
  ): Promise<CommunityAgentActivityCheckpoint | undefined>;
  commitSyncPage(
    scope: CommunityAgentArchiveScope,
    agentPubkey: string,
    context: CommunityAgentActivitySyncContext,
    records: readonly CommunityAgentArchiveRecord[],
    checkpoint: CommunityAgentActivityCheckpoint,
  ): Promise<void>;
  suppressBefore(
    scope: CommunityAgentArchiveScope,
    agentPubkey: string,
    timestamp: number,
  ): Promise<void>;
}

export type CommunityAgentArchiveRequest =
  | {
      operation: "append";
      scope: CommunityAgentArchiveScope;
      records: readonly CommunityAgentArchiveRecord[];
    }
  | { operation: "page"; query: CommunityAgentArchiveQuery }
  | { operation: "agents"; scope: CommunityAgentArchiveScope }
  | {
      operation: "clear";
      scope: CommunityAgentArchiveScope;
      agentPubkey?: string;
    }
  | {
      operation: "checkpoint";
      scope: CommunityAgentArchiveScope;
      agentPubkey: string;
      context: CommunityAgentActivitySyncContext;
    }
  | {
      operation: "commitSyncPage";
      scope: CommunityAgentArchiveScope;
      agentPubkey: string;
      context: CommunityAgentActivitySyncContext;
      records: readonly CommunityAgentArchiveRecord[];
      checkpoint: CommunityAgentActivityCheckpoint;
    }
  | {
      operation: "suppressBefore";
      scope: CommunityAgentArchiveScope;
      agentPubkey: string;
      timestamp: number;
    };

export interface CommunityAgentActivityItem {
  id: string;
  agentPubkey: string;
  createdAt: number;
  frame: CommunityAgentObserver;
}

export type { CommunityAgentTranscriptEntry } from "./agent-transcript-contracts.js";

export type { CommunityAgentPermissionRequest } from "./agent-permission-contracts.js";

export type CommunityAgentActivityContext = { focusTurnId?: string } & (
  | { kind: "overview" }
  | { kind: "channel"; channelId: string }
  | { kind: "thread" | "forum-topic"; channelId: string; threadRootId: string }
  | { kind: "dm"; agentPubkey?: string; conversationId?: string }
);

export type { CommunityAgentControllerScope } from "./agent-controller-scope.js";

export interface CommunityAgentsState extends AgentActivityFreshnessState {
  publicAgents?: readonly CommunityAgentIdentity[];
  status: "loading" | "ready" | "offline" | "error" | "unsupported";
  agents: readonly CommunityAgentIdentity[];
  personas: readonly CommunityAgentPersona[];
  /** Saved definitions with no surviving owner-signed instance reference. */
  setupDrafts?: readonly CommunityAgentPersona[];
  archivedAgents: readonly CommunityAgentIdentity[];
  capabilities: CommunityAgentCapabilities;
  presence: Readonly<Record<string, CommunityAgentPresence>>;
  working: Readonly<Record<string, boolean>>;
  /** Compatibility projection; use conversationScopes for runtime controls. */
  controllerScopes: Readonly<Record<string, CommunityAgentControllerScope>>;
  turnControls?: Readonly<Record<string, AgentTurnControlState>>;
  conversationScopes?: Readonly<Record<string, CommunityAgentControllerScope>>;
  publicWorking?: readonly {
    agentPubkey: string;
    channelId: string;
    threadRootId?: string;
    expiresAt: number;
  }[];
  activityContext?: CommunityAgentActivityContext;
  pendingPermissions: Readonly<
    Record<string, readonly CommunityAgentPermissionRequest[]>
  >;
  runtime?: Readonly<Record<string, CommunityAgentRuntimeState>>;
  processing?: Readonly<Record<string, CommunityAgentProcessingState>>;
  memories?: Readonly<Record<string, CommunityAgentMemoryState>>;
  partial: boolean;
  error?: string;
  storageMode: CommunityStorageMode;
  archiveError?: string;
  activityError?: string;
  activity: readonly CommunityAgentActivityItem[];
  activityAgent?: string;
  activityChannel?: string;
  activityLoading: boolean;
  hasOlder: boolean;
}

export interface CommunityAgentsActions extends AgentTurnActions {
  takePermissionNotifications?(): readonly AgentPermissionNotice[];
  refresh(): Promise<void>;
  registerAgent(pubkey: string): Promise<void>;
  savePersona(input: CommunityAgentPersonaSaveInput): Promise<void>;
  saveAgent(input: CommunityAgentSaveInput): Promise<void>;
  unlinkAgent(pubkey: string, fallbackName: string): Promise<void>;
  deletePersona(slug: string): Promise<void>;
  createManagedAgent(
    input: CommunityManagedAgentCreateInput,
  ): Promise<CommunityAgentControllerBootstrap>;
  clearManagedAgentDraft(): void;
  createManagedAgentReplacement(
    pubkey: string,
  ): Promise<CommunityAgentControllerBootstrap>;
  revokeManagedAgent(pubkey: string): Promise<void>;
  deleteManagedAgent(pubkey: string): Promise<void>;
  setFollow(pubkey: string, following: boolean): Promise<void>;
  openActivity(
    pubkey: string,
    context?: string | CommunityAgentActivityContext,
  ): Promise<void>;
  syncActivity(
    context: CommunityAgentActivitySyncContext,
    agentPubkeys?: readonly string[],
  ): Promise<void>;
  cancelActivitySync(): void;
  loadOlderActivity(): Promise<void>;
  clearHistory(pubkey?: string): Promise<void>;
  respondPermission(
    pubkey: string,
    requestId: string,
    decision: CommunityAgentPermissionDecision,
    channelId?: string,
  ): Promise<void>;
  loadProcessing?(pubkey: string): Promise<CommunityAgentProcessingState>;
  setProcessing?(
    pubkey: string,
    enabled: boolean,
    expectedRevision: number,
  ): Promise<CommunityAgentProcessingState>;
  loadRuntime(pubkey: string): Promise<CommunityAgentRuntimeState>;
  saveRuntime(
    pubkey: string,
    defaults: import("./agent-runtime-set.js").CommunityAgentRuntimeSettings,
  ): Promise<CommunityAgentRuntimeState>;
  loadMemories(
    pubkey: string,
    channelId: string,
    filter?: {
      status?: "approved" | "review" | "rejected" | "retracted";
      query?: string;
    },
  ): Promise<CommunityAgentMemoryState>;
  actOnMemory(
    pubkey: string,
    input: {
      channelId: string;
      action: "approve" | "reject" | "retract";
      candidateId?: string;
      memoryId?: string;
    },
  ): Promise<CommunityAgentMemoryState>;
}
