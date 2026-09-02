import type { RegistrySigner } from "../auth/index.js";
import type {
  CommunityInboxModel,
  CommunityWorkspaceHandlers,
  CommunityWorkspaceModel,
} from "../components/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export type CommunityConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "error";

export interface CommunityScope {
  id: string;
  name: string;
  relayUrl: string;
  groupId?: string;
  rooms?: readonly CommunityRoomScope[];
  readRelayUrls?: readonly string[];
}

export interface CommunityRoomScope {
  id: string;
  groupId: string;
  name: string;
  kind: "channel" | "forum";
  description?: string;
  private?: boolean;
}

export interface CommunityCapabilities {
  channels: boolean;
  forums: boolean;
  directMessages: boolean;
  search: boolean;
  manageGroup: boolean;
  manageMembers: boolean;
  deleteEvents: boolean;
  archive: boolean;
  editMessages: boolean;
}

export interface CommunityOperationState {
  status: "idle" | "pending" | "failed";
  message?: string;
}

export interface CommunityControllerState {
  status: CommunityConnectionStatus;
  workspace: CommunityWorkspaceModel;
  inbox?: CommunityInboxModel;
  capabilities: CommunityCapabilities;
  operations: Readonly<Record<string, CommunityOperationState>>;
  searchResults: readonly CommunitySearchResult[];
  searchQuery: string;
  error?: string;
}

export interface CommunityEncryption {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

export interface CommunityIdentity extends RegistrySigner {
  nip44?: CommunityEncryption;
}

export type CommunityCommand =
  | {
      type: "publish";
      template: NostrEventTemplate;
      optimisticEvent?: NostrEvent;
    }
  | { type: "delete"; eventId: string; groupId: string }
  | { type: "join"; groupId: string }
  | { type: "leave"; groupId: string }
  | { type: "add-member"; groupId: string; pubkey: string; roles?: string[] }
  | { type: "remove-member"; groupId: string; pubkey: string };

export interface CommunitySnapshot {
  events: readonly NostrEvent[];
  capabilities: CommunityCapabilities;
}

export interface CommunitySearchResult {
  event: NostrEvent;
  relayUrl: string;
}

export interface CommunitySessionSubscription {
  close(): void;
}

export interface CommunitySession {
  snapshot(signal?: AbortSignal): Promise<CommunitySnapshot>;
  subscribe(
    listener: (events: readonly NostrEvent[]) => void,
    signal?: AbortSignal,
  ): Promise<CommunitySessionSubscription>;
  execute(
    command: CommunityCommand,
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]>;
  search(
    query: string,
    signal?: AbortSignal,
  ): Promise<readonly CommunitySearchResult[]>;
  close(): void;
}

export interface CommunityDataSourceContext {
  identity?: CommunityIdentity;
}

export interface CommunityDataSource {
  open(
    scope: CommunityScope,
    context?: CommunityDataSourceContext,
    signal?: AbortSignal,
  ): Promise<CommunitySession>;
}

export interface CommunityController {
  readonly state: CommunityControllerState;
  readonly handlers: CommunityWorkspaceHandlers;
  readonly actions: CommunityControllerActions;
  initialize(): void;
  dispose(): void;
  refresh(): Promise<void>;
  retry(operation: string): Promise<void>;
}

export interface CommunityControllerActions {
  selectCommunity(communityId: string): void;
  selectRoom(roomId: string): void;
  openTopic(topicId: string): void;
  openThread(messageId: string): void;
  closeSidePanel(): void;
  openDetails(): void;
  sendMessage(roomId: string, content: string): Promise<void>;
  sendReply(rootMessageId: string, content: string): Promise<void>;
  createTopic(roomId: string, content: string): Promise<void>;
  toggleReaction(eventId: string, emoji: string): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  search(query: string): Promise<void>;
  join(groupId: string): Promise<void>;
  leave(groupId: string): Promise<void>;
  addMember(groupId: string, pubkey: string, roles?: string[]): Promise<void>;
  removeMember(groupId: string, pubkey: string): Promise<void>;
}

export interface CommunityControllerOptions {
  scopes: readonly CommunityScope[];
  source: CommunityDataSource;
  identity?: CommunityIdentity;
  initialCommunityId?: string;
  initialRoomId?: string;
  now?: () => number;
}

export interface CommunityProtocolCodec<TState = unknown> {
  readonly id: string;
  filters(scope: CommunityScope): readonly Record<string, unknown>[];
  materialize(events: readonly NostrEvent[], previous?: TState): TState;
  encode(
    command: CommunityCommand,
    scope: CommunityScope,
  ): readonly NostrEventTemplate[];
}
