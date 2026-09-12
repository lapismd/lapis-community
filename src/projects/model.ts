import type { NostrEvent } from "../protocol/index.js";

export const PROJECT_FORGE_KINDS = {
  project: 30_621,
  repository: 30_617,
  task: 1_621,
  pullRequest: 1_618,
  pullRequestUpdate: 1_619,
  statusOpen: 1_630,
  statusMerged: 1_631,
  statusClosed: 1_632,
  statusDraft: 1_633,
  note: 1,
  reaction: 7,
  comment: 1_111,
  deletion: 5,
  httpAuth: 27_235,
} as const;

/** The complete reaction vocabulary accepted by GitHub's Reactions API. */
export const GITHUB_REVIEW_COMMENT_REACTIONS = [
  "👍",
  "👎",
  "😄",
  "😕",
  "❤️",
  "🎉",
  "🚀",
  "👀",
] as const;

export type ProjectForgeSurface =
  | "overview"
  | "tasks"
  | "reviews"
  | "commits"
  | "files"
  | "channels"
  | "contributors"
  | "people";

export type ProjectForgeOverviewSurface =
  | "activity"
  | "projects"
  | "repositories"
  | "tasks"
  | "reviews"
  | "channels";

export interface NostrAddress {
  kind: number;
  owner: string;
  identifier: string;
  coordinate: string;
}

export interface ProjectRepositoryReference {
  coordinate: string;
  relayHint?: string;
}

export interface ProjectForgeProject {
  event: NostrEvent;
  address: NostrAddress;
  name: string;
  description: string;
  channelId: string;
  relatedChannelIds: readonly string[];
  /** Buzz listing intent. Absent and unknown tag values materialize as listed. */
  listing: "listed" | "unlisted";
  repositories: readonly ProjectRepositoryReference[];
}

export interface ProjectForgeBoundChannel {
  channelId: string;
  repositoryCoordinate?: string;
  role: "home" | "related";
}

export type ProjectForgeRepositoryClass = "hosted" | "external" | "task-anchor";

export interface ProjectForgeRepository {
  event: NostrEvent;
  address: NostrAddress;
  name: string;
  description: string;
  channelId: string;
  cloneUrls: readonly string[];
  webUrls: readonly string[];
  repositoryClass: ProjectForgeRepositoryClass;
}

export type ProjectTaskLifecycle = "open" | "closed" | "draft" | "applied";

export interface ProjectTaskActivity {
  event: NostrEvent;
  encoding: "buzz-kind-1" | "nip-22";
  assignment?: "assign" | "unassign";
  assignees: readonly string[];
}

export interface ProjectTaskState {
  root: NostrEvent;
  repository: NostrAddress;
  title: string;
  content: string;
  labels: readonly string[];
  lifecycle: ProjectTaskLifecycle;
  statusEvent?: NostrEvent;
  assignees: readonly string[];
  activity: readonly ProjectTaskActivity[];
  createdAt: number;
  updatedAt: number;
}

export type PullRequestLifecycle = "open" | "merged" | "closed" | "draft";
export type PullRequestDecisionKind = "approved" | "changes-requested";
export type PullRequestReviewKind = "comment" | PullRequestDecisionKind;
export type PullRequestDecisionStatus = "current" | "historical";
export type PullRequestInlineStatus = "current" | "outdated";

export interface PullRequestInlineAnchor {
  path: string;
  side: "old" | "new";
  line: number;
}

export interface PullRequestComment {
  event: NostrEvent;
  encoding: "buzz-kind-1" | "nip-22";
  commit: string;
  anchor?: PullRequestInlineAnchor;
  isInlineComment: boolean;
  inlineStatus?: PullRequestInlineStatus;
  isReviewRequest: boolean;
  isTrustedReviewRequest: boolean;
  reviewerPubkeys: readonly string[];
  decision?: PullRequestDecisionKind;
  isTrustedDecision: boolean;
  decisionStatus?: PullRequestDecisionStatus;
  reactions: readonly ProjectForgeReaction[];
}

export interface ProjectForgeReaction {
  emoji: string;
  count: number;
  selected?: boolean;
}

export interface PullRequestDecision {
  event: NostrEvent;
  reviewer: string;
  commit: string;
  decision: PullRequestDecisionKind;
}

export interface PullRequestUpdate {
  event: NostrEvent;
  commit: string;
  cloneUrls: readonly string[];
  mergeBase: string;
}

export interface PullRequestLifecycleEvent {
  event: NostrEvent;
  lifecycle: PullRequestLifecycle;
  mergeCommit: string;
  mergeReferences: readonly string[];
}

export interface PullRequestState {
  root: NostrEvent;
  repository: NostrAddress;
  title: string;
  content: string;
  labels: readonly string[];
  recipients: readonly string[];
  initialCommit: string;
  currentCommit: string;
  cloneUrls: readonly string[];
  branchName: string;
  targetBranch: string;
  mergeBase: string;
  lifecycle: PullRequestLifecycle;
  statusEvent?: NostrEvent;
  mergeCommit: string;
  mergeReferences: readonly string[];
  reviewers: readonly string[];
  approvals: readonly PullRequestDecision[];
  changeRequests: readonly PullRequestDecision[];
  updates: readonly PullRequestUpdate[];
  lifecycleEvents: readonly PullRequestLifecycleEvent[];
  comments: readonly PullRequestComment[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectForgeCatalog {
  projects: readonly ProjectForgeProject[];
  repositories: readonly ProjectForgeRepository[];
  events: readonly NostrEvent[];
}

export interface ProjectForgeWorkItems {
  tasks: readonly ProjectTaskState[];
  pullRequests: readonly PullRequestState[];
  events: readonly NostrEvent[];
}

export type ProjectForgeCloneAuth = "none" | "nostr" | "provider";

export interface ProjectForgeCloneCapability {
  available: boolean;
  url?: string;
  auth: ProjectForgeCloneAuth;
  provider?: string;
}

export interface ProjectForgeSmartHttpCapability {
  read: boolean;
  write: boolean;
}

export interface ProjectForgeCapabilityLimits {
  maximum_blob_bytes?: number;
  maximum_changed_files?: number;
  maximum_tree_entries?: number;
  maximum_patch_bytes?: number;
  may_truncate_compare?: boolean;
  may_truncate_tree?: boolean;
}

/**
 * Provider-neutral operational capabilities resolved by the relay for a
 * signed kind 30617 repository coordinate.
 */
export interface ProjectForgeRepositoryCapabilities {
  git_authority_backend: string;
  content_backend: string;
  git_backend: string;
  collaboration_backend: string;
  mirror_backend?: string;
  git_replication_target_backend?: string;
  ci_backend?: string;
  clone: ProjectForgeCloneCapability;
  smart_http: ProjectForgeSmartHttpCapability;
  browse: boolean;
  compare: boolean;
  ref_events: boolean;
  provision: boolean;
  import: boolean;
  issues: boolean;
  pull_requests: boolean;
  reviews: boolean;
  merge: boolean;
  mirror: boolean;
  git_replication_target?: boolean;
  ci: boolean;
  local_replica?: boolean;
  replica_state?: string;
  /** Legacy alias retained by the relay during the capability transition. */
  limits?: ProjectForgeCapabilityLimits;
  capability_limits: ProjectForgeCapabilityLimits;
}

export interface ProjectForgeRepositoryCapabilitiesResponse {
  repository: string;
  capabilities: ProjectForgeRepositoryCapabilities;
}

export interface ProjectForgeOperationResult {
  state?: string;
  merged_commit?: string;
}

export interface ProjectForgeOperation {
  operation_id: string;
  state: "pending" | "running" | "projecting" | "retry" | "complete" | "failed";
  command: string;
  repository: string;
  result?: ProjectForgeOperationResult;
  failure?: string;
}

export interface ProjectForgeGitHubConnection {
  id: string;
  provider: "github";
  host: "github.com";
  installation_id: number;
  account_id: string;
  account_login: string;
  bridge_pubkey: string;
  status: string;
  detail?: string;
  updated_at?: string;
}

export interface ProjectForgeGitHubConnectionsResponse {
  connections: readonly ProjectForgeGitHubConnection[];
}

export interface ProjectForgeGitHubConnectionInput {
  appId: string;
  installationId: number;
  credentialRef: string;
  webhookSecretRef: string;
  bridgeCredentialRef: string;
  bridgePubkey: string;
}

export interface ProjectForgeGitHubRepository {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  clone_url: string;
  html_url: string;
  private: boolean;
  archived: boolean;
  disabled: boolean;
  owner: { id: number; login: string };
}

export interface ProjectForgeGitHubRepositoriesResponse {
  repositories: readonly ProjectForgeGitHubRepository[];
}

export interface ProjectForgeAttachGitHubRepositoryInput {
  expectedAnnouncementId: string;
  connectionId: string;
  externalRepositoryId: string;
}

export interface ProjectForgeRepositoryIntegrationResponse {
  integration?: Record<string, unknown>;
  capabilities: ProjectForgeRepositoryCapabilities;
}

export type ProjectForgeRepositoryCapabilitiesByCoordinate = Readonly<
  Record<string, ProjectForgeRepositoryCapabilities>
>;

export interface ProjectForgeRef {
  name: string;
  sha: string;
}

export interface ProjectForgeRefsResponse {
  head: ProjectForgeRef | null;
  refs?: readonly ProjectForgeRef[];
  more?: boolean;
}

/**
 * Return a displayable branch name for a provider-neutral ref. Tag refs are
 * deliberately excluded from branch selectors.
 */
export function projectForgeBranchName(name: string): string | undefined {
  const value = name.trim();
  if (!value) return undefined;
  if (value.startsWith("refs/heads/")) return value.slice("refs/heads/".length);
  if (value.startsWith("heads/")) return value.slice("heads/".length);
  if (value.startsWith("refs/tags/") || value.startsWith("tags/"))
    return undefined;
  return value;
}

/** Build a stable, de-duplicated branch list with the repository head first. */
export function projectForgeBranchRefs(
  response: ProjectForgeRefsResponse,
): readonly ProjectForgeRef[] {
  const branches = new Map<string, ProjectForgeRef>();
  for (const ref of [response.head, ...(response.refs ?? [])]) {
    if (!ref) continue;
    const name = projectForgeBranchName(ref.name);
    if (!name || branches.has(name)) continue;
    branches.set(name, { ...ref, name });
  }
  return [...branches.values()];
}

export interface ProjectForgeTreeEntry {
  name: string;
  /** Repository-relative path when a client has expanded a nested tree. */
  path?: string;
  type: "tree" | "blob";
  mode?: string;
  size?: number;
}

export interface ProjectForgeTreeResponse {
  ref: string;
  sha: string;
  path: string;
  entries: readonly ProjectForgeTreeEntry[];
  readme?: string;
  commit?: ProjectForgeCommit;
}

export interface ProjectForgeBlobResponse {
  name: string;
  path: string;
  contents?: string;
  binary?: boolean;
  too_large?: boolean;
  size?: number;
}

export interface ProjectForgeCommit {
  sha: string;
  subject: string;
  body?: string;
  parents?: readonly string[];
  /** Provider-neutral author name returned by the relay forge gateway. */
  author?: string;
  author_date?: string;
  /** Legacy client fixture alias retained for compatibility. */
  author_name?: string;
  author_email?: string;
  committer?: string;
  commit_date?: string;
}

export interface ProjectForgeCommitActivity {
  projectCoordinate: string;
  repositoryCoordinate: string;
  commit: ProjectForgeCommit;
}

export type ProjectForgeActivityKind =
  | "project"
  | "repository"
  | "task"
  | "comment"
  | "assignment"
  | "review"
  | "review-update"
  | "approval"
  | "changes-requested"
  | "review-request"
  | "commit";

export interface ProjectForgeActivityItem {
  id: string;
  kind: ProjectForgeActivityKind;
  createdAt: number;
  actorPubkey: string;
  action: string;
  title: string;
  body: string;
  detail?: string;
  projectCoordinate: string;
  repositoryCoordinate?: string;
}

export interface ProjectForgeCommitsResponse {
  ref: string;
  sha: string;
  commits: readonly ProjectForgeCommit[];
  more: boolean;
}

export interface ProjectForgeCommitsOptions {
  /** Limit history to entries that changed this repository-relative path. */
  path?: string;
  /** Maximum number of commits requested from the relay gateway. */
  limit?: number;
}

export interface ProjectForgeCommitResponse {
  commit: ProjectForgeCommit;
  stats?: readonly ProjectForgeCommitFileStat[];
  patch?: string;
}

export interface ProjectForgeCommitFileStat {
  path: string;
  old_path?: string;
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface ProjectForgeDiffFile {
  path: string;
  old_path?: string;
  status: string;
  additions: number;
  deletions: number;
  binary?: boolean;
  patch?: string;
}

export interface ProjectForgePullRequestDiff {
  pull_request: string;
  repository: string;
  lifecycle: PullRequestLifecycle;
  base_source: string;
  target_branch?: string;
  base: string;
  head: string;
  merge_base?: string;
  files: readonly ProjectForgeDiffFile[];
  patch: string;
}

export interface ProjectForgeProgress {
  type: "notice" | "progress" | "task";
  message: string;
  data?: unknown;
}

export function parseNostrAddress(
  value: string,
  expectedKind?: number,
): NostrAddress | undefined {
  const parts = value.split(":");
  if (parts.length < 3) return undefined;
  const [kindValue, owner, ...identifierParts] = parts;
  const kind = Number(kindValue);
  const identifier = identifierParts.join(":");
  if (
    !Number.isSafeInteger(kind) ||
    (expectedKind !== undefined && kind !== expectedKind) ||
    !/^[0-9a-f]{64}$/u.test(owner ?? "") ||
    identifier.length === 0
  ) {
    return undefined;
  }
  return { kind, owner: owner!, identifier, coordinate: value };
}

export function eventAddress(event: NostrEvent): NostrAddress | undefined {
  const identifier = firstTagValue(event, "d");
  return identifier === ""
    ? undefined
    : parseNostrAddress(
        `${event.kind}:${event.pubkey}:${identifier}`,
        event.kind,
      );
}

export function tagsNamed(
  event: NostrEvent,
  name: string,
): readonly string[][] {
  return event.tags.filter((tag) => tag[0] === name);
}

export function firstTagValue(event: NostrEvent, name: string): string {
  return tagsNamed(event, name)[0]?.[1] ?? "";
}

export function allTagValues(event: NostrEvent, name: string): string[] {
  return tagsNamed(event, name)
    .flatMap((tag) => tag.slice(1))
    .filter(Boolean);
}

export function rootEventId(event: NostrEvent): string {
  return (
    tagsNamed(event, "E")[0]?.[1] ??
    tagsNamed(event, "e").find(
      (tag) => tag.length < 4 || tag[3] === "root",
    )?.[1] ??
    ""
  );
}

export function compareNewestSmallestId(
  left: NostrEvent,
  right: NostrEvent,
): number {
  return right.created_at - left.created_at || left.id.localeCompare(right.id);
}

export function compareChronological(
  left: NostrEvent,
  right: NostrEvent,
): number {
  return left.created_at - right.created_at || left.id.localeCompare(right.id);
}

export function isFullCommitId(value: string): boolean {
  return /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/u.test(value);
}
