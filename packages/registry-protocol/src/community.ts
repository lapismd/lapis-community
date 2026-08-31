import { verifyEvent } from "nostr-tools/pure";
import { z } from "zod";

import { canonicalHash, canonicalJson } from "./canonical.js";
import type {
  JsonObject,
  NostrEvent,
  NostrEventTemplate,
  RegistryIssue,
} from "./types.js";

const hex64Pattern = /^[0-9a-f]{64}$/u;
const pluginIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const reportTypes = new Set([
  "illegal",
  "impersonation",
  "malware",
  "nudity",
  "other",
  "profanity",
  "spam",
]);

export interface CommunityKindMap {
  rating: number;
  comment: number;
  report: number;
  followList: number;
  appCurationSet: number;
  softwareApplication: number;
}

export const TEST_COMMUNITY_KINDS: CommunityKindMap = Object.freeze({
  rating: 64006,
  comment: 1111,
  report: 1984,
  followList: 3,
  appCurationSet: 30267,
  softwareApplication: 32267,
});

export interface RatingContent {
  schema: "lapis.registry.rating/1";
  pluginId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  status: "active" | "withdrawn";
  version?: string | undefined;
}

export interface PluginCommentTarget {
  pluginAddress: string;
  pluginKind: number;
  publisherPubkey: string;
}

export interface MaterializedRating {
  event: NostrEvent;
  content: RatingContent;
}

export interface RatingAggregate {
  pluginId: string;
  count: number;
  sum: number;
  average: number | null;
}

export interface MaterializedReview {
  event: NostrEvent;
  pluginId: string;
  pluginAddress: string;
  parentEventId?: string | undefined;
  content: string;
}

export interface MaterializedReport {
  event: NostrEvent;
  reportTypes: string[];
}

export interface MaterializedCollection {
  event: NostrEvent;
  identifier: string;
  title?: string | undefined;
  description?: string | undefined;
  pluginIds: string[];
}

export interface MaterializedFollowList {
  event: NostrEvent;
  pubkeys: string[];
}

export interface CommunityModerationPolicy {
  hiddenEventIds: ReadonlySet<string>;
  mutedPubkeys: ReadonlySet<string>;
}

export interface MaterializedCommunity {
  schemaVersion: 1;
  root: string;
  ratings: MaterializedRating[];
  ratingAggregates: RatingAggregate[];
  reviews: MaterializedReview[];
  reports: MaterializedReport[];
  collections: MaterializedCollection[];
  followLists: MaterializedFollowList[];
  exclusionCounts: {
    hiddenEvent: number;
    mutedPubkey: number;
  };
  issues: RegistryIssue[];
}

const ratingContentSchema: z.ZodType<RatingContent> = z
  .object({
    schema: z.literal("lapis.registry.rating/1"),
    pluginId: z.string().regex(pluginIdPattern),
    rating: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    status: z.enum(["active", "withdrawn"]),
    version: z.string().min(1).max(128).optional(),
  })
  .strict();

export function createCommunityKindMap(
  kinds: CommunityKindMap,
): CommunityKindMap {
  const values = Object.values(kinds);
  if (
    values.some(
      (kind) => !Number.isInteger(kind) || kind < 0 || kind > 65535,
    ) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      "Community kinds must be unique integers from 0 through 65535",
    );
  }
  return Object.freeze({ ...kinds });
}

export function createRatingTemplate(
  content: RatingContent,
  pluginAddress: string,
  kinds: CommunityKindMap,
  createdAt: number,
): NostrEventTemplate {
  return {
    kind: kinds.rating,
    created_at: createdAt,
    tags: [
      ["d", content.pluginId],
      ["a", pluginAddress],
    ],
    content: canonicalJson(content as unknown as JsonObject),
  };
}

export function createPluginCommentTemplate(
  content: string,
  target: PluginCommentTarget,
  kinds: CommunityKindMap,
  createdAt: number,
): NostrEventTemplate {
  const normalized = content.trim();
  if (normalized.length === 0 || normalized.length > 10_000) {
    throw new Error("Plugin comments must contain 1 through 10000 characters");
  }
  if (
    !/^\d+:[0-9a-f]{64}:[a-z0-9][a-z0-9-]{0,127}$/u.test(
      target.pluginAddress,
    ) ||
    !Number.isInteger(target.pluginKind) ||
    target.pluginKind < 0 ||
    target.pluginKind > 65_535 ||
    !hex64Pattern.test(target.publisherPubkey)
  ) {
    throw new Error("Plugin comment target is invalid");
  }
  return {
    kind: kinds.comment,
    created_at: createdAt,
    tags: [
      ["A", target.pluginAddress],
      ["K", String(target.pluginKind)],
      ["P", target.publisherPubkey],
      ["a", target.pluginAddress],
      ["k", String(target.pluginKind)],
      ["p", target.publisherPubkey],
    ],
    content: normalized,
  };
}

export function materializeCommunity(
  input: readonly NostrEvent[],
  kinds: CommunityKindMap,
  pluginAddresses: ReadonlyMap<string, string>,
  moderation: CommunityModerationPolicy = {
    hiddenEventIds: new Set(),
    mutedPubkeys: new Set(),
  },
  options: { verifySignature?: (event: NostrEvent) => boolean } = {},
): MaterializedCommunity {
  const verifySignature = options.verifySignature ?? verifyEvent;
  const issues: RegistryIssue[] = [];
  const ratings = new Map<string, MaterializedRating>();
  const reviews: MaterializedReview[] = [];
  const reports: MaterializedReport[] = [];
  const collections = new Map<string, MaterializedCollection>();
  const followLists = new Map<string, MaterializedFollowList>();
  const exclusionCounts = { hiddenEvent: 0, mutedPubkey: 0 };

  for (const event of uniqueEvents(input)) {
    if (!Object.values(kinds).includes(event.kind)) continue;
    if (!verifySignature(event)) {
      communityIssue(
        issues,
        event,
        "signature",
        "Invalid Nostr event signature",
      );
      continue;
    }
    if (moderation.hiddenEventIds.has(event.id)) {
      exclusionCounts.hiddenEvent += 1;
      continue;
    }
    if (moderation.mutedPubkeys.has(event.pubkey)) {
      exclusionCounts.mutedPubkey += 1;
      continue;
    }

    if (event.kind === kinds.rating) {
      const content = parseRating(event, pluginAddresses, issues);
      if (content !== undefined) {
        const key = `${event.pubkey}:${content.pluginId}`;
        const current = ratings.get(key);
        ratings.set(
          key,
          current === undefined
            ? { event, content }
            : later(current, { event, content }),
        );
      }
      continue;
    }
    if (event.kind === kinds.comment) {
      const review = parseReview(event, pluginAddresses, kinds, issues);
      if (review !== undefined) reviews.push(review);
      continue;
    }
    if (event.kind === kinds.report) {
      const report = parseReport(event, issues);
      if (report !== undefined) reports.push(report);
      continue;
    }
    if (event.kind === kinds.appCurationSet) {
      const collection = parseCollection(event, pluginAddresses, kinds, issues);
      if (collection !== undefined) {
        const key = `${event.pubkey}:${collection.identifier}`;
        const current = collections.get(key);
        collections.set(
          key,
          current === undefined ? collection : later(current, collection),
        );
      }
      continue;
    }
    if (event.kind === kinds.followList) {
      const followList: MaterializedFollowList = {
        event,
        pubkeys: event.tags
          .filter((tag) => tag[0] === "p" && hex64Pattern.test(tag[1] ?? ""))
          .map((tag) => tag[1]!)
          .filter((value, index, values) => values.indexOf(value) === index)
          .sort(),
      };
      const current = followLists.get(event.pubkey);
      followLists.set(
        event.pubkey,
        current === undefined ? followList : later(current, followList),
      );
    }
  }

  const activeRatings = [...ratings.values()]
    .filter((rating) => rating.content.status === "active")
    .toSorted(compareEventValues);
  const aggregates = aggregateRatings(activeRatings);
  reviews.sort(compareEventValues);
  reports.sort(compareEventValues);
  const materializedCollections = [...collections.values()].toSorted(
    compareEventValues,
  );
  const materializedFollowLists = [...followLists.values()].toSorted(
    compareEventValues,
  );
  issues.sort(
    (left, right) =>
      left.eventId.localeCompare(right.eventId) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
  const root = canonicalHash({
    schemaVersion: 1,
    ratings: activeRatings.map((rating) => rating.event.id),
    reviews: reviews.map((review) => review.event.id),
    reports: reports.map((report) => report.event.id),
    collections: materializedCollections.map(
      (collection) => collection.event.id,
    ),
    followLists: materializedFollowLists.map(
      (followList) => followList.event.id,
    ),
    exclusionCounts,
  });

  return {
    schemaVersion: 1,
    root,
    ratings: activeRatings,
    ratingAggregates: aggregates,
    reviews,
    reports,
    collections: materializedCollections,
    followLists: materializedFollowLists,
    exclusionCounts,
    issues,
  };
}

function parseRating(
  event: NostrEvent,
  pluginAddresses: ReadonlyMap<string, string>,
  issues: RegistryIssue[],
): RatingContent | undefined {
  const parsed = ratingContentSchema.safeParse(parseJson(event.content));
  if (!parsed.success) {
    communityIssue(issues, event, "content", "Invalid rating content");
    return undefined;
  }
  const address = pluginAddresses.get(parsed.data.pluginId);
  if (
    address === undefined ||
    !hasTag(event, "d", parsed.data.pluginId) ||
    !hasTag(event, "a", address)
  ) {
    communityIssue(
      issues,
      event,
      "reference",
      "Rating does not reference a known plugin address",
    );
    return undefined;
  }
  return parsed.data;
}

function parseReview(
  event: NostrEvent,
  pluginAddresses: ReadonlyMap<string, string>,
  kinds: CommunityKindMap,
  issues: RegistryIssue[],
): MaterializedReview | undefined {
  if (event.content.length === 0 || event.content.length > 10_000) {
    communityIssue(
      issues,
      event,
      "content",
      "Review text is empty or too large",
    );
    return undefined;
  }
  const rootAddress = tagValue(event, "A");
  const rootKind = tagValue(event, "K");
  const rootAuthor = tagValue(event, "P");
  const parentKind = tagValue(event, "k");
  const plugin = [...pluginAddresses.entries()].find(
    ([, address]) => address === rootAddress,
  );
  const publisher =
    rootAddress === undefined
      ? undefined
      : addressPublisher(rootAddress, kinds.softwareApplication);
  if (
    plugin === undefined ||
    publisher === undefined ||
    rootKind !== String(kinds.softwareApplication) ||
    rootAuthor !== publisher ||
    (parentKind !== String(kinds.softwareApplication) &&
      parentKind !== String(kinds.comment))
  ) {
    communityIssue(
      issues,
      event,
      "reference",
      "Review does not use a valid NIP-22 plugin root and parent",
    );
    return undefined;
  }
  const parentAddress = tagValue(event, "a");
  const parentEventId = tagValue(event, "e");
  const parentAuthors = event.tags
    .filter((tag) => tag[0] === "p" && hex64Pattern.test(tag[1] ?? ""))
    .map((tag) => tag[1]!);
  if (
    (parentKind === String(kinds.softwareApplication) &&
      (parentAddress !== rootAddress || !parentAuthors.includes(publisher))) ||
    (parentKind === String(kinds.comment) &&
      (!hex64Pattern.test(parentEventId ?? "") || parentAuthors.length === 0))
  ) {
    communityIssue(
      issues,
      event,
      "reference",
      "Review parent does not match its NIP-22 root",
    );
    return undefined;
  }
  return {
    event,
    pluginId: plugin[0],
    pluginAddress: plugin[1],
    ...(parentKind === String(kinds.comment)
      ? { parentEventId: parentEventId! }
      : {}),
    content: event.content,
  };
}

function parseReport(
  event: NostrEvent,
  issues: RegistryIssue[],
): MaterializedReport | undefined {
  const hasPubkey = event.tags.some(
    (tag) => tag[0] === "p" && hex64Pattern.test(tag[1] ?? ""),
  );
  const types = event.tags
    .filter(
      (tag) =>
        ["e", "p", "x"].includes(tag[0] ?? "") && reportTypes.has(tag[2] ?? ""),
    )
    .map((tag) => tag[2]!)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  if (!hasPubkey || types.length === 0) {
    communityIssue(issues, event, "tags", "Invalid NIP-56 report tags");
    return undefined;
  }
  return { event, reportTypes: types };
}

function parseCollection(
  event: NostrEvent,
  pluginAddresses: ReadonlyMap<string, string>,
  kinds: CommunityKindMap,
  issues: RegistryIssue[],
): MaterializedCollection | undefined {
  const identifier = tagValue(event, "d");
  if (identifier === undefined || identifier.length === 0) {
    communityIssue(issues, event, "tags", "App collection requires a d tag");
    return undefined;
  }
  const byAddress = new Map(
    [...pluginAddresses.entries()].map(([id, address]) => [address, id]),
  );
  const pluginIds = event.tags
    .filter((tag) => tag[0] === "a")
    .map((tag) => tag[1] ?? "")
    .filter((address) => address.startsWith(`${kinds.softwareApplication}:`))
    .map((address) => byAddress.get(address))
    .filter((id): id is string => id !== undefined)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
  return {
    event,
    identifier,
    ...(tagValue(event, "title") === undefined
      ? {}
      : { title: tagValue(event, "title") }),
    ...(tagValue(event, "description") === undefined
      ? {}
      : { description: tagValue(event, "description") }),
    pluginIds,
  };
}

function aggregateRatings(
  ratings: readonly MaterializedRating[],
): RatingAggregate[] {
  const values = new Map<string, { count: number; sum: number }>();
  for (const rating of ratings) {
    const value = values.get(rating.content.pluginId) ?? { count: 0, sum: 0 };
    value.count += 1;
    value.sum += rating.content.rating;
    values.set(rating.content.pluginId, value);
  }
  return [...values.entries()]
    .map(([pluginId, value]) => ({
      pluginId,
      count: value.count,
      sum: value.sum,
      average: value.count === 0 ? null : value.sum / value.count,
    }))
    .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function hasTag(event: NostrEvent, name: string, value: string): boolean {
  return event.tags.some((tag) => tag[0] === name && tag[1] === value);
}

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

function addressPublisher(address: string, kind: number): string | undefined {
  const prefix = `${kind}:`;
  if (!address.startsWith(prefix)) return undefined;
  const separator = address.indexOf(":", prefix.length);
  if (separator === -1 || separator === address.length - 1) return undefined;
  const pubkey = address.slice(prefix.length, separator);
  return hex64Pattern.test(pubkey) ? pubkey : undefined;
}

function uniqueEvents(input: readonly NostrEvent[]): NostrEvent[] {
  const events = new Map<string, NostrEvent>();
  for (const event of input)
    if (!events.has(event.id)) events.set(event.id, event);
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

function compareEventValues<T extends { event: NostrEvent }>(
  left: T,
  right: T,
) {
  return left.event.id.localeCompare(right.event.id);
}

function communityIssue(
  issues: RegistryIssue[],
  event: NostrEvent,
  code: RegistryIssue["code"],
  message: string,
): void {
  issues.push({ eventId: event.id, code, message });
}
