import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";
import semver from "semver";

import { canonicalHash, canonicalJson } from "./canonical.js";
import {
  nip29RegistryHeadContentSchema,
  nip29PublisherAuthorizationContentSchema,
  nip29ReleaseManifestSchema,
  nostrEventSchema,
} from "./schemas.js";
import type {
  JsonObject,
  JsonValue,
  Nip29RegistryHeadContent,
  Nip29RegistryHeadRelease,
  Nip29PublisherAuthorizationContent,
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
export const LAPIS_PUBLISHER_AUTHORIZATION_TOPIC =
  "lapis-plugin-publisher-authorization";
export const LAPIS_REGISTRY_HEAD_TOPIC = "lapis-plugin-registry-head";

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
  authorityEpoch?: string | undefined;
}

export interface Nip29PublisherAuthorization {
  event: NostrEvent;
  pluginId: string;
  publisherPubkey: string;
  status: Nip29PublisherAuthorizationContent["status"];
}

export interface ParsedNip29Release {
  event: NostrEvent;
  pluginId: string;
  attachment: Nip29ManifestAttachment;
}

export interface ParsedNip29CuratorDecision {
  event: NostrEvent;
  releaseEventId: string;
  decision: Nip29CuratorDecision;
}

export interface ParsedNip29PublisherWithdrawal {
  event: NostrEvent;
  releaseEventId: string;
  decision: "withdrawn";
}

export interface ParsedNip29RegistryHead {
  event: NostrEvent;
  content: Nip29RegistryHeadContent;
}

export interface MaterializedNip29RegistryHead {
  event: NostrEvent;
  content: Nip29RegistryHeadContent;
  fresh: boolean;
}

export interface MaterializedNip29Release {
  event: NostrEvent;
  plugin: PluginDefinitionContent;
  content: ReleaseContent;
  attachment: Nip29ManifestAttachment;
  decision: Nip29CuratorDecision;
  decisionEvent: NostrEvent;
  authorizationEvent?: NostrEvent | undefined;
  head?: MaterializedNip29RegistryHead | undefined;
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
  heads: ReadonlyMap<string, MaterializedNip29RegistryHead>;
}

export interface MaterializeNip29RegistryOptions {
  verifySignature?: ((event: NostrEvent) => boolean) | undefined;
  now?: Date | undefined;
}

interface MaterializableNip29Release {
  event: NostrEvent;
  plugin: PluginDefinitionContent;
  content: ReleaseContent;
  attachment: Nip29ManifestAttachment;
  authorizationEvent?: NostrEvent | undefined;
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

export function createNip29PublisherWithdrawalTemplate(
  releaseEventId: string,
  createdAt: number,
): NostrEventTemplate {
  if (!/^[0-9a-f]{64}$/u.test(releaseEventId)) {
    throw new Error("Release event id must be 32-byte lowercase hex");
  }
  return {
    kind: NIP29_KINDS.reaction,
    created_at: createdAt,
    content: "withdrawn",
    tags: [
      ["h", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
      ["e", releaseEventId],
    ],
  };
}

export function createNip29RegistryHeadTemplate(
  content: Nip29RegistryHeadContent,
  createdAt: number,
): NostrEventTemplate {
  const parsed = nip29RegistryHeadContentSchema.safeParse(content);
  if (!parsed.success || !isCanonicalRegistryHead(parsed.data, createdAt)) {
    throw new Error("Registry head content is invalid or non-canonical");
  }
  return {
    kind: NIP29_KINDS.streamMessage,
    created_at: createdAt,
    content: canonicalJson(parsed.data as unknown as JsonValue),
    tags: [
      ["h", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
      ["t", LAPIS_REGISTRY_HEAD_TOPIC],
      ["t", `plugin:${parsed.data.pluginId}`],
    ],
  };
}

export function createNip29PublisherAuthorizationTemplate(
  pluginId: string,
  publisherPubkey: string,
  status: Nip29PublisherAuthorizationContent["status"],
  createdAt: number,
): NostrEventTemplate {
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(pluginId)) {
    throw new Error(`Invalid plugin id: ${pluginId}`);
  }
  if (!/^[0-9a-f]{64}$/u.test(publisherPubkey)) {
    throw new Error("Publisher public key must be 32-byte lowercase hex");
  }
  return {
    kind: NIP29_KINDS.streamMessage,
    created_at: createdAt,
    content: canonicalJson({
      schema: "lapis.registry.publisher-authorization/1",
      status,
    }),
    tags: [
      ["h", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
      ["t", LAPIS_PUBLISHER_AUTHORIZATION_TOPIC],
      ["t", `plugin:${pluginId}`],
      ["p", publisherPubkey],
    ],
  };
}

export function parseNip29ReleaseEvent(
  event: NostrEvent,
): ParsedNip29Release | undefined {
  if (event.kind !== NIP29_KINDS.streamMessage || event.tags.length !== 4) {
    return undefined;
  }
  const group = exactTagValue(event, "h");
  const topics = tagValues(event, "t");
  const pluginTopics = topics.filter((topic) => topic.startsWith("plugin:"));
  if (
    group !== lapisGroupId(LAPIS_GROUPS.pluginReleases) ||
    topics.length !== 2 ||
    !topics.includes(LAPIS_RELEASE_TOPIC) ||
    pluginTopics.length !== 1
  ) {
    return undefined;
  }
  const pluginId = pluginTopics[0]!.slice("plugin:".length);
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(pluginId)) return undefined;
  const attachment = getNip29ManifestAttachment(event);
  if (attachment === undefined || attachment.mimeType !== "application/json") {
    return undefined;
  }
  if (
    event.tags.some(
      (tag) =>
        (tag[0] !== "h" && tag[0] !== "t" && tag[0] !== "imeta") ||
        (tag[0] !== "imeta" && tag.length !== 2),
    )
  ) {
    return undefined;
  }
  return { event, pluginId, attachment };
}

export function parseNip29PublisherAuthorization(
  event: NostrEvent,
): Nip29PublisherAuthorization | undefined {
  if (event.kind !== NIP29_KINDS.streamMessage || event.tags.length !== 4) {
    return undefined;
  }
  const group = exactTagValue(event, "h");
  const publisherPubkey = exactTagValue(event, "p");
  const topics = tagValues(event, "t");
  const pluginTopics = topics.filter((topic) => topic.startsWith("plugin:"));
  if (
    group !== lapisGroupId(LAPIS_GROUPS.pluginReleases) ||
    publisherPubkey === undefined ||
    !/^[0-9a-f]{64}$/u.test(publisherPubkey) ||
    topics.length !== 2 ||
    !topics.includes(LAPIS_PUBLISHER_AUTHORIZATION_TOPIC) ||
    pluginTopics.length !== 1 ||
    event.tags.some((tag) => tag.length !== 2)
  ) {
    return undefined;
  }
  const pluginId = pluginTopics[0]!.slice("plugin:".length);
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/u.test(pluginId)) return undefined;
  let content: unknown;
  try {
    content = JSON.parse(event.content) as unknown;
  } catch {
    return undefined;
  }
  const parsed = nip29PublisherAuthorizationContentSchema.safeParse(content);
  return parsed.success
    ? { event, pluginId, publisherPubkey, status: parsed.data.status }
    : undefined;
}

export function parseNip29CuratorDecision(
  event: NostrEvent,
  expectedReleaseEventId?: string,
): ParsedNip29CuratorDecision | undefined {
  if (
    event.kind !== NIP29_KINDS.reaction ||
    event.tags.length !== 2 ||
    event.tags.some((tag) => tag.length !== 2)
  ) {
    return undefined;
  }
  const group = exactTagValue(event, "h");
  const releaseEventId = exactTagValue(event, "e");
  const decision = parseDecision(event.content);
  if (
    group !== lapisGroupId(LAPIS_GROUPS.pluginReleases) ||
    releaseEventId === undefined ||
    !/^[0-9a-f]{64}$/u.test(releaseEventId) ||
    (expectedReleaseEventId !== undefined &&
      releaseEventId !== expectedReleaseEventId) ||
    decision === undefined
  ) {
    return undefined;
  }
  return { event, releaseEventId, decision };
}

export function parseNip29PublisherWithdrawal(
  event: NostrEvent,
  expectedReleaseEventId?: string,
): ParsedNip29PublisherWithdrawal | undefined {
  if (
    event.kind !== NIP29_KINDS.reaction ||
    event.content !== "withdrawn" ||
    event.tags.length !== 2 ||
    event.tags.some((tag) => tag.length !== 2)
  ) {
    return undefined;
  }
  const group = exactTagValue(event, "h");
  const releaseEventId = exactTagValue(event, "e");
  if (
    group !== lapisGroupId(LAPIS_GROUPS.pluginReleases) ||
    releaseEventId === undefined ||
    !/^[0-9a-f]{64}$/u.test(releaseEventId) ||
    (expectedReleaseEventId !== undefined &&
      releaseEventId !== expectedReleaseEventId)
  ) {
    return undefined;
  }
  return { event, releaseEventId, decision: "withdrawn" };
}

export function parseNip29RegistryHead(
  event: NostrEvent,
  expectedPluginId?: string,
): ParsedNip29RegistryHead | undefined {
  if (event.kind !== NIP29_KINDS.streamMessage || event.tags.length !== 3) {
    return undefined;
  }
  const group = exactTagValue(event, "h");
  const topics = tagValues(event, "t");
  const pluginTopics = topics.filter((topic) => topic.startsWith("plugin:"));
  if (
    group !== lapisGroupId(LAPIS_GROUPS.pluginReleases) ||
    topics.length !== 2 ||
    !topics.includes(LAPIS_REGISTRY_HEAD_TOPIC) ||
    pluginTopics.length !== 1 ||
    event.tags.some((tag) => tag.length !== 2)
  ) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(event.content) as unknown;
  } catch {
    return undefined;
  }
  const parsed = nip29RegistryHeadContentSchema.safeParse(value);
  const pluginId = pluginTopics[0]!.slice("plugin:".length);
  if (
    !parsed.success ||
    parsed.data.pluginId !== pluginId ||
    (expectedPluginId !== undefined &&
      parsed.data.pluginId !== expectedPluginId) ||
    !isCanonicalRegistryHead(parsed.data, event.created_at)
  ) {
    return undefined;
  }
  return { event, content: parsed.data };
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
  const releases = new Map<string, MaterializableNip29Release>();

  for (const event of events) {
    if (
      event.kind !== NIP29_KINDS.streamMessage ||
      !tagValues(event, "t").includes(LAPIS_RELEASE_TOPIC)
    ) {
      continue;
    }
    const release = parseNip29ReleaseEvent(event);
    if (release === undefined) {
      recordIssue(issues, event, "tags", "Release event shape is invalid");
      continue;
    }
    const authorization = latestNip29PublisherAuthorization(
      events,
      authorities,
      release.pluginId,
      event.pubkey,
    );
    if (
      authorization?.status !== "authorized" &&
      (authorization !== undefined ||
        !isLegacyPublisherAuthorized(
          authorities,
          release.pluginId,
          event.pubkey,
        ))
    ) {
      recordIssue(
        issues,
        event,
        "authority",
        "Release signer is not a configured publisher",
      );
      continue;
    }
    const parsedManifest = nip29ReleaseManifestSchema.safeParse(
      manifests.get(release.attachment.sha256),
    );
    if (
      !parsedManifest.success ||
      parsedManifest.data.plugin.pluginId !== release.pluginId ||
      parsedManifest.data.release.pluginId !== release.pluginId
    ) {
      recordIssue(
        issues,
        event,
        "content",
        "Release manifest is missing, invalid, or names another plugin",
      );
      continue;
    }
    if (
      parsedManifest.data.release.artifact.sha256 === release.attachment.sha256
    ) {
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
      attachment: release.attachment,
      ...(authorization?.status === "authorized"
        ? { authorizationEvent: authorization.event }
        : {}),
    });
  }

  const decisionsById = new Map<
    string,
    {
      event: NostrEvent;
      releaseEventId: string;
      decision: Nip29CuratorDecision;
    }
  >();
  const latestDecisions = new Map<
    string,
    { event: NostrEvent; decision: Nip29CuratorDecision }
  >();
  for (const event of events) {
    const parsedDecision = parseNip29CuratorDecision(event);
    if (
      parsedDecision === undefined ||
      !releases.has(parsedDecision.releaseEventId)
    ) {
      continue;
    }
    if (!authorities.curatorPubkeys.has(event.pubkey)) {
      recordIssue(
        issues,
        event,
        "authority",
        "Registry decision signer is not a configured curator",
      );
      continue;
    }
    decisionsById.set(event.id, {
      event,
      releaseEventId: parsedDecision.releaseEventId,
      decision: parsedDecision.decision,
    });
    const current = latestDecisions.get(parsedDecision.releaseEventId);
    if (current === undefined || eventWins(event, current.event)) {
      latestDecisions.set(parsedDecision.releaseEventId, {
        event,
        decision: parsedDecision.decision,
      });
    }
  }

  const withdrawalsById = new Map<
    string,
    { event: NostrEvent; releaseEventId: string }
  >();
  const latestWithdrawals = new Map<string, NostrEvent>();
  for (const event of events) {
    const withdrawal = parseNip29PublisherWithdrawal(event);
    const release =
      withdrawal === undefined
        ? undefined
        : releases.get(withdrawal.releaseEventId);
    if (withdrawal === undefined || release === undefined) continue;
    if (event.pubkey !== release.event.pubkey) {
      recordIssue(
        issues,
        event,
        "authority",
        "Release withdrawal signer does not own the targeted release",
      );
      continue;
    }
    withdrawalsById.set(event.id, {
      event,
      releaseEventId: withdrawal.releaseEventId,
    });
    const current = latestWithdrawals.get(withdrawal.releaseEventId);
    if (current === undefined || eventWins(event, current)) {
      latestWithdrawals.set(withdrawal.releaseEventId, event);
    }
  }

  const eligibleReleases = validateReleaseSequences(releases, issues);
  const headCandidates = new Map<string, ParsedNip29RegistryHead[]>();
  for (const event of events) {
    if (!tagValues(event, "t").includes(LAPIS_REGISTRY_HEAD_TOPIC)) continue;
    const head = parseNip29RegistryHead(event);
    if (head === undefined) {
      recordIssue(issues, event, "content", "Registry head is invalid");
      continue;
    }
    if (!authorities.curatorPubkeys.has(event.pubkey)) {
      recordIssue(
        issues,
        event,
        "authority",
        "Registry head signer is not a configured curator",
      );
      continue;
    }
    if (
      authorities.authorityEpoch === undefined ||
      head.content.authorityEpoch !== authorities.authorityEpoch
    ) {
      recordIssue(
        issues,
        event,
        "authority",
        "Registry head authority epoch does not match the configured epoch",
      );
      continue;
    }
    const candidates = headCandidates.get(head.content.pluginId) ?? [];
    candidates.push(head);
    headCandidates.set(head.content.pluginId, candidates);
  }

  const heads = new Map<string, MaterializedNip29RegistryHead>();
  for (const [pluginId, candidates] of headCandidates) {
    const head = selectRegistryHeadChain(pluginId, candidates, issues);
    if (
      head === undefined ||
      !headContentMatchesEvidence(
        head,
        eligibleReleases,
        decisionsById,
        withdrawalsById,
        issues,
      )
    ) {
      continue;
    }
    const now = (options.now ?? new Date()).getTime();
    heads.set(pluginId, {
      event: head.event,
      content: head.content,
      fresh:
        Date.parse(head.content.issuedAt) <= now &&
        now <= Date.parse(head.content.validUntil),
    });
  }

  const plugins: MaterializedNip29Plugin[] = [];
  const pluginIds = [
    ...new Set(
      [...releases.values()].map((release) => release.content.pluginId),
    ),
  ].toSorted();
  for (const pluginId of pluginIds) {
    const head = heads.get(pluginId);
    const hadHeadCandidates = headCandidates.has(pluginId);
    const pluginReleases = [...eligibleReleases.values()].filter(
      (release) => release.content.pluginId === pluginId,
    );
    let accepted: MaterializedNip29Release[];
    let activeReleaseEventId: string | undefined;
    if (head !== undefined) {
      activeReleaseEventId = head.content.activeReleaseEventId;
      accepted = head.content.releases.flatMap(
        (headRelease): MaterializedNip29Release[] => {
          if (
            headRelease.state !== "approved" ||
            latestWithdrawals.has(headRelease.releaseEventId)
          ) {
            return [];
          }
          const release = eligibleReleases.get(headRelease.releaseEventId);
          const decision = decisionsById.get(headRelease.decisionEventId);
          return release === undefined || decision?.decision !== "approved"
            ? []
            : [
                {
                  ...release,
                  decision: "approved",
                  decisionEvent: decision.event,
                  head,
                },
              ];
        },
      );
    } else if (hadHeadCandidates) {
      // Head-aware plugins must not silently fall back to legacy selection when
      // their signed checkpoint is malformed, conflicting, or unverifiable.
      accepted = [];
    } else {
      accepted = pluginReleases.flatMap(
        (release): MaterializedNip29Release[] => {
          if (
            release.content.schema !== "lapis.registry.release/1" ||
            latestWithdrawals.has(release.event.id)
          ) {
            return [];
          }
          const finalDecision = latestDecisions.get(release.event.id);
          return finalDecision?.decision === "approved"
            ? [
                {
                  ...release,
                  decision: finalDecision.decision,
                  decisionEvent: finalDecision.event,
                },
              ]
            : [];
        },
      );
    }
    accepted = accepted.toSorted((left, right) => {
      if (left.event.id === activeReleaseEventId) return -1;
      if (right.event.id === activeReleaseEventId) return 1;
      if (
        left.content.schema === "lapis.registry.release/2" &&
        right.content.schema === "lapis.registry.release/2"
      ) {
        return -compareCanonicalDecimal(
          left.content.releaseSequence,
          right.content.releaseSequence,
        );
      }
      return semver.rcompare(left.content.version, right.content.version);
    });
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
        ...(release.head === undefined ? [] : [release.head.event.id]),
        ...(release.authorizationEvent === undefined
          ? []
          : [release.authorizationEvent.id]),
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
        ...(release.authorizationEvent === undefined
          ? {}
          : { authorizationEventId: release.authorizationEvent.id }),
        version: release.content.version,
        manifestSha256: release.attachment.sha256,
        artifactSha256: release.content.artifact.sha256,
        ...(release.content.schema === "lapis.registry.release/2"
          ? { releaseSequence: release.content.releaseSequence }
          : {}),
      })),
      ...(heads.get(plugin.content.pluginId) === undefined
        ? {}
        : {
            headEventId: heads.get(plugin.content.pluginId)!.event.id,
            headRevision: heads.get(plugin.content.pluginId)!.content
              .headRevision,
          }),
    })),
  } as JsonObject);

  return { schemaVersion: 2, root, plugins, acceptedEventIds, issues, heads };
}

export function projectNip29Registry(
  registry: MaterializedNip29Registry,
  generatedAt: string,
  indexBase?: JsonObject,
): RegistryProjection {
  const projection = projectRegistry(
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
  for (const plugin of registry.plugins) {
    const detail = projection.plugins.get(plugin.content.pluginId);
    if (detail === undefined) continue;
    const versions = detail.versions;
    if (
      versions === null ||
      Array.isArray(versions) ||
      typeof versions !== "object"
    ) {
      continue;
    }
    for (const release of plugin.releases) {
      const version = versions[release.content.version];
      if (
        version === null ||
        Array.isArray(version) ||
        typeof version !== "object"
      ) {
        continue;
      }
      versions[release.content.version] = {
        ...version,
        releaseEventId: release.event.id,
        manifestSha256: release.attachment.sha256,
        ...(release.content.schema === "lapis.registry.release/2"
          ? { releaseSequence: release.content.releaseSequence }
          : {}),
      };
    }
  }
  return projection;
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

function validateReleaseSequences(
  releases: ReadonlyMap<string, MaterializableNip29Release>,
  issues: RegistryIssue[],
): Map<string, MaterializableNip29Release> {
  const eligible = new Map(releases);
  const byPlugin = groupValues(
    releases.values(),
    (release) => release.content.pluginId,
  );
  for (const pluginReleases of byPlugin.values()) {
    const byVersion = groupValues(
      pluginReleases,
      (release) => release.content.version,
    );
    const sequenced = pluginReleases.filter(
      (release) => release.content.schema === "lapis.registry.release/2",
    );
    const bySequence = groupValues(sequenced, (release) =>
      release.content.schema === "lapis.registry.release/2"
        ? release.content.releaseSequence
        : "",
    );
    for (const conflicts of [...byVersion.values(), ...bySequence.values()]) {
      if (conflicts.length < 2) continue;
      for (const conflict of conflicts) {
        eligible.delete(conflict.event.id);
        recordIssue(
          issues,
          conflict.event,
          "duplicate-conflict",
          "Plugin releases must use unique versions and release sequences",
        );
      }
    }

    const chain = sequenced
      .filter((release) => eligible.has(release.event.id))
      .toSorted((left, right) =>
        compareCanonicalDecimal(
          left.content.schema === "lapis.registry.release/2"
            ? left.content.releaseSequence
            : "0",
          right.content.schema === "lapis.registry.release/2"
            ? right.content.releaseSequence
            : "0",
        ),
      );
    let previous: MaterializableNip29Release | undefined;
    for (const release of chain) {
      if (release.content.schema !== "lapis.registry.release/2") continue;
      const expected =
        previous === undefined
          ? "1"
          : (
              BigInt(
                previous.content.schema === "lapis.registry.release/2"
                  ? previous.content.releaseSequence
                  : "0",
              ) + 1n
            ).toString();
      const firstPredecessor = release.content.previousReleaseEventId;
      const validFirstPredecessor =
        previous !== undefined ||
        firstPredecessor === undefined ||
        pluginReleases.some(
          (candidate) =>
            candidate.event.id === firstPredecessor &&
            candidate.content.schema === "lapis.registry.release/1",
        );
      if (
        release.content.releaseSequence !== expected ||
        !validFirstPredecessor ||
        (previous !== undefined &&
          release.content.previousReleaseEventId !== previous.event.id)
      ) {
        eligible.delete(release.event.id);
        recordIssue(
          issues,
          release.event,
          "content",
          "Release sequence is not contiguous with its signed predecessor",
        );
        continue;
      }
      previous = release;
    }
  }
  return eligible;
}

function selectRegistryHeadChain(
  pluginId: string,
  candidates: readonly ParsedNip29RegistryHead[],
  issues: RegistryIssue[],
): ParsedNip29RegistryHead | undefined {
  const byRevision = groupValues(
    candidates,
    (head) => head.content.headRevision,
  );
  if ([...byRevision.values()].some((heads) => heads.length > 1)) {
    for (const heads of byRevision.values()) {
      if (heads.length < 2) continue;
      for (const head of heads) {
        recordIssue(
          issues,
          head.event,
          "duplicate-conflict",
          "Conflicting Registry heads use the same revision",
        );
      }
    }
    return undefined;
  }
  const ordered = candidates.toSorted((left, right) =>
    compareCanonicalDecimal(
      left.content.headRevision,
      right.content.headRevision,
    ),
  );
  let previous: ParsedNip29RegistryHead | undefined;
  for (const head of ordered) {
    const expected =
      previous === undefined
        ? "1"
        : (BigInt(previous.content.headRevision) + 1n).toString();
    if (
      head.content.pluginId !== pluginId ||
      head.content.headRevision !== expected ||
      (previous !== undefined &&
        head.content.previousHeadEventId !== previous.event.id)
    ) {
      recordIssue(
        issues,
        head.event,
        "content",
        "Registry head revision is not contiguous with its predecessor",
      );
      return undefined;
    }
    previous = head;
  }
  return previous;
}

function headContentMatchesEvidence(
  head: ParsedNip29RegistryHead,
  releases: ReadonlyMap<string, MaterializableNip29Release>,
  decisionsById: ReadonlyMap<
    string,
    {
      event: NostrEvent;
      releaseEventId: string;
      decision: Nip29CuratorDecision;
    }
  >,
  withdrawalsById: ReadonlyMap<
    string,
    { event: NostrEvent; releaseEventId: string }
  >,
  issues: RegistryIssue[],
): boolean {
  let valid = true;
  for (const item of head.content.releases) {
    const release = releases.get(item.releaseEventId);
    const sequence =
      release?.content.schema === "lapis.registry.release/2"
        ? release.content.releaseSequence
        : item.releaseEventId === head.content.activeReleaseEventId
          ? "0"
          : undefined;
    if (
      release === undefined ||
      release.content.pluginId !== head.content.pluginId ||
      release.content.version !== item.version ||
      release.attachment.sha256 !== item.manifestSha256 ||
      item.releaseSequence !== sequence
    ) {
      valid = false;
      recordIssue(
        issues,
        head.event,
        "content",
        "Registry head release metadata does not match signed release evidence",
      );
      continue;
    }
    if (item.state === "withdrawn") {
      const withdrawal = withdrawalsById.get(item.decisionEventId);
      if (withdrawal?.releaseEventId !== item.releaseEventId) {
        valid = false;
        recordIssue(
          issues,
          head.event,
          "content",
          "Registry head withdrawal does not match publisher evidence",
        );
      }
      continue;
    }
    const decision = decisionsById.get(item.decisionEventId);
    if (
      decision?.releaseEventId !== item.releaseEventId ||
      decision.decision !== item.state
    ) {
      valid = false;
      recordIssue(
        issues,
        head.event,
        "content",
        "Registry head state does not match curator decision evidence",
      );
    }
  }
  return valid;
}

function groupValues<T, K>(
  values: Iterable<T>,
  keyFor: (value: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
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

export function compareCanonicalDecimal(left: string, right: string): number {
  const length = left.length - right.length;
  return length === 0 ? left.localeCompare(right) : length;
}

function compareHeadRelease(
  left: Nip29RegistryHeadRelease,
  right: Nip29RegistryHeadRelease,
): number {
  if (left.releaseSequence === undefined && right.releaseSequence !== undefined)
    return -1;
  if (left.releaseSequence !== undefined && right.releaseSequence === undefined)
    return 1;
  if (
    left.releaseSequence !== undefined &&
    right.releaseSequence !== undefined
  ) {
    const sequence = compareCanonicalDecimal(
      left.releaseSequence,
      right.releaseSequence,
    );
    if (sequence !== 0) return sequence;
  } else {
    const version = semver.compare(left.version, right.version);
    if (version !== 0) return version;
  }
  return left.releaseEventId.localeCompare(right.releaseEventId);
}

function isCanonicalRegistryHead(
  content: Nip29RegistryHeadContent,
  createdAt: number,
): boolean {
  const issuedAt = Date.parse(content.issuedAt);
  const validUntil = Date.parse(content.validUntil);
  const revision = BigInt(content.headRevision);
  const thirtyDays = 30 * 24 * 60 * 60 * 1_000;
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(validUntil) ||
    Math.floor(issuedAt / 1_000) !== createdAt ||
    validUntil <= issuedAt ||
    validUntil - issuedAt > thirtyDays ||
    (revision === 1n) !== (content.previousHeadEventId === undefined)
  ) {
    return false;
  }
  const eventIds = new Set<string>();
  const versions = new Set<string>();
  const sequences = new Set<string>();
  for (const release of content.releases) {
    if (
      eventIds.has(release.releaseEventId) ||
      versions.has(release.version) ||
      (release.releaseSequence !== undefined &&
        sequences.has(release.releaseSequence))
    ) {
      return false;
    }
    eventIds.add(release.releaseEventId);
    versions.add(release.version);
    if (release.releaseSequence !== undefined)
      sequences.add(release.releaseSequence);
  }
  if (
    content.releases.some(
      (release, index) =>
        index > 0 &&
        compareHeadRelease(content.releases[index - 1]!, release) >= 0,
    )
  ) {
    return false;
  }
  if (content.activeReleaseEventId !== undefined) {
    const active = content.releases.find(
      (release) => release.releaseEventId === content.activeReleaseEventId,
    );
    if (active?.state !== "approved") return false;
  }
  return true;
}

export function latestNip29PublisherAuthorization(
  events: readonly NostrEvent[],
  authorities: Nip29RegistryAuthorities,
  pluginId: string,
  publisherPubkey: string,
): Nip29PublisherAuthorization | undefined {
  return events
    .flatMap((event) => {
      const authorization = parseNip29PublisherAuthorization(event);
      return authorization === undefined ||
        authorization.pluginId !== pluginId ||
        authorization.publisherPubkey !== publisherPubkey ||
        !authorities.curatorPubkeys.has(event.pubkey)
        ? []
        : [authorization];
    })
    .toSorted((left, right) =>
      eventWins(left.event, right.event)
        ? -1
        : eventWins(right.event, left.event)
          ? 1
          : 0,
    )[0];
}

export function isNip29PublisherAuthorized(
  events: readonly NostrEvent[],
  authorities: Nip29RegistryAuthorities,
  pluginId: string,
  publisherPubkey: string,
): boolean {
  const authorization = latestNip29PublisherAuthorization(
    events,
    authorities,
    pluginId,
    publisherPubkey,
  );
  return authorization === undefined
    ? isLegacyPublisherAuthorized(authorities, pluginId, publisherPubkey)
    : authorization.status === "authorized";
}

function isLegacyPublisherAuthorized(
  authorities: Nip29RegistryAuthorities,
  pluginId: string,
  publisherPubkey: string,
): boolean {
  const publishers =
    authorities.publisherPubkeysByPlugin.get(pluginId) ??
    authorities.defaultPublisherPubkeys;
  return publishers?.has(publisherPubkey) === true;
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

function exactTagValue(event: NostrEvent, name: string): string | undefined {
  const values = tagValues(event, name);
  return values.length === 1 ? values[0] : undefined;
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
