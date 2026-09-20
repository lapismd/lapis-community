import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { communityMentionAutocompleteItems } from "./agent-mention-candidates.js";
import {
  communityRoomAutocompleteItems,
  type CommunityComposerAutocompleteItem,
  type CommunityComposerAutocompleteQuery,
} from "./autocomplete.js";
import type { CommunityComposerAgentModel } from "./composer-agent-model.js";

export type ComposerAutocompletePlan =
  | { kind: "skip" }
  | {
      kind: "items";
      query: CommunityComposerAutocompleteQuery | undefined;
      items: CommunityComposerAutocompleteItem[];
    }
  | { kind: "emoji"; query: CommunityComposerAutocompleteQuery };

export function planComposerAutocompleteUpdate(input: {
  currentQuery: CommunityComposerAutocompleteQuery | undefined;
  nextQuery: CommunityComposerAutocompleteQuery | null;
  currentItems: readonly CommunityComposerAutocompleteItem[];
  members: readonly CommunityMemberModel[];
  agents: readonly CommunityComposerAgentModel[];
  rooms: readonly CommunityRoomModel[];
  currentMemberId: string | undefined;
  channelId: string | undefined;
}): ComposerAutocompletePlan {
  const nextItems = resolveComposerAutocompleteItems(input);
  if (
    shouldSkipComposerAutocompleteUpdate(
      input.currentQuery,
      input.nextQuery,
      input.currentItems,
      nextItems,
    )
  ) {
    return { kind: "skip" };
  }
  if (nextItems !== undefined) {
    return {
      kind: "items",
      query: input.nextQuery ?? undefined,
      items: nextItems,
    };
  }
  if (input.nextQuery == null) {
    return { kind: "items", query: undefined, items: [] };
  }
  return { kind: "emoji", query: input.nextQuery };
}

function resolveComposerAutocompleteItems(input: {
  nextQuery: CommunityComposerAutocompleteQuery | null;
  members: readonly CommunityMemberModel[];
  agents: readonly CommunityComposerAgentModel[];
  rooms: readonly CommunityRoomModel[];
  currentMemberId: string | undefined;
  channelId: string | undefined;
}): CommunityComposerAutocompleteItem[] | undefined {
  const query = input.nextQuery;
  if (query == null) return [];
  if (query.kind === "member") {
    return communityMentionAutocompleteItems(
      input.members,
      input.agents,
      query.query,
      input.currentMemberId,
      input.channelId,
    );
  }
  if (query.kind === "room") {
    return communityRoomAutocompleteItems(input.rooms, query.query);
  }
  return undefined;
}

export function composerAutocompleteQueryEquals(
  current: CommunityComposerAutocompleteQuery | undefined,
  next: CommunityComposerAutocompleteQuery | null,
): boolean {
  if (next == null) return current === undefined;
  return (
    current !== undefined &&
    current.kind === next.kind &&
    current.query === next.query &&
    current.from === next.from &&
    current.to === next.to
  );
}

export function composerAutocompleteItemsEqual(
  current: readonly CommunityComposerAutocompleteItem[],
  next: readonly CommunityComposerAutocompleteItem[],
): boolean {
  if (current.length !== next.length) return false;
  return current.every((item, index) => {
    const candidate = next[index];
    return (
      candidate !== undefined &&
      item.id === candidate.id &&
      item.label === candidate.label &&
      item.detail === candidate.detail
    );
  });
}

export function shouldSkipComposerAutocompleteUpdate(
  currentQuery: CommunityComposerAutocompleteQuery | undefined,
  nextQuery: CommunityComposerAutocompleteQuery | null,
  currentItems: readonly CommunityComposerAutocompleteItem[],
  nextItems: readonly CommunityComposerAutocompleteItem[] | undefined,
): boolean {
  if (!composerAutocompleteQueryEquals(currentQuery, nextQuery)) return false;
  if (nextQuery?.kind === "emoji") return true;
  return (
    nextItems !== undefined &&
    composerAutocompleteItemsEqual(currentItems, nextItems)
  );
}

export function composerActiveActionsEqual(
  current: ReadonlySet<string>,
  next: ReadonlySet<string>,
): boolean {
  if (current.size !== next.size) return false;
  for (const action of next) {
    if (!current.has(action)) return false;
  }
  return true;
}
