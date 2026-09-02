import type { CommunitySigner } from "../auth/index.js";
import type {
  CommunityActionAvailability,
  CommunityInboxModel,
  CommunityMemberModel,
  CommunityRoomKind,
  CommunityWorkspaceHandlers,
  CommunityWorkspaceModel,
} from "../components/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type { JsonValue } from "../protocol/index.js";

export type CommunityConnectionStatus =
  | "idle"
  | "restoring"
  | "connecting"
  | "synchronizing"
  | "connected"
  | "offline"
  | "error";

export type CommunityStorageMode = "turso-opfs" | "indexeddb" | "memory";

export type CommunityCacheFreshness =
  | "empty"
  | "cached"
  | "synchronizing"
  | "current"
  | "offline";

export interface CommunityCacheState {
  mode: CommunityStorageMode;
  freshness: CommunityCacheFreshness;
  lastSynchronizedAt?: number;
  degradedReason?: string;
  approximateBytes?: number;
}

export interface CommunityScope {
  id: string;
  name: string;
  relayUrl: string;
  groupId?: string;
  rooms?: readonly CommunityRoomScope[];
  discoverPublicRooms?: boolean;
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
  configurableRetention?: boolean;
}

export interface CommunityIdentityConnector {
  connect(): Promise<CommunityIdentity>;
}

export interface CommunityAuthenticationState {
  status: "anonymous" | "connecting" | "connected" | "error";
  pubkey?: string;
  error?: string;
}

export interface CommunityMemberDirectoryState {
  query: string;
  results: readonly CommunityMemberModel[];
  completeness: "complete" | "partial" | "unavailable";
}

export interface CommunityReplyTarget {
  eventId: string;
  roomId: string;
  authorId: string;
  authorName: string;
  content: string;
  kind: CommunityRoomKind;
}

export interface CommunityNavigationSectionPreference {
  id: string;
  name: string;
  roomIds: readonly string[];
}

export interface CommunityNavigationPreferences {
  starredRoomIds: readonly string[];
  mutedRoomIds: readonly string[];
  hiddenRoomIds: readonly string[];
  forcedUnreadRoomIds: readonly string[];
  sections: readonly CommunityNavigationSectionPreference[];
}

export interface CommunityOperationState {
  status: "idle" | "pending" | "failed";
  message?: string;
}

export interface CommunityControllerState {
  status: CommunityConnectionStatus;
  cache: CommunityCacheState;
  connections: readonly CommunityConnectionSettings[];
  workspace: CommunityWorkspaceModel;
  inbox?: CommunityInboxModel;
  settings: CommunitySettingsState;
  capabilities: CommunityCapabilities;
  operations: Readonly<Record<string, CommunityOperationState>>;
  searchResults: readonly CommunitySearchResult[];
  searchQuery: string;
  authentication: CommunityAuthenticationState;
  memberDirectory: CommunityMemberDirectoryState;
  navigation: CommunityNavigationPreferences;
  replyTarget?: CommunityReplyTarget;
  error?: string;
}

export interface CommunityConnectionSettings {
  communityId: string;
  name: string;
  relayUrl: string;
}

export interface CommunityProfileSettings {
  pubkey: string;
  displayName: string;
  username: string;
  about: string;
  picture: string;
}

export interface CommunityCustomEmoji {
  shortcode: string;
  url: string;
  ownerPubkey: string;
  owned: boolean;
}

export interface CommunitySettingsState {
  identityConnected: boolean;
  profile: CommunityProfileSettings;
  customEmojis: readonly CommunityCustomEmoji[];
}

export interface CommunityProfileUpdate {
  displayName: string;
  username: string;
  about: string;
  picture: string;
}

export interface CommunityRoomUpdate {
  name: string;
  description: string;
  visibility: "public" | "private";
  lifecycle: "ongoing" | "temporary";
}

export interface CommunityTopicDraft {
  title: string;
  content: string;
  tags?: readonly string[];
}

export interface CommunityCustomEmojiReference {
  shortcode: string;
  url: string;
}

export type CommunityIdentity = CommunitySigner;

export type CommunityCommand =
  | {
      type: "publish";
      template: NostrEventTemplate;
      optimisticEvent?: NostrEvent;
    }
  | {
      type: "delete";
      eventId: string;
      groupId: string;
      mode?: "owner" | "moderator";
    }
  | {
      type: "create-room";
      groupId: string;
      roomKind: "channel" | "forum";
      update: CommunityRoomUpdate;
    }
  | { type: "update-room"; groupId: string; update: CommunityRoomUpdate }
  | { type: "delete-room"; groupId: string }
  | { type: "join"; groupId: string }
  | { type: "leave"; groupId: string }
  | { type: "add-member"; groupId: string; pubkey: string; roles?: string[] }
  | { type: "remove-member"; groupId: string; pubkey: string }
  | {
      type: "direct-message";
      recipients: readonly string[];
      content: string;
      replyToEventId?: string;
      eventKind?: 5 | 7 | 14;
      targetEventId?: string;
      customEmoji?: CommunityCustomEmojiReference;
    };

export interface CommunitySnapshot {
  events: readonly NostrEvent[];
  privateEvents?: readonly CommunityPrivateEvent[];
  capabilities: CommunityCapabilities;
}

export type CommunityCacheAudience =
  | { type: "public" }
  | { type: "inbox"; pubkey: string };

export interface CommunitySyncCheckpoint {
  relayUrl: string;
  stream: string;
  createdAt: number;
  synchronizedAt: number;
}

export interface CommunityCachedScope {
  events: readonly NostrEvent[];
  checkpoints: readonly CommunitySyncCheckpoint[];
  approximateBytes: number;
}

export interface CommunityVerifiedEventRecord {
  event: NostrEvent;
  relayUrl: string;
  audience: CommunityCacheAudience;
  roomId?: string;
  lastAccessedAt?: number;
}

export interface CommunityVerifiedEventBatch {
  scope: CommunityScope;
  records: readonly CommunityVerifiedEventRecord[];
  checkpoints?: readonly CommunitySyncCheckpoint[];
}

export interface CommunitySyncPlan {
  checkpoints: readonly CommunitySyncCheckpoint[];
  cachedEventIds: readonly string[];
}

export interface CommunityEventStore {
  readonly mode: CommunityStorageMode;
  open(): Promise<void>;
  restore(
    scope: CommunityScope,
    audience?: CommunityCacheAudience,
  ): Promise<CommunityCachedScope>;
  commit(batch: CommunityVerifiedEventBatch): Promise<void>;
  syncPlan(scope: CommunityScope): Promise<CommunitySyncPlan>;
  markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void>;
  prune(): Promise<void>;
  clear(scope?: CommunityScope): Promise<void>;
  close(): Promise<void>;
}

export interface CommunityPrivateEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 5 | 7 | 14;
  tags: string[][];
  content: string;
  wrapId: string;
  recipientPubkey: string;
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
  reconnect(): Promise<void>;
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
  openDirectMessage(participants: readonly string[]): void;
  sendMessage(roomId: string, content: string): Promise<void>;
  sendReply(rootMessageId: string, content: string): Promise<void>;
  createTopic(
    roomId: string,
    draft: string | CommunityTopicDraft,
  ): Promise<void>;
  sendDirectMessage(
    recipients: readonly string[],
    content: string,
    replyToEventId?: string,
  ): Promise<void>;
  toggleReaction(
    eventId: string,
    emoji: string,
    customEmoji?: CommunityCustomEmojiReference,
  ): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  createRoom(
    roomKind: "channel" | "forum",
    update: CommunityRoomUpdate,
  ): Promise<void>;
  updateRoom(groupId: string, update: CommunityRoomUpdate): Promise<void>;
  deleteRoom(groupId: string): Promise<void>;
  search(query: string): Promise<void>;
  searchMembers(query: string): Promise<void>;
  setReplyTarget(eventId: string): void;
  clearReplyTarget(): void;
  markRead(roomId: string): Promise<void>;
  markUnread(roomId: string): Promise<void>;
  markAllRead(): Promise<void>;
  setRoomStarred(roomId: string, starred: boolean): Promise<void>;
  setRoomMuted(roomId: string, muted: boolean): Promise<void>;
  setRoomHidden(roomId: string, hidden: boolean): Promise<void>;
  assignRoomToSection(roomId: string, sectionId?: string): Promise<void>;
  createNavigationSection(name: string): Promise<string>;
  renameNavigationSection(sectionId: string, name: string): Promise<void>;
  deleteNavigationSection(sectionId: string): Promise<void>;
  reorderNavigationSections(sectionIds: readonly string[]): Promise<void>;
  join(groupId: string): Promise<void>;
  leave(groupId: string): Promise<void>;
  addMember(groupId: string, pubkey: string, roles?: string[]): Promise<void>;
  removeMember(groupId: string, pubkey: string): Promise<void>;
  updateProfile(profile: CommunityProfileUpdate): Promise<void>;
  updateStatus(status: string): Promise<void>;
  setCustomEmoji(shortcode: string, url: string): Promise<void>;
  removeCustomEmoji(shortcode: string): Promise<void>;
  updateRelayUrl(communityId: string, relayUrl: string): Promise<void>;
  connectIdentity(): Promise<void>;
}

export interface CommunityControllerOptions {
  scopes: readonly CommunityScope[];
  source: CommunityDataSource;
  identity?: CommunityIdentity;
  identityConnector?: CommunityIdentityConnector;
  stateStore?: CommunityStateStore;
  configurationStore?: CommunityConfigurationStore;
  initialCommunityId?: string;
  initialRoomId?: string;
  clientId?: string;
  now?: () => number;
}

export interface CommunityLinkBuilder {
  message(input: {
    eventId: string;
    authorPubkey: string;
    relayUrl: string;
  }): string;
  room?(scope: CommunityScope, room: CommunityRoomScope): string;
}

export interface CommunityApplicationExtensions {
  terminal?: () => void | Promise<void>;
  huddle?: (roomId: string) => void | Promise<void>;
  agents?: (roomId: string) => void | Promise<void>;
  archive?: (roomId: string) => void | Promise<void>;
  editMessage?: (messageId: string) => void | Promise<void>;
  feedback?: () => void | Promise<void>;
}

export function communityActionAvailability(
  state: CommunityActionAvailability["state"],
  reason?: string,
): CommunityActionAvailability {
  return reason === undefined ? { state } : { state, reason };
}

export interface CommunityConfigurationStore {
  loadRelayUrl(communityId: string): Promise<string | undefined>;
  saveRelayUrl(communityId: string, relayUrl: string): Promise<void>;
}

export interface CommunityStateScope {
  communityId: string;
  relayUrl: string;
  pubkey: string;
}

export interface CommunityReadCursor {
  createdAt: number;
  eventId: string;
  granularity: "room" | "thread" | "message";
}

export interface CommunityPreferenceValue {
  value: JsonValue;
  updatedAt: number;
  clientId: string;
}

export interface CommunityStoredState {
  version: 1;
  clientId: string;
  updatedAt: number;
  readMarkers: Record<string, CommunityReadCursor>;
  preferences: Record<string, CommunityPreferenceValue>;
}

export interface CommunityStateStore {
  load(scope: CommunityStateScope): Promise<CommunityStoredState | undefined>;
  refresh(
    scope: CommunityStateScope,
  ): Promise<CommunityStoredState | undefined>;
  save(scope: CommunityStateScope, state: CommunityStoredState): Promise<void>;
  flush(scope?: CommunityStateScope): Promise<void>;
  dispose(): void;
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
