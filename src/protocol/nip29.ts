import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";
import semver from "semver";

import { canonicalHash, canonicalJson } from "./canonical.js";
import { nip29ReleaseManifestSchema, nostrEventSchema } from "./schemas.js";
import type {
  JsonObject,
  JsonValue,
  NostrEvent,
  NostrEventTemplate,
  PluginDefinitionContent,
  RegistryIssue,
  ReleaseContent,
  RegistryProjection,
} from "./types.js";
import { projectRegistry } from "./projection.js";

export const NIP29_KINDS = {
  reaction: 7,
  streamMessage: 9,
  groupMetadata: 39_000,
  groupAdmins: 39_001,
  groupMembers: 39_002,
  forumThread: 11,
  comment: 1_111,
} as const;

export const LAPIS_GROUPS = {
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

export type Nip29CuratorDecision = "approved" | "rejected" | "revoked";

export interface Nip29ManifestAttachment {
  url: string;
  mimeType: string;
  sha256: string;
  size: number;
  filename?: string | undefined;
}

export interface Nip29ReleaseManifestSource {
  attachmentSha256: string;
  manifest: unknown;
}

export interface Nip29RegistryAuthorities {
  curatorPubkeys: ReadonlySet<string>;
  publisherPubkeysByPlugin: ReadonlyMap<string, ReadonlySet<string>>;
  defaultPublisherPubkeys?: ReadonlySet<string> | undefined;
}

export interface MaterializedNip29Release {
  event: NostrEvent;
  plugin: PluginDefinitionContent;
  content: ReleaseContent;
  attachment: Nip29ManifestAttachment;
  decision: Nip29CuratorDecision;
  decisionEvent: NostrEvent;
}

export interface MaterializedNip29Plugin {
  content: PluginDefinitionContent;
  releases: MaterializedNip29Release[];
  latestVersion: string;
}

export interface MaterializedNip29Registry {
  schemaVersion: 2;
  root: string;
  plugins: MaterializedNip29Plugin[];
  acceptedEventIds: string[];
  issues: RegistryIssue[];
}

export interface MaterializeNip29RegistryOptions {
  verifySignature?: ((event: NostrEvent) => boolean) | undefined;
}

export function lapisGroupId(path: string): string {
  const normalized = path.trim().replace(/^\/+|\/+$/gu, "");
  if (normalized === "") throw new Error("NIP-29 group path must not be empty");
  return uuidV5(`community.lapis.md/${normalized}`, DNS_NAMESPACE);
}

export function lapisPluginSupportGroupId(pluginId: string): string {
  const normalized = pluginId.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalized)) {
    throw new Error(`Invalid plugin id: ${pluginId}`);
  }
  return lapisGroupId(`support/${normalized}`);
}

export function createNip29ReleaseMessageTemplate(
  pluginId: string,
  attachment: Nip29ManifestAttachment,
  createdAt: number,
  message: string,
): NostrEventTemplate {
  return {
    kind: NIP29_KINDS.streamMessage,
    created_at: createdAt,
    content: message,
    tags: [
      ["h", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
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

export function createNip29CuratorDecisionTemplate(
  releaseEventId: string,
  decision: Nip29CuratorDecision,
  createdAt: number,
): NostrEventTemplate {
  return {
    kind: NIP29_KINDS.reaction,
    created_at: createdAt,
    content:
      decision === "approved" ? "✅" : decision === "rejected" ? "❌" : "🚫",
    tags: [
      ["h", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
      ["e", releaseEventId],
    ],
  };
}

export function createNip29ForumThreadTemplate(
  groupId: string,
  content: string,
  createdAt: number,
): NostrEventTemplate {
  const title =
    content.trim().split(/\r?\n/u)[0]?.slice(0, 120) || "Discussion";
  return {
    kind: NIP29_KINDS.forumThread,
    created_at: createdAt,
    content,
    tags: [
      ["h", groupId],
      ["title", title],
    ],
  };
}

export function createNip29ForumCommentTemplate(
  groupId: string,
  root: Pick<NostrEvent, "id" | "kind" | "pubkey">,
  parent: Pick<NostrEvent, "id" | "kind" | "pubkey">,
  content: string,
  createdAt: number,
  relayUrl = "",
): NostrEventTemplate {
  if (root.kind !== NIP29_KINDS.forumThread) {
    throw new Error("NIP-22 forum comments must target a kind 11 thread");
  }
  if (
    parent.kind !== NIP29_KINDS.forumThread &&
    parent.kind !== NIP29_KINDS.comment
  ) {
    throw new Error("NIP-22 forum comment parent must be a thread or comment");
  }
  return {
    kind: NIP29_KINDS.comment,
    created_at: createdAt,
    content,
    tags: [
      ["h", groupId],
      ["E", root.id, relayUrl, root.pubkey],
      ["K", root.kind.toString()],
      ["P", root.pubkey, relayUrl],
      ["e", parent.id, relayUrl, parent.pubkey],
      ["k", parent.kind.toString()],
      ["p", parent.pubkey, relayUrl],
    ],
  };
}

export function materializeNip29Registry(
  input: readonly NostrEvent[],
  manifestSources: readonly Nip29ReleaseManifestSource[],
  authorities: Nip29RegistryAuthorities,
  options: MaterializeNip29RegistryOptions = {},
): MaterializedNip29Registry {
  const issues: RegistryIssue[] = [];
  const verifySignature = options.verifySignature ?? verifyEvent;
  const events = verifiedDistinctEvents(input, verifySignature, issues);
  const manifests = new Map(
    manifestSources.map((source) => [source.attachmentSha256, source.manifest]),
  );
  const releaseGroup = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  const releases = new Map<
    string,
    {
      event: NostrEvent;
      plugin: PluginDefinitionContent;
      content: ReleaseContent;
      attachment: Nip29ManifestAttachment;
    }
  >();

  for (const event of events) {
    if (event.kind !== NIP29_KINDS.streamMessage) continue;
    if (tagValues(event, "h")[0] !== releaseGroup) continue;
    const topics = new Set(tagValues(event, "t"));
    if (!topics.has(LAPIS_RELEASE_TOPIC)) continue;
    const pluginTopics = [...topics]
      .filter((topic) => topic.startsWith("plugin:"))
      .map((topic) => topic.slice("plugin:".length));
    if (pluginTopics.length !== 1) {
      recordIssue(
        issues,
        event,
        "tags",
        "Release must name exactly one plugin topic",
      );
      continue;
    }
    const pluginId = pluginTopics[0]!;
    const publishers =
      authorities.publisherPubkeysByPlugin.get(pluginId) ??
      authorities.defaultPublisherPubkeys;
    if (!publishers?.has(event.pubkey)) {
      recordIssue(
        issues,
        event,
        "authority",
        "Release signer is not a configured publisher",
      );
      continue;
    }
    const attachment = getNip29ManifestAttachment(event);
    if (attachment === undefined) {
      recordIssue(
        issues,
        event,
        "tags",
        "Release must carry one valid NIP-92 manifest attachment",
      );
      continue;
    }
    const parsedManifest = nip29ReleaseManifestSchema.safeParse(
      manifests.get(attachment.sha256),
    );
    if (
      !parsedManifest.success ||
      parsedManifest.data.plugin.pluginId !== pluginId ||
      parsedManifest.data.release.pluginId !== pluginId
    ) {
      recordIssue(
        issues,
        event,
        "content",
        "Release manifest is missing, invalid, or names another plugin",
      );
      continue;
    }
    if (parsedManifest.data.release.artifact.sha256 === attachment.sha256) {
      recordIssue(
        issues,
        event,
        "content",
        "Manifest attachment hash must be distinct from the plugin bundle hash",
      );
      continue;
    }
    releases.set(event.id, {
      event,
      plugin: parsedManifest.data.plugin,
      content: parsedManifest.data.release,
      attachment,
    });
  }

  const decisions = new Map<
    string,
    { event: NostrEvent; decision: Nip29CuratorDecision }
  >();
  for (const event of events) {
    if (event.kind !== NIP29_KINDS.reaction) continue;
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

  const plugins: MaterializedNip29Plugin[] = [];
  const pluginIds = [
    ...new Set(
      [...releases.values()].map((release) => release.content.pluginId),
    ),
  ].toSorted();
  for (const pluginId of pluginIds) {
    const accepted = [...releases.values()]
      .filter((release) => release.content.pluginId === pluginId)
      .flatMap((release): MaterializedNip29Release[] => {
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
      content: accepted[0]!.plugin,
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

export function projectNip29Registry(
  registry: MaterializedNip29Registry,
  generatedAt: string,
  indexBase?: JsonObject,
): RegistryProjection {
  return projectRegistry(
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

export function getNip29ManifestAttachment(
  event: NostrEvent,
): Nip29ManifestAttachment | undefined {
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

function parseDecision(content: string): Nip29CuratorDecision | undefined {
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
