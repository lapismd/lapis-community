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
}

export interface CommunityAgentCapabilities {
  directory: boolean;
  presence: boolean;
  activity: boolean;
}

export interface CommunityAgentDirectory {
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
  seq: number;
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
      onevent(event: NostrEvent): void;
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
  | { version: 1; command: "cancel_turn"; scopeKey: string; channelId?: string }
  | {
      version: 1;
      command: "reset_conversation";
      scopeKey: string;
      channelId?: string;
    }
  | {
      version: 1;
      command: "permission_response";
      requestId: string;
      decision: CommunityAgentPermissionDecision;
      channelId?: string;
    };

export interface CommunityAgentArchiveScope {
  communityId: string;
  /** Normalized primary and read relay URLs, not merely a display name. */
  relayUrls: readonly string[];
  ownerPubkey: string;
}

export interface CommunityAgentArchiveRecord {
  event: NostrEvent;
  profile: NostrEvent;
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
    };

export interface CommunityAgentActivityItem {
  id: string;
  agentPubkey: string;
  createdAt: number;
  frame: CommunityAgentObserver;
}

export interface CommunityAgentPermissionRequest {
  agentPubkey: string;
  requestId: string;
  scopeKey: string;
  tool: string;
  input?: unknown;
  options: readonly CommunityAgentPermissionDecision[];
  expiresAt?: number;
  channelId?: string;
  sessionId?: string;
  turnId?: string;
}

export interface CommunityAgentControllerScope {
  agentPubkey: string;
  scopeKey: string;
  active: boolean;
  channelId?: string;
  sessionId?: string;
  turnId?: string;
}

export interface CommunityAgentsState {
  status: "loading" | "ready" | "offline" | "error" | "unsupported";
  agents: readonly CommunityAgentIdentity[];
  personas: readonly CommunityAgentPersona[];
  archivedAgents: readonly CommunityAgentIdentity[];
  capabilities: CommunityAgentCapabilities;
  presence: Readonly<Record<string, CommunityAgentPresence>>;
  working: Readonly<Record<string, boolean>>;
  controllerScopes: Readonly<Record<string, CommunityAgentControllerScope>>;
  pendingPermissions: Readonly<
    Record<string, readonly CommunityAgentPermissionRequest[]>
  >;
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

export interface CommunityAgentsActions {
  refresh(): Promise<void>;
  registerAgent(pubkey: string): Promise<void>;
  savePersona(input: CommunityAgentPersonaSaveInput): Promise<void>;
  saveAgent(input: CommunityAgentSaveInput): Promise<void>;
  unlinkAgent(pubkey: string, fallbackName: string): Promise<void>;
  deletePersona(slug: string): Promise<void>;
  setFollow(pubkey: string, following: boolean): Promise<void>;
  openActivity(pubkey: string, channelId?: string): Promise<void>;
  loadOlderActivity(): Promise<void>;
  clearHistory(pubkey?: string): Promise<void>;
  cancelTurn(
    pubkey: string,
    scopeKey: string,
    channelId?: string,
  ): Promise<void>;
  resetConversation(
    pubkey: string,
    scopeKey: string,
    channelId?: string,
  ): Promise<void>;
  respondPermission(
    pubkey: string,
    requestId: string,
    decision: CommunityAgentPermissionDecision,
    channelId?: string,
  ): Promise<void>;
}
