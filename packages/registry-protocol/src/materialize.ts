import { verifyEvent } from "nostr-tools/pure";
import semver from "semver";

import { isPublisherAllowed, isRegistryOperator } from "./authority.js";
import { canonicalHash, canonicalJson } from "./canonical.js";
import {
  approvalContentSchema,
  assessmentContentSchema,
  moderationContentSchema,
  nostrEventSchema,
  parseJsonContent,
  pluginDefinitionContentSchema,
  releaseContentSchema,
  revocationContentSchema,
  snapshotContentSchema,
} from "./schemas.js";
import {
  validateApprovalTags,
  validateAssessmentTags,
  validateModerationTags,
  validatePluginTags,
  validateReleaseTags,
  validateRevocationTags,
  validateSnapshotTags,
} from "./tags.js";
import type {
  ApprovalContent,
  AssessmentContent,
  ExclusionReason,
  JsonObject,
  JsonValue,
  MaterializedPlugin,
  MaterializedRegistry,
  MaterializedRelease,
  ModerationContent,
  NostrEvent,
  PluginDefinitionContent,
  RegistryAuthorities,
  RegistryExclusion,
  RegistryIssue,
  RegistryKindMap,
  ReleaseContent,
  RevocationContent,
  SnapshotContent,
} from "./types.js";

interface Parsed<T> {
  event: NostrEvent;
  content: T;
}

export interface MaterializeOptions {
  verifySignature?: (event: NostrEvent) => boolean;
}

function eventWins(candidate: NostrEvent, current: NostrEvent): boolean {
  return (
    candidate.created_at > current.created_at ||
    (candidate.created_at === current.created_at && candidate.id < current.id)
  );
}

function later<T extends { event: NostrEvent }>(left: T, right: T): T {
  return eventWins(right.event, left.event) ? right : left;
}

function issue(
  issues: RegistryIssue[],
  event: Pick<NostrEvent, "id">,
  code: RegistryIssue["code"],
  message: string,
): void {
  issues.push({ eventId: event.id, code, message });
}

function moderationKey(target: ModerationContent["target"]): string {
  switch (target.type) {
    case "event":
      return `event:${target.eventId}`;
    case "plugin":
      return `plugin:${target.pluginId}`;
    case "publisher":
      return `publisher:${target.pubkey}`;
  }
}

function isModerated(
  moderation: ReadonlyMap<string, Parsed<ModerationContent>>,
  key: string,
): boolean {
  const action = moderation.get(key)?.content.action;
  return action === "hide" || action === "mute";
}

function revocationSets(revocations: Parsed<RevocationContent>[]): {
  artifacts: Set<string>;
  plugins: Set<string>;
  publishers: Set<string>;
  releases: Set<string>;
} {
  const result = {
    artifacts: new Set<string>(),
    plugins: new Set<string>(),
    publishers: new Set<string>(),
    releases: new Set<string>(),
  };

  for (const { content } of revocations) {
    switch (content.target.scope) {
      case "artifact":
        result.artifacts.add(content.target.sha256);
        break;
      case "plugin":
        result.plugins.add(content.target.pluginId);
        break;
      case "publisher":
        result.publishers.add(content.target.pubkey);
        break;
      case "release":
        result.releases.add(content.target.releaseEventId);
        break;
    }
  }

  return result;
}

function recordExclusion(
  exclusions: RegistryExclusion[],
  event: NostrEvent,
  reason: ExclusionReason,
  pluginId?: string,
): void {
  if (exclusions.some((item) => item.eventId === event.id)) {
    return;
  }

  exclusions.push({
    eventId: event.id,
    reason,
    ...(pluginId === undefined ? {} : { pluginId }),
  });
}

function rootInput(
  plugins: MaterializedPlugin[],
  acceptedEventIds: string[],
  exclusions: RegistryExclusion[],
): JsonObject {
  return {
    schemaVersion: 1,
    acceptedEventIds,
    exclusions: exclusions.map((item) => ({ ...item })),
    plugins: plugins.map((plugin) => ({
      eventId: plugin.event.id,
      pluginId: plugin.content.pluginId,
      latestVersion: plugin.latestVersion,
      releases: plugin.releases.map((release) => ({
        eventId: release.event.id,
        assessmentEventId: release.assessmentEvent.id,
        approvalEventId: release.approvalEvent.id,
        artifactSha256: release.content.artifact.sha256,
        version: release.content.version,
      })),
    })),
  } as JsonObject;
}

function parseEvents(
  input: readonly NostrEvent[],
  kinds: RegistryKindMap,
  authorities: RegistryAuthorities,
  verifySignature: (event: NostrEvent) => boolean,
  issues: RegistryIssue[],
): {
  approvals: Parsed<ApprovalContent>[];
  assessments: Parsed<AssessmentContent>[];
  moderation: Parsed<ModerationContent>[];
  plugins: Parsed<PluginDefinitionContent>[];
  releases: Parsed<ReleaseContent>[];
  revocations: Parsed<RevocationContent>[];
} {
  const candidates = new Map<string, NostrEvent[]>();

  for (const unknownEvent of input) {
    const parsedEvent = nostrEventSchema.safeParse(unknownEvent);
    if (!parsedEvent.success) {
      issue(issues, unknownEvent, "content", "Invalid Nostr event envelope");
      continue;
    }

    const bucket = candidates.get(parsedEvent.data.id) ?? [];
    bucket.push(parsedEvent.data);
    candidates.set(parsedEvent.data.id, bucket);
  }

  const events: NostrEvent[] = [];
  for (const [eventId, bucket] of candidates) {
    const ordered = bucket.toSorted((left, right) =>
      canonicalJson(left as unknown as JsonValue).localeCompare(
        canonicalJson(right as unknown as JsonValue),
      ),
    );
    const distinct = new Set(
      ordered.map((event) => canonicalJson(event as unknown as JsonValue)),
    );
    if (distinct.size > 1) {
      issue(
        issues,
        { id: eventId },
        "duplicate-conflict",
        "Conflicting envelopes used the same event id",
      );
    }

    const valid = ordered.find(verifySignature);
    if (valid === undefined) {
      issue(
        issues,
        { id: eventId },
        "signature",
        "Event id or signature verification failed",
      );
      continue;
    }
    events.push(valid);
  }

  const result = {
    approvals: [] as Parsed<ApprovalContent>[],
    assessments: [] as Parsed<AssessmentContent>[],
    moderation: [] as Parsed<ModerationContent>[],
    plugins: [] as Parsed<PluginDefinitionContent>[],
    releases: [] as Parsed<ReleaseContent>[],
    revocations: [] as Parsed<RevocationContent>[],
  };

  for (const event of events) {
    const content = parseJsonContent(event.content);

    if (event.kind === kinds.softwareApplication) {
      const parsed = pluginDefinitionContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid plugin definition content");
      } else if (!validatePluginTags(event, parsed.data)) {
        issue(
          issues,
          event,
          "tags",
          "Plugin definition tags do not match content",
        );
      } else if (
        !isPublisherAllowed(authorities, parsed.data.pluginId, event.pubkey)
      ) {
        issue(
          issues,
          event,
          "authority",
          "Publisher is not allowed for plugin",
        );
      } else {
        result.plugins.push({ event, content: parsed.data });
      }
      continue;
    }

    if (event.kind === kinds.releaseArtifactSet) {
      const parsed = releaseContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid release content");
      } else if (!validateReleaseTags(event, parsed.data, kinds)) {
        issue(issues, event, "tags", "Release tags do not match content");
      } else if (
        !isPublisherAllowed(authorities, parsed.data.pluginId, event.pubkey)
      ) {
        issue(
          issues,
          event,
          "authority",
          "Publisher is not allowed for plugin",
        );
      } else {
        result.releases.push({ event, content: parsed.data });
      }
      continue;
    }

    if (event.kind === kinds.assessmentLabel) {
      const parsed = assessmentContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid assessment content");
      } else if (!validateAssessmentTags(event, parsed.data)) {
        issue(issues, event, "tags", "Assessment tags do not match content");
      } else if (!authorities.assessorPubkeys.has(event.pubkey)) {
        issue(issues, event, "authority", "Assessment signer is not trusted");
      } else {
        result.assessments.push({ event, content: parsed.data });
      }
      continue;
    }

    if (event.kind === kinds.approval) {
      const parsed = approvalContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid approval content");
      } else if (!validateApprovalTags(event, parsed.data)) {
        issue(issues, event, "tags", "Approval tags do not match content");
      } else if (!authorities.curatorPubkeys.has(event.pubkey)) {
        issue(issues, event, "authority", "Approval signer is not a curator");
      } else {
        result.approvals.push({ event, content: parsed.data });
      }
      continue;
    }

    if (event.kind === kinds.revocation) {
      const parsed = revocationContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid revocation content");
      } else if (!validateRevocationTags(event, parsed.data)) {
        issue(issues, event, "tags", "Revocation tags do not match content");
      } else if (!isRegistryOperator(authorities, event.pubkey)) {
        issue(
          issues,
          event,
          "authority",
          "Revocation signer is not an operator",
        );
      } else {
        result.revocations.push({ event, content: parsed.data });
      }
      continue;
    }

    if (event.kind === kinds.moderationReport) {
      const parsed = moderationContentSchema.safeParse(content);
      if (!parsed.success) {
        issue(issues, event, "content", "Invalid moderation content");
      } else if (!validateModerationTags(event, parsed.data)) {
        issue(issues, event, "tags", "Moderation tags do not match content");
      } else if (!authorities.moderatorPubkeys.has(event.pubkey)) {
        issue(issues, event, "authority", "Moderation signer is not trusted");
      } else {
        result.moderation.push({ event, content: parsed.data });
      }
    }
  }

  return result;
}

export function materializeRegistry(
  input: readonly NostrEvent[],
  kinds: RegistryKindMap,
  authorities: RegistryAuthorities,
  options: MaterializeOptions = {},
): MaterializedRegistry {
  const issues: RegistryIssue[] = [];
  const verifySignature = options.verifySignature ?? verifyEvent;
  const parsed = parseEvents(
    input,
    kinds,
    authorities,
    verifySignature,
    issues,
  );

  const pluginWinners = new Map<string, Parsed<PluginDefinitionContent>>();
  for (const plugin of parsed.plugins) {
    const current = pluginWinners.get(plugin.content.pluginId);
    pluginWinners.set(
      plugin.content.pluginId,
      current === undefined ? plugin : later(current, plugin),
    );
  }

  const assessmentWinners = new Map<string, Parsed<AssessmentContent>>();
  for (const assessment of parsed.assessments) {
    const key = `${assessment.event.pubkey}:${assessment.content.releaseEventId}`;
    const current = assessmentWinners.get(key);
    assessmentWinners.set(
      key,
      current === undefined ? assessment : later(current, assessment),
    );
  }

  const approvalWinners = new Map<string, Parsed<ApprovalContent>>();
  for (const approval of parsed.approvals) {
    const key = `${approval.event.pubkey}:${approval.content.releaseEventId}`;
    const current = approvalWinners.get(key);
    approvalWinners.set(
      key,
      current === undefined ? approval : later(current, approval),
    );
  }

  const moderation = new Map<string, Parsed<ModerationContent>>();
  for (const decision of parsed.moderation) {
    const key = moderationKey(decision.content.target);
    const current = moderation.get(key);
    moderation.set(
      key,
      current === undefined ? decision : later(current, decision),
    );
  }

  const revoked = revocationSets(parsed.revocations);
  const exclusions: RegistryExclusion[] = [];
  const plugins: MaterializedPlugin[] = [];

  for (const plugin of [...pluginWinners.values()].sort((left, right) =>
    left.content.pluginId.localeCompare(right.content.pluginId),
  )) {
    const pluginId = plugin.content.pluginId;
    let pluginExclusion: ExclusionReason | undefined;
    if (
      plugin.content.status === "disabled" ||
      plugin.content.status === "pending" ||
      plugin.content.status === "revoked"
    )
      pluginExclusion = "plugin-status";
    else if (revoked.plugins.has(pluginId)) pluginExclusion = "plugin-revoked";
    else if (revoked.publishers.has(plugin.event.pubkey))
      pluginExclusion = "publisher-revoked";
    else if (isModerated(moderation, `plugin:${pluginId}`))
      pluginExclusion = "plugin-hidden";
    else if (isModerated(moderation, `publisher:${plugin.event.pubkey}`))
      pluginExclusion = "publisher-muted";
    else if (isModerated(moderation, `event:${plugin.event.id}`))
      pluginExclusion = "event-hidden";

    const acceptedByVersion = new Map<string, MaterializedRelease>();
    const matchingReleases = parsed.releases.filter(
      (release) =>
        release.content.pluginId === pluginId &&
        release.event.pubkey === plugin.event.pubkey,
    );

    for (const release of matchingReleases) {
      let exclusion = pluginExclusion;
      if (exclusion === undefined && revoked.releases.has(release.event.id))
        exclusion = "release-revoked";
      if (
        exclusion === undefined &&
        revoked.artifacts.has(release.content.artifact.sha256)
      )
        exclusion = "artifact-revoked";
      if (
        exclusion === undefined &&
        isModerated(moderation, `event:${release.event.id}`)
      )
        exclusion = "event-hidden";

      const passingAssessments = [...assessmentWinners.values()].filter(
        (assessment) =>
          assessment.content.releaseEventId === release.event.id &&
          assessment.content.artifactSha256 ===
            release.content.artifact.sha256 &&
          assessment.content.status === "pass",
      );
      if (exclusion === undefined && passingAssessments.length === 0) {
        exclusion = "assessment-missing";
      }

      const passingById = new Map(
        passingAssessments.map((assessment) => [
          assessment.event.id,
          assessment,
        ]),
      );
      const approvals = [...approvalWinners.values()].filter(
        (approval) =>
          approval.content.releaseEventId === release.event.id &&
          approval.content.pluginId === pluginId &&
          approval.content.version === release.content.version &&
          approval.content.artifactSha256 === release.content.artifact.sha256 &&
          approval.content.decision === "approved" &&
          passingById.has(approval.content.assessmentEventId),
      );
      if (exclusion === undefined && approvals.length === 0) {
        exclusion = "approval-missing";
      }

      if (exclusion !== undefined) {
        recordExclusion(exclusions, release.event, exclusion, pluginId);
        continue;
      }

      const approval = approvals.reduce(later);
      const assessment = passingById.get(approval.content.assessmentEventId);
      if (assessment === undefined) {
        issue(
          issues,
          approval.event,
          "reference",
          "Approval did not resolve to a passing assessment",
        );
        continue;
      }

      const materialized: MaterializedRelease = {
        event: release.event,
        content: release.content,
        assessmentEvent: assessment.event,
        assessment: assessment.content,
        approvalEvent: approval.event,
        approval: approval.content,
      };
      const current = acceptedByVersion.get(release.content.version);
      acceptedByVersion.set(
        release.content.version,
        current === undefined ? materialized : later(current, materialized),
      );
    }

    const releases = [...acceptedByVersion.values()].sort((left, right) =>
      semver.compare(left.content.version, right.content.version),
    );
    if (releases.length === 0) {
      if (pluginExclusion !== undefined) {
        recordExclusion(exclusions, plugin.event, pluginExclusion, pluginId);
      }
      continue;
    }

    const latestRelease = releases.at(-1);
    if (latestRelease === undefined) continue;
    plugins.push({
      event: plugin.event,
      content: plugin.content,
      releases,
      latestVersion: latestRelease.content.version,
    });
  }

  exclusions.sort(
    (left, right) =>
      left.eventId.localeCompare(right.eventId) ||
      left.reason.localeCompare(right.reason),
  );
  issues.sort(
    (left, right) =>
      left.eventId.localeCompare(right.eventId) ||
      left.code.localeCompare(right.code),
  );

  const controlEventIds = [
    ...parsed.revocations.map(({ event }) => event.id),
    ...[...moderation.values()].map(({ event }) => event.id),
  ];
  const acceptedEventIds = [
    ...controlEventIds,
    ...plugins.flatMap((plugin) => [
      plugin.event.id,
      ...plugin.releases.flatMap((release) => [
        release.event.id,
        release.assessmentEvent.id,
        release.approvalEvent.id,
      ]),
    ]),
  ].toSorted();
  const uniqueAcceptedEventIds = [...new Set(acceptedEventIds)];

  const exclusionCounts: MaterializedRegistry["exclusionCounts"] = {};
  for (const exclusion of exclusions) {
    exclusionCounts[exclusion.reason] =
      (exclusionCounts[exclusion.reason] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    root: canonicalHash(rootInput(plugins, uniqueAcceptedEventIds, exclusions)),
    plugins,
    acceptedEventIds: uniqueAcceptedEventIds,
    exclusions,
    exclusionCounts,
    issues,
  };
}

export function createSnapshotContent(
  registry: MaterializedRegistry,
  generatedAt: string,
): SnapshotContent {
  return {
    schema: "lapis.registry.snapshot/1",
    root: registry.root,
    eventIds: registry.acceptedEventIds,
    pluginCount: registry.plugins.length,
    excludedEventCount: registry.exclusions.length,
    generatedAt,
  };
}

export function verifySnapshot(
  event: NostrEvent,
  registry: MaterializedRegistry,
  kinds: RegistryKindMap,
  authorities: RegistryAuthorities,
  verifySignature: (candidate: NostrEvent) => boolean = verifyEvent,
): boolean {
  if (
    event.kind !== kinds.snapshot ||
    !authorities.snapshotSignerPubkeys.has(event.pubkey) ||
    !verifySignature(event)
  ) {
    return false;
  }

  const content = snapshotContentSchema.safeParse(
    parseJsonContent(event.content),
  );
  if (!content.success || !validateSnapshotTags(event, content.data)) {
    return false;
  }

  return (
    content.data.root === registry.root &&
    content.data.pluginCount === registry.plugins.length &&
    content.data.excludedEventCount === registry.exclusions.length &&
    canonicalJson(content.data.eventIds) ===
      canonicalJson(registry.acceptedEventIds)
  );
}
