import { z } from "zod";

import {
  getNip29ManifestAttachment,
  isNip29PublisherAuthorized,
  LAPIS_GROUPS,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  nip29ReleaseManifestSchema,
  NIP29_KINDS,
  parseNip29CuratorDecision,
  parseNip29PublisherWithdrawal,
  projectRegistry,
  type Nip29CuratorDecision,
  type Nip29RegistryAuthorities,
  type NostrEvent,
} from "../protocol/index.js";
import {
  registryCatalogDetailSchema,
  registryCatalogIndexSchema,
  type RegistryReleaseDiagnostic,
  type RegistryReleaseInspection,
  type RegistryReleaseInspectionState,
} from "./model.js";

const pluginIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/u;

export interface RegistryReleaseCandidate {
  event: NostrEvent;
  pluginId?: string;
  trusted: boolean;
  manifestSha256?: string;
  diagnostics: RegistryReleaseDiagnostic[];
}

export function recognizeRegistryReleaseCandidate(
  event: NostrEvent,
  authorities: Nip29RegistryAuthorities,
  events: readonly NostrEvent[] = [event],
): RegistryReleaseCandidate | undefined {
  if (event.kind !== NIP29_KINDS.streamMessage) return undefined;
  if (tagValues(event, "h")[0] !== lapisGroupId(LAPIS_GROUPS.pluginReleases))
    return undefined;
  const topics = new Set(tagValues(event, "t"));
  if (!topics.has(LAPIS_RELEASE_TOPIC)) return undefined;

  const diagnostics: RegistryReleaseDiagnostic[] = [];
  const pluginTopics = [...topics]
    .filter((topic) => topic.startsWith("plugin:"))
    .map((topic) => topic.slice("plugin:".length));
  const pluginId =
    pluginTopics.length === 1 && pluginIdPattern.test(pluginTopics[0]!)
      ? pluginTopics[0]
      : undefined;
  if (pluginId === undefined) {
    diagnostics.push({
      stage: "event",
      code: "plugin-topic",
      path: "event.tags",
      message: "Release must name exactly one valid plugin topic.",
    });
  }

  const trusted =
    pluginId !== undefined &&
    isNip29PublisherAuthorized(events, authorities, pluginId, event.pubkey);
  if (pluginId !== undefined && !trusted) {
    diagnostics.push({
      stage: "authority",
      code: "untrusted-publisher",
      path: "event.pubkey",
      message: "Release signer is not a configured publisher.",
    });
  }

  const attachment = getNip29ManifestAttachment(event);
  if (attachment === undefined) {
    diagnostics.push({
      stage: "attachment",
      code: "manifest-attachment",
      path: "event.tags",
      message: "Release must include one valid manifest attachment.",
    });
  }

  return {
    event,
    ...(pluginId === undefined ? {} : { pluginId }),
    trusted,
    ...(attachment === undefined ? {} : { manifestSha256: attachment.sha256 }),
    diagnostics,
  };
}

export function inspectRegistryReleaseCandidate(
  candidate: RegistryReleaseCandidate,
  events: readonly NostrEvent[],
  manifest: unknown,
  generatedAt: string,
  authorities: Nip29RegistryAuthorities,
): RegistryReleaseInspection {
  const { event, pluginId, manifestSha256 } = candidate;
  if (!candidate.trusted) {
    return inspection(candidate, "untrusted");
  }
  if (pluginId === undefined || manifestSha256 === undefined) {
    return inspection(candidate, "invalid");
  }

  const parsed = nip29ReleaseManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return inspection(candidate, "invalid", [
      ...candidate.diagnostics,
      ...zodDiagnostics(parsed.error, "schema"),
    ]);
  }
  if (
    parsed.data.plugin.pluginId !== pluginId ||
    parsed.data.release.pluginId !== pluginId
  ) {
    return inspection(candidate, "invalid", [
      ...candidate.diagnostics,
      {
        stage: "manifest",
        code: "plugin-id-mismatch",
        path: "release.pluginId",
        message: "Manifest plugin ID does not match the release topic.",
      },
    ]);
  }
  if (parsed.data.release.artifact.sha256 === manifestSha256) {
    return inspection(candidate, "invalid", [
      ...candidate.diagnostics,
      {
        stage: "manifest",
        code: "bundle-manifest-hash",
        path: "release.artifact.sha256",
        message: "Bundle hash must be distinct from the manifest hash.",
      },
    ]);
  }

  const projection = projectRegistry(
    [
      {
        content: parsed.data.plugin,
        releases: [parsed.data.release],
        latestVersion: parsed.data.release.version,
      },
    ],
    { generatedAt },
    {
      backend: "nostr",
      root: manifestSha256,
      acceptedEventIds: [event.id],
      exclusionCounts: {},
    },
  );
  const index = registryCatalogIndexSchema.safeParse(projection.index);
  const detailValue = projection.plugins.get(pluginId);
  const detail = registryCatalogDetailSchema.safeParse(detailValue);
  if (
    !index.success ||
    !detail.success ||
    index.data.plugins[0] === undefined
  ) {
    const diagnostics = [
      ...candidate.diagnostics,
      ...(index.success ? [] : zodDiagnostics(index.error, "projection")),
      ...(detail.success ? [] : zodDiagnostics(detail.error, "projection")),
    ];
    return inspection(candidate, "invalid", diagnostics);
  }

  const state = releaseState(events, event, authorities);
  return {
    eventId: event.id,
    pluginId,
    version: parsed.data.release.version,
    manifestSha256,
    state,
    preview: { entry: index.data.plugins[0], detail: detail.data },
    diagnostics: candidate.diagnostics,
  };
}

export function failedRegistryReleaseInspection(
  candidate: RegistryReleaseCandidate,
  state: "invalid" | "unavailable",
  diagnostic: RegistryReleaseDiagnostic,
): RegistryReleaseInspection {
  return inspection(candidate, state, [...candidate.diagnostics, diagnostic]);
}

function inspection(
  candidate: RegistryReleaseCandidate,
  state: RegistryReleaseInspectionState,
  diagnostics = candidate.diagnostics,
): RegistryReleaseInspection {
  return {
    eventId: candidate.event.id,
    state,
    ...(candidate.pluginId === undefined
      ? {}
      : { pluginId: candidate.pluginId }),
    ...(candidate.manifestSha256 === undefined
      ? {}
      : { manifestSha256: candidate.manifestSha256 }),
    diagnostics,
  };
}

function latestDecision(
  events: readonly NostrEvent[],
  eventId: string,
  authorities: Nip29RegistryAuthorities,
): Nip29CuratorDecision | undefined {
  return events
    .flatMap((event) => {
      const parsed = parseNip29CuratorDecision(event, eventId);
      return parsed === undefined ||
        !authorities.curatorPubkeys.has(event.pubkey)
        ? []
        : [{ event, decision: parsed.decision }];
    })
    .toSorted((left, right) =>
      left.event.created_at === right.event.created_at
        ? left.event.id.localeCompare(right.event.id)
        : right.event.created_at - left.event.created_at,
    )[0]?.decision;
}

function releaseState(
  events: readonly NostrEvent[],
  release: NostrEvent,
  authorities: Nip29RegistryAuthorities,
): RegistryReleaseInspectionState {
  const withdrawn = events.some((event) => {
    const parsed = parseNip29PublisherWithdrawal(event, release.id);
    return parsed !== undefined && event.pubkey === release.pubkey;
  });
  return withdrawn
    ? "withdrawn"
    : (latestDecision(events, release.id, authorities) ?? "pending");
}

function zodDiagnostics(
  error: z.ZodError,
  stage: "schema" | "projection",
): RegistryReleaseDiagnostic[] {
  return mostSpecificZodIssues(error.issues).map((issue) => ({
    stage,
    code: issue.code,
    path:
      issue.path.length === 0
        ? stage === "schema"
          ? "manifest"
          : "preview"
        : issue.path.map(String).join("."),
    message: issue.message,
  }));
}

type ZodIssue = z.ZodError["issues"][number];

function mostSpecificZodIssues(issues: readonly ZodIssue[]): ZodIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code !== "invalid_union") return [issue];

    const branches = issue.errors.map((branch) =>
      mostSpecificZodIssues(branch),
    );
    return (
      branches.toSorted((left, right) => {
        const discriminatorDifference =
          discriminatorIssueCount(left) - discriminatorIssueCount(right);
        if (discriminatorDifference !== 0) return discriminatorDifference;
        if (left.length !== right.length) return left.length - right.length;
        return issueSpecificity(right) - issueSpecificity(left);
      })[0] ?? [issue]
    );
  });
}

function discriminatorIssueCount(issues: readonly ZodIssue[]): number {
  return issues.filter(
    (issue) => issue.code === "invalid_value" && issue.path.at(-1) === "schema",
  ).length;
}

function issueSpecificity(issues: readonly ZodIssue[]): number {
  return issues.reduce((total, issue) => total + issue.path.length, 0);
}

function tagValues(event: NostrEvent, name: string): string[] {
  return event.tags.flatMap((tag) =>
    tag[0] === name && tag[1] !== undefined ? [tag[1]] : [],
  );
}
