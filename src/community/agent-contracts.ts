import type { NostrEvent } from "../protocol/index.js";
import type { CommunityStorageMode } from "./contracts.js";

export interface CommunityAgentIdentity {
  pubkey: string;
  ownerPubkey: string;
  name: string;
  about: string;
  avatarUrl?: string;
  agentType: string;
  channelIds: readonly string[];
  followed: boolean;
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
}

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

export interface CommunityAgentsState {
  status: "loading" | "ready" | "offline" | "error" | "unsupported";
  agents: readonly CommunityAgentIdentity[];
  archivedAgents: readonly CommunityAgentIdentity[];
  capabilities: CommunityAgentCapabilities;
  presence: Readonly<Record<string, CommunityAgentPresence>>;
  working: Readonly<Record<string, boolean>>;
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
  setFollow(pubkey: string, following: boolean): Promise<void>;
  openActivity(pubkey: string, channelId?: string): Promise<void>;
  loadOlderActivity(): Promise<void>;
  clearHistory(pubkey?: string): Promise<void>;
}
