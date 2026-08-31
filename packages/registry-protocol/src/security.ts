import { verifyEvent } from "nostr-tools/pure";
import { z } from "zod";

import { canonicalHash, canonicalJson } from "./canonical.js";
import type {
  JsonObject,
  NostrEvent,
  NostrEventTemplate,
  RegistryIssue,
} from "./types.js";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);
const pluginId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u);

export interface SecurityKindMap {
  advisory: number;
  disposition: number;
}

export const TEST_SECURITY_KINDS: SecurityKindMap = Object.freeze({
  advisory: 64004,
  disposition: 64005,
});

export interface SecurityAdvisoryContent {
  schema: "lapis.registry.security-advisory/1";
  advisoryId: string;
  pluginId: string;
  releaseEventId: string;
  artifactSha256: string;
  severity: "critical" | "high" | "low" | "medium";
  summary: string;
  detailsUrl?: string | undefined;
}

export interface SecurityDispositionContent {
  schema: "lapis.registry.security-disposition/1";
  advisoryEventId: string;
  pluginId: string;
  releaseEventId: string;
  artifactSha256: string;
  action: "block" | "resolved" | "warn";
  reason: string;
}

export interface SecurityAuthorities {
  advisoryPubkeys: ReadonlySet<string>;
  dispositionPubkeys: ReadonlySet<string>;
}

export interface MaterializedSecurityStatus {
  advisoryEvent: NostrEvent;
  advisory: SecurityAdvisoryContent;
  dispositionEvent?: NostrEvent;
  disposition?: SecurityDispositionContent;
  enforcement: "block" | "none" | "warn";
}

export interface MaterializedSecurity {
  schemaVersion: 1;
  root: string;
  statuses: MaterializedSecurityStatus[];
  acceptedEventIds: string[];
  issues: RegistryIssue[];
}

export const securityAdvisoryContentSchema: z.ZodType<SecurityAdvisoryContent> =
  z
    .object({
      schema: z.literal("lapis.registry.security-advisory/1"),
      advisoryId: z.string().min(1).max(160),
      pluginId,
      releaseEventId: hex64,
      artifactSha256: hex64,
      severity: z.enum(["critical", "high", "low", "medium"]),
      summary: z.string().min(1).max(2_000),
      detailsUrl: z.string().url().optional(),
    })
    .strict();

export const securityDispositionContentSchema: z.ZodType<SecurityDispositionContent> =
  z
    .object({
      schema: z.literal("lapis.registry.security-disposition/1"),
      advisoryEventId: hex64,
      pluginId,
      releaseEventId: hex64,
      artifactSha256: hex64,
      action: z.enum(["block", "resolved", "warn"]),
      reason: z.string().min(1).max(2_000),
    })
    .strict();

export function createSecurityKindMap(kinds: SecurityKindMap): SecurityKindMap {
  const values = Object.values(kinds);
  if (
    values.some(
      (kind) => !Number.isInteger(kind) || kind < 0 || kind > 65535,
    ) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      "Security kinds must be unique integers from 0 through 65535",
    );
  }
  return Object.freeze({ ...kinds });
}

export function createSecurityAdvisoryTemplate(
  content: SecurityAdvisoryContent,
  kinds: SecurityKindMap,
  createdAt: number,
): NostrEventTemplate {
  return securityTemplate(
    kinds.advisory,
    createdAt,
    [
      ["d", content.advisoryId],
      ["e", content.releaseEventId, "", "release"],
      ["x", content.artifactSha256],
    ],
    content,
  );
}

export function createSecurityDispositionTemplate(
  content: SecurityDispositionContent,
  kinds: SecurityKindMap,
  createdAt: number,
): NostrEventTemplate {
  return securityTemplate(
    kinds.disposition,
    createdAt,
    [
      ["e", content.advisoryEventId, "", "advisory"],
      ["e", content.releaseEventId, "", "release"],
      ["x", content.artifactSha256],
    ],
    content,
  );
}

export function materializeSecurity(
  input: readonly NostrEvent[],
  kinds: SecurityKindMap,
  authorities: SecurityAuthorities,
  options: {
    trustedArtifactByRelease?: ReadonlyMap<string, string>;
    verifySignature?: (event: NostrEvent) => boolean;
  } = {},
): MaterializedSecurity {
  const verifySignature = options.verifySignature ?? verifyEvent;
  const issues: RegistryIssue[] = [];
  const advisories = new Map<
    string,
    { event: NostrEvent; content: SecurityAdvisoryContent }
  >();
  const dispositions: Array<{
    event: NostrEvent;
    content: SecurityDispositionContent;
  }> = [];

  for (const event of uniqueEvents(input)) {
    if (event.kind !== kinds.advisory && event.kind !== kinds.disposition) {
      continue;
    }
    if (!verifySignature(event)) {
      securityIssue(
        issues,
        event,
        "signature",
        "Invalid Nostr event signature",
      );
      continue;
    }
    let content: unknown;
    try {
      content = JSON.parse(event.content) as unknown;
    } catch {
      securityIssue(issues, event, "content", "Invalid security event JSON");
      continue;
    }

    if (event.kind === kinds.advisory) {
      const parsed = securityAdvisoryContentSchema.safeParse(content);
      if (!parsed.success) {
        securityIssue(issues, event, "content", "Invalid security advisory");
      } else if (!validateAdvisoryTags(event, parsed.data)) {
        securityIssue(
          issues,
          event,
          "tags",
          "Security advisory tags do not match content",
        );
      } else if (!authorities.advisoryPubkeys.has(event.pubkey)) {
        securityIssue(
          issues,
          event,
          "authority",
          "Security advisory signer is not trusted",
        );
      } else if (
        options.trustedArtifactByRelease !== undefined &&
        options.trustedArtifactByRelease.get(parsed.data.releaseEventId) !==
          parsed.data.artifactSha256
      ) {
        securityIssue(
          issues,
          event,
          "reference",
          "Security advisory does not match an approved release artifact",
        );
      } else {
        advisories.set(event.id, { event, content: parsed.data });
      }
      continue;
    }

    const parsed = securityDispositionContentSchema.safeParse(content);
    if (!parsed.success) {
      securityIssue(issues, event, "content", "Invalid security disposition");
    } else if (!validateDispositionTags(event, parsed.data)) {
      securityIssue(
        issues,
        event,
        "tags",
        "Security disposition tags do not match content",
      );
    } else if (!authorities.dispositionPubkeys.has(event.pubkey)) {
      securityIssue(
        issues,
        event,
        "authority",
        "Security disposition signer is not trusted",
      );
    } else {
      dispositions.push({ event, content: parsed.data });
    }
  }

  const dispositionWinners = new Map<
    string,
    { event: NostrEvent; content: SecurityDispositionContent }
  >();
  for (const disposition of dispositions) {
    const advisory = advisories.get(disposition.content.advisoryEventId);
    if (
      advisory === undefined ||
      advisory.content.pluginId !== disposition.content.pluginId ||
      advisory.content.releaseEventId !== disposition.content.releaseEventId ||
      advisory.content.artifactSha256 !== disposition.content.artifactSha256
    ) {
      securityIssue(
        issues,
        disposition.event,
        "reference",
        "Security disposition does not exactly match its advisory",
      );
      continue;
    }
    const current = dispositionWinners.get(advisory.event.id);
    dispositionWinners.set(
      advisory.event.id,
      current === undefined ? disposition : later(current, disposition),
    );
  }

  const statuses = [...advisories.values()]
    .map(({ event, content }): MaterializedSecurityStatus => {
      const disposition = dispositionWinners.get(event.id);
      return {
        advisoryEvent: event,
        advisory: content,
        ...(disposition === undefined
          ? {}
          : {
              dispositionEvent: disposition.event,
              disposition: disposition.content,
            }),
        enforcement:
          disposition === undefined || disposition.content.action === "resolved"
            ? "none"
            : disposition.content.action,
      };
    })
    .toSorted(
      (left, right) =>
        left.advisory.pluginId.localeCompare(right.advisory.pluginId) ||
        left.advisory.releaseEventId.localeCompare(
          right.advisory.releaseEventId,
        ) ||
        left.advisoryEvent.id.localeCompare(right.advisoryEvent.id),
    );
  const acceptedEventIds = [
    ...advisories.keys(),
    ...[...dispositionWinners.values()].map((value) => value.event.id),
  ].toSorted();
  issues.sort(
    (left, right) =>
      left.eventId.localeCompare(right.eventId) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
  const root = canonicalHash({
    schemaVersion: 1,
    statuses: statuses.map((status) => ({
      advisoryEventId: status.advisoryEvent.id,
      dispositionEventId: status.dispositionEvent?.id ?? null,
      pluginId: status.advisory.pluginId,
      releaseEventId: status.advisory.releaseEventId,
      artifactSha256: status.advisory.artifactSha256,
      enforcement: status.enforcement,
    })),
  });

  return {
    schemaVersion: 1,
    root,
    statuses,
    acceptedEventIds,
    issues,
  };
}

function securityTemplate(
  kind: number,
  createdAt: number,
  tags: string[][],
  content: SecurityAdvisoryContent | SecurityDispositionContent,
): NostrEventTemplate {
  return {
    kind,
    created_at: createdAt,
    tags,
    content: canonicalJson(content as unknown as JsonObject),
  };
}

function validateAdvisoryTags(
  event: NostrEvent,
  content: SecurityAdvisoryContent,
): boolean {
  return (
    hasTag(event, "d", content.advisoryId) &&
    hasTag(event, "e", content.releaseEventId, "release") &&
    hasTag(event, "x", content.artifactSha256)
  );
}

function validateDispositionTags(
  event: NostrEvent,
  content: SecurityDispositionContent,
): boolean {
  return (
    hasTag(event, "e", content.advisoryEventId, "advisory") &&
    hasTag(event, "e", content.releaseEventId, "release") &&
    hasTag(event, "x", content.artifactSha256)
  );
}

function hasTag(
  event: NostrEvent,
  name: string,
  value: string,
  marker?: string,
): boolean {
  return event.tags.some(
    (tag) =>
      tag[0] === name &&
      tag[1] === value &&
      (marker === undefined || tag[3] === marker),
  );
}

function uniqueEvents(input: readonly NostrEvent[]): NostrEvent[] {
  const events = new Map<string, NostrEvent>();
  for (const event of input) {
    if (!events.has(event.id)) events.set(event.id, event);
  }
  return [...events.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function later<T extends { event: NostrEvent }>(left: T, right: T): T {
  return left.event.created_at > right.event.created_at ||
    (left.event.created_at === right.event.created_at &&
      left.event.id < right.event.id)
    ? left
    : right;
}

function securityIssue(
  issues: RegistryIssue[],
  event: NostrEvent,
  code: RegistryIssue["code"],
  message: string,
): void {
  issues.push({ eventId: event.id, code, message });
}
