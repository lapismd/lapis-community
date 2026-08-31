export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type NostrTag = string[];

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: NostrTag[];
  content: string;
  sig: string;
}

export interface NostrEventTemplate {
  kind: number;
  created_at: number;
  tags: NostrTag[];
  content: string;
}

export interface RegistryKindMap {
  softwareApplication: number;
  releaseArtifactSet: number;
  assessmentLabel: number;
  approval: number;
  revocation: number;
  moderationReport: number;
  snapshot: number;
  fileMetadata: number;
  comment: number;
}

export interface PluginDefinitionContent {
  schema: "lapis.registry.plugin/1";
  pluginId: string;
  name: string;
  description: string;
  channel: string;
  status: "active" | "deprecated" | "disabled" | "pending" | "revoked";
  index: JsonObject;
  detail: JsonObject;
}

export interface ReleaseArtifact {
  url: string;
  downloadUrl?: string | undefined;
  sha256: string;
  size: number;
}

export interface ReleaseContent {
  schema: "lapis.registry.release/1";
  pluginId: string;
  version: string;
  minAppVersion: string;
  platforms: string[];
  releasedAt: string;
  artifact: ReleaseArtifact;
  metadata: JsonObject;
}

export interface AssessmentCheck {
  id: string;
  status: "pass" | "fail" | "warn";
  message?: string | undefined;
}

export interface AssessmentContent {
  schema: "lapis.registry.assessment/1";
  releaseEventId: string;
  artifactSha256: string;
  status: "pass" | "fail";
  checks: AssessmentCheck[];
}

export interface ApprovalContent {
  schema: "lapis.registry.approval/1";
  pluginId: string;
  version: string;
  releaseEventId: string;
  assessmentEventId: string;
  artifactSha256: string;
  decision: "approved" | "rejected";
  reason?: string | undefined;
}

export type RevocationTarget =
  | { scope: "artifact"; sha256: string }
  | { scope: "plugin"; pluginId: string }
  | { scope: "publisher"; pubkey: string }
  | { scope: "release"; releaseEventId: string };

export interface RevocationContent {
  schema: "lapis.registry.revocation/1";
  target: RevocationTarget;
  reason: string;
}

export type ModerationTarget =
  | { type: "event"; eventId: string }
  | { type: "plugin"; pluginId: string }
  | { type: "publisher"; pubkey: string };

export interface ModerationContent {
  schema: "lapis.registry.moderation/1";
  target: ModerationTarget;
  action: "allow" | "hide" | "mute";
  reason: string;
}

export interface SnapshotContent {
  schema: "lapis.registry.snapshot/1";
  root: string;
  eventIds: string[];
  pluginCount: number;
  excludedEventCount: number;
  generatedAt: string;
}

export type RegistryContent =
  | ApprovalContent
  | AssessmentContent
  | ModerationContent
  | PluginDefinitionContent
  | ReleaseContent
  | RevocationContent
  | SnapshotContent;

export interface RegistryAuthorities {
  assessorPubkeys: ReadonlySet<string>;
  curatorPubkeys: ReadonlySet<string>;
  moderatorPubkeys: ReadonlySet<string>;
  snapshotSignerPubkeys: ReadonlySet<string>;
  registryOperatorPubkeys: ReadonlySet<string>;
  publisherPubkeysByPlugin?: ReadonlyMap<string, ReadonlySet<string>>;
}

export type RegistryIssueCode =
  | "authority"
  | "content"
  | "duplicate-conflict"
  | "reference"
  | "signature"
  | "tags";

export interface RegistryIssue {
  eventId: string;
  code: RegistryIssueCode;
  message: string;
}

export type ExclusionReason =
  | "artifact-revoked"
  | "assessment-missing"
  | "approval-missing"
  | "event-hidden"
  | "plugin-hidden"
  | "plugin-revoked"
  | "plugin-status"
  | "publisher-muted"
  | "publisher-revoked"
  | "release-revoked";

export interface RegistryExclusion {
  eventId: string;
  pluginId?: string;
  reason: ExclusionReason;
}

export interface MaterializedRelease {
  event: NostrEvent;
  content: ReleaseContent;
  assessmentEvent: NostrEvent;
  assessment: AssessmentContent;
  approvalEvent: NostrEvent;
  approval: ApprovalContent;
}

export interface MaterializedPlugin {
  event: NostrEvent;
  content: PluginDefinitionContent;
  releases: MaterializedRelease[];
  latestVersion: string;
}

export interface MaterializedRegistry {
  schemaVersion: 1;
  root: string;
  plugins: MaterializedPlugin[];
  acceptedEventIds: string[];
  exclusions: RegistryExclusion[];
  exclusionCounts: Partial<Record<ExclusionReason, number>>;
  issues: RegistryIssue[];
}

export interface V1Projection {
  index: JsonObject;
  plugins: ReadonlyMap<string, JsonObject>;
  provenance: {
    backend: "nostr";
    root: string;
    acceptedEventIds: string[];
    exclusionCounts: Partial<Record<ExclusionReason, number>>;
  };
}

export interface V1ProjectionPlugin {
  content: PluginDefinitionContent;
  releases: ReleaseContent[];
  latestVersion: string;
}

export interface V1ProjectionOptions {
  generatedAt: string;
  indexBase?: JsonObject | undefined;
}
