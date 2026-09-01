import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";
import semver from "semver";

import { canonicalHash, canonicalJson } from "./canonical.js";
import { nostrEventSchema, releaseContentSchema } from "./schemas.js";
import type {
  JsonObject,
  JsonValue,
  NostrEvent,
  NostrEventTemplate,
  PluginDefinitionContent,
  RegistryIssue,
  ReleaseContent,
  V1Projection,
} from "./types.js";
import { projectV1Records } from "./projection.js";

export const BUZZ_REGISTRY_KINDS = {
  reaction: 7,
  streamMessage: 9,
  groupMetadata: 39_000,
  groupAdmins: 39_001,
  groupMembers: 39_002,
  forumRoot: 45_001,
  forumVote: 45_002,
  forumReply: 45_003,
} as const;

export const LAPIS_BUZZ_GROUP_PATHS = {
  pluginReleases: "plugin-releases",
  general: "general",
  pluginDevelopment: "plugin-development",
  forums: "forums",
} as const;

export const LAPIS_RELEASE_TOPIC = "lapis-plugin-release";

const DNS_NAMESPACE = Uint8Array.from([
  0x6b, 0xa7, 0xb8, 0x10, 0x9d, 0xad, 0x11, 0xd1, 0x80, 0xb4, 0x00, 0xc0, 0x4f,
  0xd4, 0x30, 0xc8,
]);

export type BuzzCuratorDecision = "approved" | "rejected" | "revoked";

export interface BuzzManifestAttachment {
  url: string;
  mimeType: string;
  sha256: string;
  size: number;
  filename?: string | undefined;
}

export interface BuzzReleaseManifestSource {
  attachmentSha256: string;
  manifest: unknown;
}

export interface BuzzRegistryAuthorities {
  curatorPubkeys: ReadonlySet<string>;
  publisherPubkeysByPlugin: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface BuzzCatalogPlugin {
  content: PluginDefinitionContent;
}

export interface MaterializedBuzzRelease {
  event: NostrEvent;
  content: ReleaseContent;
  attachment: BuzzManifestAttachment;
  decision: BuzzCuratorDecision;
  decisionEvent: NostrEvent;
}

export interface MaterializedBuzzPlugin {
  content: PluginDefinitionContent;
  releases: MaterializedBuzzRelease[];
  latestVersion: string;
}

export interface MaterializedBuzzRegistry {
  schemaVersion: 2;
  root: string;
  plugins: MaterializedBuzzPlugin[];
  acceptedEventIds: string[];
  issues: RegistryIssue[];
}

export interface MaterializeBuzzRegistryOptions {
  verifySignature?: ((event: NostrEvent) => boolean) | undefined;
}

export function lapisBuzzGroupId(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/gu, "");
  if (normalized === "") throw new Error("Buzz group path must not be empty");
  return uuidV5(`registry.lapismd.com/${normalized}`, DNS_NAMESPACE);
}

export function lapisPluginSupportGroupId(pluginId: string): string {
  const normalized = pluginId.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalized)) {
    throw new Error(`Invalid plugin id: ${pluginId}`);
  }
  return lapisBuzzGroupId(`support/${normalized}`);
}

export function createBuzzReleaseMessageTemplate(
  pluginId: string,
  attachment: BuzzManifestAttachment,
  createdAt: number,
  message: string,
): NostrEventTemplate {
  return {
    kind: BUZZ_REGISTRY_KINDS.streamMessage,
    created_at: createdAt,
    content: message,
    tags: [
      ["h", lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.pluginReleases)],
      ["t", LAPIS_RELEASE_TOPIC],
      ["t", `plugin:${pluginId}`],
      [
        "imeta",
        `url ${attachment.url}`,
        `m ${attachment.mimeType}`,
        `x ${attachment.sha256}`,
        `size ${attachment.size}`,
        ...(attachment.filename === undefined
          ? []
          : [`filename ${attachment.filename}`]),
      ],
    ],
  };
}

export function createBuzzCuratorDecisionTemplate(
  releaseEventId: string,
  decision: BuzzCuratorDecision,
  createdAt: number,
): NostrEventTemplate {
  return {
    kind: BUZZ_REGISTRY_KINDS.reaction,
    created_at: createdAt,
    content:
      decision === "approved" ? "✅" : decision === "rejected" ? "❌" : "🚫",
    tags: [["e", releaseEventId]],
  };
}

export function createBuzzForumRootTemplate(
  groupId: string,
  content: string,
  createdAt: number,
): NostrEventTemplate {
  return {
    kind: BUZZ_REGISTRY_KINDS.forumRoot,
    created_at: createdAt,
    content,
    tags: [["h", groupId]],
  };
}

export function createBuzzForumReplyTemplate(
  groupId: string,
  rootEventId: string,
  content: string,
  createdAt: number,
): NostrEventTemplate {
  return {
    kind: BUZZ_REGISTRY_KINDS.forumReply,
    created_at: createdAt,
    content,
    tags: [
      ["h", groupId],
      ["e", rootEventId, "", "reply"],
    ],
  };
}

export function materializeBuzzRegistry(
  input: readonly NostrEvent[],
  manifestSources: readonly BuzzReleaseManifestSource[],
  catalog: readonly BuzzCatalogPlugin[],
  authorities: BuzzRegistryAuthorities,
  options: MaterializeBuzzRegistryOptions = {},
): MaterializedBuzzRegistry {
  const issues: RegistryIssue[] = [];
  const verifySignature = options.verifySignature ?? verifyEvent;
  const events = verifiedDistinctEvents(input, verifySignature, issues);
  const manifests = new Map(
    manifestSources.map((source) => [source.attachmentSha256, source.manifest]),
  );
  const pluginById = new Map(
    catalog.map((plugin) => [plugin.content.pluginId, plugin]),
  );
  const releaseGroup = lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.pluginReleases);
  const releases = new Map<
    string,
    {
      event: NostrEvent;
      content: ReleaseContent;
      attachment: BuzzManifestAttachment;
    }
  >();

  for (const event of events) {
    if (event.kind !== BUZZ_REGISTRY_KINDS.streamMessage) continue;
    if (tagValues(event, "h")[0] !== releaseGroup) continue;
    const topics = new Set(tagValues(event, "t"));
    if (!topics.has(LAPIS_RELEASE_TOPIC)) continue;
    const pluginTopics = [...topics]
      .filter((topic) => topic.startsWith("plugin:"))
      .map((topic) => topic.slice("plugin:".length));
    if (pluginTopics.length !== 1 || !pluginById.has(pluginTopics[0]!)) {
      recordIssue(
        issues,
        event,
        "tags",
        "Release must name one known plugin topic",
      );
      continue;
    }
    const pluginId = pluginTopics[0]!;
    if (
      !authorities.publisherPubkeysByPlugin.get(pluginId)?.has(event.pubkey)
    ) {
      recordIssue(
        issues,
        event,
        "authority",
        "Release signer is not a configured publisher",
      );
      continue;
    }
    const attachment = getBuzzManifestAttachment(event);
    if (attachment === undefined) {
      recordIssue(
        issues,
        event,
        "tags",
        "Release must carry one valid NIP-92 manifest attachment",
      );
      continue;
    }
    const parsedManifest = releaseContentSchema.safeParse(
      manifests.get(attachment.sha256),
    );
    if (!parsedManifest.success || parsedManifest.data.pluginId !== pluginId) {
      recordIssue(
        issues,
        event,
        "content",
        "Release manifest is missing, invalid, or names another plugin",
      );
      continue;
    }
    if (parsedManifest.data.artifact.sha256 === attachment.sha256) {
      recordIssue(
        issues,
        event,
        "content",
        "Manifest attachment hash must be distinct from the plugin bundle hash",
      );
      continue;
    }
    releases.set(event.id, { event, content: parsedManifest.data, attachment });
  }

  const decisions = new Map<
    string,
    { event: NostrEvent; decision: BuzzCuratorDecision }
  >();
  for (const event of events) {
    if (event.kind !== BUZZ_REGISTRY_KINDS.reaction) continue;
    const decision = parseDecision(event.content);
    if (decision === undefined) continue;
    const targets = tagValues(event, "e");
    if (targets.length !== 1 || !releases.has(targets[0]!)) continue;
    if (!authorities.curatorPubkeys.has(event.pubkey)) {
      recordIssue(
        issues,
        event,
        "authority",
        "Registry decision signer is not a configured curator",
      );
      continue;
    }
    const current = decisions.get(targets[0]!);
    if (current === undefined || eventWins(event, current.event)) {
      decisions.set(targets[0]!, { event, decision });
    }
  }

  const plugins: MaterializedBuzzPlugin[] = [];
  for (const [pluginId, plugin] of [...pluginById].toSorted(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const accepted = [...releases.values()]
      .filter((release) => release.content.pluginId === pluginId)
      .flatMap((release): MaterializedBuzzRelease[] => {
        const finalDecision = decisions.get(release.event.id);
        return finalDecision?.decision === "approved"
          ? [
              {
                ...release,
                decision: finalDecision.decision,
                decisionEvent: finalDecision.event,
              },
            ]
          : [];
      })
      .toSorted((left, right) =>
        semver.rcompare(left.content.version, right.content.version),
      );
    if (accepted.length === 0) continue;
    plugins.push({
      content: plugin.content,
      releases: accepted,
      latestVersion: accepted[0]!.content.version,
    });
  }

  const acceptedEventIds = plugins
    .flatMap((plugin) =>
      plugin.releases.flatMap((release) => [
        release.event.id,
        release.decisionEvent.id,
      ]),
    )
    .toSorted();
  const root = canonicalHash({
    schemaVersion: 2,
    acceptedEventIds,
    plugins: plugins.map((plugin) => ({
      pluginId: plugin.content.pluginId,
      latestVersion: plugin.latestVersion,
      releases: plugin.releases.map((release) => ({
        releaseEventId: release.event.id,
        decisionEventId: release.decisionEvent.id,
        version: release.content.version,
        manifestSha256: release.attachment.sha256,
        artifactSha256: release.content.artifact.sha256,
      })),
    })),
  } as JsonObject);

  return { schemaVersion: 2, root, plugins, acceptedEventIds, issues };
}

export function projectBuzzV1(
  registry: MaterializedBuzzRegistry,
  generatedAt: string,
  indexBase?: JsonObject,
): V1Projection {
  return projectV1Records(
    registry.plugins.map((plugin) => ({
      content: plugin.content,
      releases: plugin.releases.map((release) => release.content),
      latestVersion: plugin.latestVersion,
    })),
    { generatedAt, ...(indexBase === undefined ? {} : { indexBase }) },
    {
      backend: "nostr",
      root: registry.root,
      acceptedEventIds: registry.acceptedEventIds,
      exclusionCounts: {},
    },
  );
}

export function getBuzzManifestAttachment(
  event: NostrEvent,
): BuzzManifestAttachment | undefined {
  const imeta = event.tags.filter((tag) => tag[0] === "imeta");
  if (imeta.length !== 1) return undefined;
  const values = new Map<string, string>();
  for (const part of imeta[0]!.slice(1)) {
    const separator = part.indexOf(" ");
    if (separator <= 0) return undefined;
    const key = part.slice(0, separator);
    if (values.has(key)) return undefined;
    values.set(key, part.slice(separator + 1));
  }
  const url = values.get("url");
  const mimeType = values.get("m");
  const sha256 = values.get("x");
  const size = Number(values.get("size"));
  if (
    url === undefined ||
    mimeType === undefined ||
    sha256 === undefined ||
    !/^[0-9a-f]{64}$/u.test(sha256) ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    return undefined;
  }
  const filename = values.get("filename");
  return {
    url,
    mimeType,
    sha256,
    size,
    ...(filename === undefined ? {} : { filename }),
  };
}

function verifiedDistinctEvents(
  input: readonly NostrEvent[],
  verifySignature: (event: NostrEvent) => boolean,
  issues: RegistryIssue[],
): NostrEvent[] {
  const byId = new Map<string, NostrEvent[]>();
  for (const candidate of input) {
    const parsed = nostrEventSchema.safeParse(candidate);
    if (!parsed.success) {
      recordIssue(issues, candidate, "content", "Invalid Nostr event envelope");
      continue;
    }
    const bucket = byId.get(parsed.data.id) ?? [];
    bucket.push(parsed.data);
    byId.set(parsed.data.id, bucket);
  }
  const result: NostrEvent[] = [];
  for (const [id, bucket] of byId) {
    const representations = new Set(
      bucket.map((event) => canonicalJson(event as unknown as JsonValue)),
    );
    if (representations.size > 1) {
      recordIssue(
        issues,
        { id },
        "duplicate-conflict",
        "Conflicting envelopes used the same event id",
      );
    }
    const valid = bucket
      .toSorted((left, right) =>
        canonicalJson(left as unknown as JsonValue).localeCompare(
          canonicalJson(right as unknown as JsonValue),
        ),
      )
      .find(verifySignature);
    if (valid === undefined) {
      recordIssue(
        issues,
        { id },
        "signature",
        "Event id or signature verification failed",
      );
    } else {
      result.push(valid);
    }
  }
  return result;
}

function parseDecision(content: string): BuzzCuratorDecision | undefined {
  switch (content.trim()) {
    case "✅":
      return "approved";
    case "❌":
      return "rejected";
    case "🚫":
      return "revoked";
    default:
      return undefined;
  }
}

function eventWins(candidate: NostrEvent, current: NostrEvent): boolean {
  return (
    candidate.created_at > current.created_at ||
    (candidate.created_at === current.created_at && candidate.id < current.id)
  );
}

function tagValues(event: NostrEvent, name: string): string[] {
  return event.tags.flatMap((tag) =>
    tag[0] === name && tag[1] !== undefined ? [tag[1]] : [],
  );
}

function recordIssue(
  issues: RegistryIssue[],
  event: Pick<NostrEvent, "id">,
  code: RegistryIssue["code"],
  message: string,
): void {
  issues.push({ eventId: event.id, code, message });
}

function uuidV5(name: string, namespace: Uint8Array): string {
  const bytes = sha1(
    Uint8Array.from([...namespace, ...utf8ToBytes(name)]),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
