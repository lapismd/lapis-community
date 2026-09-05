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

export interface Nip29ReleaseManifest {
  schema: "lapis.registry.nip29-release/1";
  plugin: PluginDefinitionContent;
  release: ReleaseContent;
}

export interface Nip29PublisherAuthorizationContent {
  schema: "lapis.registry.publisher-authorization/1";
  status: "authorized" | "revoked";
}

export interface NostrReleaseProofManifest {
  sha256: string;
  size: number;
  content: string;
}

export interface NostrReleaseProof {
  schema: "lapis.plugin.release-proof/1";
  authorizationEvent: NostrEvent;
  releaseEvent: NostrEvent;
  decisionEvent: NostrEvent;
  manifest: NostrReleaseProofManifest;
}

export interface NostrReleaseArtifactReference {
  sha256: string;
  size: number;
}

export interface VerifiedNostrReleaseProof {
  pluginId: string;
  version: string;
  authorizationEventId: string;
  releaseEventId: string;
  decisionEventId: string;
  manifestSha256: string;
  artifactSha256: string;
  artifactSize: number;
  requiresRelayRefresh: true;
  manifest: Nip29ReleaseManifest;
}

export interface RegistryIssue {
  eventId: string;
  code: "authority" | "content" | "duplicate-conflict" | "signature" | "tags";
  message: string;
}

export interface RegistryProjectionPlugin {
  content: PluginDefinitionContent;
  releases: ReleaseContent[];
  latestVersion: string;
}

export interface RegistryProjectionOptions {
  generatedAt: string;
  indexBase?: JsonObject;
}

export interface RegistryProjection {
  index: JsonObject;
  plugins: Map<string, JsonObject>;
  provenance: {
    backend: "nostr";
    root: string;
    acceptedEventIds: string[];
    exclusionCounts: Record<string, number>;
  };
}
