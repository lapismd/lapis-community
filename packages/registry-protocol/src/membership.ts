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
const registrationIdentifier = "lapis-membership";

export interface MembershipKindMap {
  registration: number;
  decision: number;
}

/** Fixture-only values pending the production kind-allocation ADR. */
export const TEST_MEMBERSHIP_KINDS: MembershipKindMap = Object.freeze({
  registration: 64007,
  decision: 64008,
});

export type MembershipRole = "curator" | "member" | "publisher" | "security";
export type MembershipStatus = "active" | "banned" | "suspended";

export interface MembershipRegistrationContent {
  schema: "lapis.registry.membership-registration/1";
}

export interface MembershipDecisionContent {
  schema: "lapis.registry.membership-decision/1";
  subjectPubkey: string;
  status: MembershipStatus;
  roles: MembershipRole[];
  publisherPluginIds: string[];
  reason: string;
}

export interface MaterializedMembershipState {
  pubkey: string;
  status: MembershipStatus;
  roles: MembershipRole[];
  publisherPluginIds: string[];
  source: "administrative-decision" | "self-registration";
  sourceEvent: NostrEvent;
}

export interface MaterializedMembership {
  schemaVersion: 1;
  root: string;
  states: MaterializedMembershipState[];
  acceptedEventIds: string[];
  issues: RegistryIssue[];
}

export const membershipRegistrationContentSchema: z.ZodType<MembershipRegistrationContent> =
  z
    .object({
      schema: z.literal("lapis.registry.membership-registration/1"),
    })
    .strict();

export const membershipDecisionContentSchema: z.ZodType<MembershipDecisionContent> =
  z
    .object({
      schema: z.literal("lapis.registry.membership-decision/1"),
      subjectPubkey: hex64,
      status: z.enum(["active", "banned", "suspended"]),
      roles: z
        .array(z.enum(["curator", "member", "publisher", "security"]))
        .max(4)
        .refine(unique, "Membership roles must be unique"),
      publisherPluginIds: z
        .array(pluginId)
        .max(1_000)
        .refine(unique, "Publisher plugin scopes must be unique"),
      reason: z.string().min(1).max(2_000),
    })
    .strict()
    .superRefine((content, context) => {
      if (
        content.publisherPluginIds.length > 0 &&
        !content.roles.includes("publisher")
      ) {
        context.addIssue({
          code: "custom",
          path: ["publisherPluginIds"],
          message: "Publisher scopes require the publisher role",
        });
      }
    });

export function createMembershipKindMap(
  kinds: MembershipKindMap,
): MembershipKindMap {
  const values = Object.values(kinds);
  if (
    values.some(
      (kind) => !Number.isInteger(kind) || kind < 0 || kind > 65535,
    ) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      "Membership kinds must be unique integers from 0 through 65535",
    );
  }
  return Object.freeze({ ...kinds });
}

export function createMembershipRegistrationTemplate(
  kinds: MembershipKindMap,
  createdAt: number,
): NostrEventTemplate {
  const content: MembershipRegistrationContent = {
    schema: "lapis.registry.membership-registration/1",
  };
  return {
    kind: kinds.registration,
    created_at: createdAt,
    tags: [["d", registrationIdentifier]],
    content: canonicalJson(content as unknown as JsonObject),
  };
}

export function createMembershipDecisionTemplate(
  content: MembershipDecisionContent,
  kinds: MembershipKindMap,
  createdAt: number,
): NostrEventTemplate {
  const parsed = membershipDecisionContentSchema.parse(content);
  const normalized: MembershipDecisionContent = {
    ...parsed,
    roles: [...parsed.roles].toSorted(),
    publisherPluginIds: [...parsed.publisherPluginIds].toSorted(),
  };
  return {
    kind: kinds.decision,
    created_at: createdAt,
    tags: [["p", normalized.subjectPubkey]],
    content: canonicalJson(normalized as unknown as JsonObject),
  };
}

export function materializeMembership(
  input: readonly NostrEvent[],
  kinds: MembershipKindMap,
  membershipAdminPubkeys: ReadonlySet<string>,
  options: { verifySignature?: (event: NostrEvent) => boolean } = {},
): MaterializedMembership {
  const verifySignature = options.verifySignature ?? verifyEvent;
  const issues: RegistryIssue[] = [];
  const registrations = new Map<string, NostrEvent>();
  const decisions = new Map<
    string,
    { event: NostrEvent; content: MembershipDecisionContent }
  >();

  for (const event of uniqueEvents(input)) {
    if (event.kind !== kinds.registration && event.kind !== kinds.decision) {
      continue;
    }
    if (!verifySignature(event)) {
      issue(issues, event, "signature", "Invalid Nostr event signature");
      continue;
    }

    let content: unknown;
    try {
      content = JSON.parse(event.content) as unknown;
    } catch {
      issue(issues, event, "content", "Invalid membership event JSON");
      continue;
    }

    if (event.kind === kinds.registration) {
      if (!membershipRegistrationContentSchema.safeParse(content).success) {
        issue(issues, event, "content", "Invalid membership registration");
      } else if (!exactTags(event.tags, [["d", registrationIdentifier]])) {
        issue(issues, event, "tags", "Invalid membership registration tags");
      } else {
        const current = registrations.get(event.pubkey);
        registrations.set(
          event.pubkey,
          current === undefined ? event : laterEvent(current, event),
        );
      }
      continue;
    }

    const parsed = membershipDecisionContentSchema.safeParse(content);
    if (!parsed.success) {
      issue(issues, event, "content", "Invalid membership decision");
    } else if (!membershipAdminPubkeys.has(event.pubkey)) {
      issue(
        issues,
        event,
        "authority",
        "Membership decision signer is not trusted",
      );
    } else if (!exactTags(event.tags, [["p", parsed.data.subjectPubkey]])) {
      issue(issues, event, "tags", "Membership decision tags do not match");
    } else {
      const candidate = { event, content: parsed.data };
      const current = decisions.get(parsed.data.subjectPubkey);
      decisions.set(
        parsed.data.subjectPubkey,
        current === undefined || laterEvent(current.event, event) === event
          ? candidate
          : current,
      );
    }
  }

  const pubkeys = new Set([...registrations.keys(), ...decisions.keys()]);
  const states = [...pubkeys]
    .map((pubkey): MaterializedMembershipState => {
      const decision = decisions.get(pubkey);
      if (decision !== undefined) {
        const roles = new Set(decision.content.roles);
        if (decision.content.status === "active") roles.add("member");
        return {
          pubkey,
          status: decision.content.status,
          roles: [...roles].toSorted(),
          publisherPluginIds: [
            ...decision.content.publisherPluginIds,
          ].toSorted(),
          source: "administrative-decision",
          sourceEvent: decision.event,
        };
      }
      const registration = registrations.get(pubkey);
      if (registration === undefined) {
        throw new Error("Membership state has no source event");
      }
      return {
        pubkey,
        status: "active",
        roles: ["member"],
        publisherPluginIds: [],
        source: "self-registration",
        sourceEvent: registration,
      };
    })
    .toSorted((left, right) => left.pubkey.localeCompare(right.pubkey));

  issues.sort(
    (left, right) =>
      left.eventId.localeCompare(right.eventId) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
  const acceptedEventIds = states
    .map((state) => state.sourceEvent.id)
    .toSorted();
  const root = canonicalHash({
    schemaVersion: 1,
    states: states.map((state) => ({
      pubkey: state.pubkey,
      status: state.status,
      roles: state.roles,
      publisherPluginIds: state.publisherPluginIds,
      source: state.source,
      sourceEventId: state.sourceEvent.id,
    })),
  });

  return { schemaVersion: 1, root, states, acceptedEventIds, issues };
}

function laterEvent(left: NostrEvent, right: NostrEvent): NostrEvent {
  if (left.created_at !== right.created_at) {
    return left.created_at > right.created_at ? left : right;
  }
  return left.id.localeCompare(right.id) <= 0 ? left : right;
}

function uniqueEvents(input: readonly NostrEvent[]): NostrEvent[] {
  return [...new Map(input.map((event) => [event.id, event])).values()];
}

function exactTags(actual: string[][], expected: string[][]): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function issue(
  issues: RegistryIssue[],
  event: NostrEvent,
  code: RegistryIssue["code"],
  message: string,
): void {
  issues.push({ eventId: event.id, code, message });
}
