import type { CommunitySigner } from "../auth/index.js";
import type {
  CommunityActionAvailability,
  CommunityComposerSubmission,
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
  /** Whether this source can load and publish the public kind-1 Pulse feed. */
  pulse?: boolean;
  configurableRetention?: boolean;
  memberRoles?: boolean;
  writeRestrictedRooms?: boolean;
  groupInvites?: boolean;
}

export type CommunityPulseTab =
  | "search"
  | "everyone"
  | "following"
  | "liked"
  | "agents"
  | "mine";

export type CommunityPulseFeedTab = Exclude<CommunityPulseTab, "search">;

export interface CommunityPulseAgentIdentity {
  pubkey: string;
  name: string;
  avatarUrl?: string;
  status?: string;
}

export interface CommunityPulseOptions {
  /** Omit this property to hide the Agents tab; an empty array keeps it visible. */
  agents?: readonly CommunityPulseAgentIdentity[];
}

export interface CommunityPulseParentModel {
  id: string;
  author: CommunityMemberModel;
  content: string;
}

export interface CommunityPulseNoteModel {
  id: string;
  author: CommunityMemberModel;
  content: string;
  createdAt: number;
  sourceEvent: NostrEvent;
  mentionPubkeys: readonly string[];
  parent?: CommunityPulseParentModel;
  likeCount: number;
  likedByCurrentUser: boolean;
  currentUserOwns: boolean;
  likePending?: boolean;
}

export interface CommunityPulseAgentActivityModel {
  id: string;
  agent: CommunityPulseAgentIdentity;
  notes: readonly CommunityPulseNoteModel[];
}

export interface CommunityPulseModel {
  tab: CommunityPulseTab;
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  notes: readonly CommunityPulseNoteModel[];
  agentActivities: readonly CommunityPulseAgentActivityModel[];
  members: readonly CommunityMemberModel[];
  agents?: readonly CommunityPulseAgentIdentity[];
  canDirectMessage: boolean;
  lastUpdatedAt?: number;
  error?: string;
}

export interface CommunityPulseActions {
  setActive(active: boolean): void;
  selectTab(tab: CommunityPulseTab): Promise<void>;
  refresh(kind?: "notes" | "reactions"): Promise<void>;
  publish(
    submission: CommunityComposerSubmission,
    replyToEventId?: string,
  ): Promise<void>;
  toggleLike(eventId: string): Promise<void>;
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

export type CommunityOperationFailureCategory =
  | "validation"
  | "authentication"
  | "membership"
  | "invalid"
  | "restricted"
  | "blocked"
  | "rate-limited"
  | "pow"
  | "mute"
  | "timeout"
  | "network"
  | "relay";

export interface CommunityOperationFailure {
  category: CommunityOperationFailureCategory;
  message: string;
  relayReason?: string;
  retryable: boolean;
}

export interface CommunityOperationState {
  status: "idle" | "pending" | "accepted" | "failed";
  message?: string;
  failure?: CommunityOperationFailure;
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
  contentSync?: CommunityContentSyncState;
  navigation: CommunityNavigationPreferences;
  replyTarget?: CommunityReplyTarget;
  pulse?: CommunityPulseModel;
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
  postingPolicy?: "standard" | "writers";
}

export interface CommunityGroupInvite {
  uri: string;
  code: string;
  groupId: string;
  relayUrl: string;
  relayPubkey: string;
}

export interface CommunityGroupLoadRequest {
  groupId: string;
  relayPubkey?: string;
}

export interface CommunityGroupLoadResult {
  room: CommunityRoomScope;
  metadata: NostrEvent;
  events: readonly NostrEvent[];
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

export type CommunityMessageReportCategory =
  | "spam"
  | "profanity"
  | "nudity"
  | "impersonation"
  | "malware"
  | "illegal"
  | "other";

export interface CommunityMessageReport {
  category: CommunityMessageReportCategory;
  context?: string;
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
  | { type: "join"; groupId: string; code?: string }
  | { type: "leave"; groupId: string }
  | { type: "add-member"; groupId: string; pubkey: string; roles?: string[] }
  | { type: "remove-member"; groupId: string; pubkey: string }
  | { type: "create-invite"; groupId: string; code: string }
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
  encryptedEvents?: readonly NostrEvent[];
  privateEvents?: readonly CommunityPrivateEvent[];
  capabilities: CommunityCapabilities;
  checkpoints?: readonly CommunitySyncCheckpoint[];
  complete?: boolean;
}

export interface CommunitySynchronizationRequest {
  plan: CommunitySyncPlan;
  strategy?: "complete" | "bootstrap";
}

export interface CommunityContentCursor {
  createdAt: number;
  eventId: string;
}

export type CommunityContentCollection =
  | "channel-roots"
  | "forum-topics"
  | "thread"
  | "room-history";

export interface CommunityContentWindowRequest {
  collection: CommunityContentCollection;
  groupId: string;
  rootEventId?: string;
  before?: CommunityContentCursor;
  limit: number;
}

export interface CommunityContentWindow {
  events: readonly NostrEvent[];
  primaryEventIds: readonly string[];
  olderCursor?: CommunityContentCursor;
  hasOlder: boolean;
}

export interface CommunityPulseWindowRequest {
  tab: CommunityPulseFeedTab;
  agentPubkeys?: readonly string[];
  /** Reuse the current note set while only refreshing reactions. */
  noteIds?: readonly string[];
}

export interface CommunityPulseWindow {
  events: readonly NostrEvent[];
  /** Newest-first note order after applying the selected feed semantics. */
  primaryEventIds: readonly string[];
}

export interface CommunityContentSyncState {
  phase: "initial" | "background" | "complete" | "partial-error";
  rooms: Readonly<Record<string, "unloaded" | "partial" | "complete">>;
  message?: string;
}

export type CommunityCacheAudience =
  | { type: "public" }
  | { type: "inbox"; pubkey: string };

export interface CommunitySyncCheckpoint {
  relayUrl: string;
  stream: string;
  createdAt: number;
  synchronizedAt: number;
  cursorEventId?: string;
  complete?: boolean;
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

export interface CommunityEventBatch {
  generation: number;
  scope: CommunityScope;
  relayUrl: string;
  events: readonly NostrEvent[];
  audience?: CommunityCacheAudience;
  persist?: boolean;
  checkpoints?: readonly CommunitySyncCheckpoint[];
}

export interface CommunityRuntimeSelection {
  generation: number;
  scopes: readonly CommunityScope[];
  activeCommunityId: string;
  activeRoomId: string;
  activeTopicId?: string;
  activeThreadId?: string;
  identityPubkey?: string;
  privateEventsByScope?: Readonly<
    Record<string, readonly CommunityPrivateEvent[]>
  >;
  directParticipantsByRoom?: Readonly<Record<string, readonly string[]>>;
  sidePanel?: "thread" | "details" | "none";
  asOf?: number;
}

export interface CommunityRuntimeRevision {
  generation: number;
  revision: number;
  /**
   * Events newly accepted by the runtime. Restore returns the cached seed once;
   * subsequent ingestion revisions contain only the accepted delta. Projection
   * revisions omit this field so the complete canonical collection stays in
   * the runtime.
   */
  acceptedEventsByScope?: Readonly<Record<string, readonly NostrEvent[]>>;
  cache: CommunityCacheState;
  syncPlans?: Readonly<Record<string, CommunitySyncPlan>>;
  workspace?: CommunityWorkspaceModel;
  inbox?: CommunityInboxModel;
  settings?: CommunitySettingsState;
}

export interface CommunityRuntimeSearch {
  generation: number;
  scopeId?: string;
  query: string;
  limit?: number;
}

export interface CommunityEventRuntime {
  restore(
    scopes: readonly CommunityScope[],
    generation?: number,
  ): Promise<CommunityRuntimeRevision>;
  ingest(
    batch: CommunityEventBatch,
  ): Promise<CommunityRuntimeRevision | undefined>;
  project(
    selection: CommunityRuntimeSelection,
  ): Promise<CommunityRuntimeRevision>;
  search(
    query: CommunityRuntimeSearch,
  ): Promise<readonly CommunitySearchResult[]>;
  clear(scope?: CommunityScope): Promise<void>;
  dispose(): void;
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
  roomId?: string;
}

export interface CommunitySessionSubscription {
  close(): void;
}

export interface CommunitySession {
  snapshot(signal?: AbortSignal): Promise<CommunitySnapshot>;
  synchronize?(
    request: CommunitySynchronizationRequest,
    signal?: AbortSignal,
  ): Promise<CommunitySnapshot>;
  loadContentWindow?(
    request: CommunityContentWindowRequest,
    signal?: AbortSignal,
  ): Promise<CommunityContentWindow>;
  loadPulseWindow?(
    request: CommunityPulseWindowRequest,
    signal?: AbortSignal,
  ): Promise<CommunityPulseWindow>;
  loadGroup?(
    request: CommunityGroupLoadRequest,
    signal?: AbortSignal,
  ): Promise<CommunityGroupLoadResult>;
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
  dismissOperation(operation: string): void;
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
  editEvent?(eventId: string, content: string): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  reportEvent?(eventId: string, report: CommunityMessageReport): Promise<void>;
  createRoom(
    roomKind: "channel" | "forum",
    update: CommunityRoomUpdate,
  ): Promise<void>;
  updateRoom(roomId: string, update: CommunityRoomUpdate): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
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
  join(roomId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  addMember(roomId: string, pubkey: string, roles?: string[]): Promise<void>;
  removeMember(roomId: string, pubkey: string): Promise<void>;
  setMemberRoles?(
    roomId: string,
    pubkey: string,
    roles: readonly string[],
  ): Promise<void>;
  createGroupInvite?(roomId: string): Promise<CommunityGroupInvite>;
  joinWithInvite?(value: string): Promise<void>;
  updateProfile(profile: CommunityProfileUpdate): Promise<void>;
  updateStatus(status: string): Promise<void>;
  setCustomEmoji(shortcode: string, url: string): Promise<void>;
  removeCustomEmoji(shortcode: string): Promise<void>;
  updateRelayUrl(communityId: string, relayUrl: string): Promise<void>;
  clearCache(communityId?: string): Promise<void>;
  connectIdentity(connector?: CommunityIdentityConnector): Promise<void>;
  disconnectIdentity(): Promise<void>;
  /** Additive so custom controllers that do not implement Pulse remain valid. */
  pulse?: CommunityPulseActions;
}

export interface CommunityControllerOptions {
  scopes: readonly CommunityScope[];
  source: CommunityDataSource;
  identity?: CommunityIdentity;
  identityConnector?: CommunityIdentityConnector;
  stateStore?: CommunityStateStore;
  configurationStore?: CommunityConfigurationStore;
  runtime?: CommunityEventRuntime;
  initialCommunityId?: string;
  initialRoomId?: string;
  clientId?: string;
  now?: () => number;
  pulse?: CommunityPulseOptions;
  inviteCodeFactory?: () => string;
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
  activityLog?: (memberId: string) => void | Promise<void>;
  archive?: (roomId: string) => void | Promise<void>;
  editMessage?: (messageId: string) => void | Promise<void>;
  feedback?: () => void | Promise<void>;
  wave?: (memberId: string) => void | Promise<void>;
  follow?: (memberId: string) => void | Promise<void>;
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
