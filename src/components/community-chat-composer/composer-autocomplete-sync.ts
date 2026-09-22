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
import { shouldSkipComposerAutocompleteUpdate } from "./composer-autocomplete-compare.js";
import type { CommunityComposerAgentModel } from "./composer-agent-model.js";
import {
  composerSlashAutocompleteItems,
  type ComposerSlashCatalog,
} from "./composer-slash-catalog.js";
import { emptyComposerSlashSession } from "./composer-slash-session.js";

export {
  composerActiveActionsEqual,
  composerAutocompleteItemsEqual,
  composerAutocompleteQueryEquals,
  shouldSkipComposerAutocompleteUpdate,
} from "./composer-autocomplete-compare.js";

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
  slashCatalog?: ComposerSlashCatalog;
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
  slashCatalog?: ComposerSlashCatalog;
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
  if (query.kind === "slash") {
    return composerSlashAutocompleteItems(
      query.query,
      input.slashCatalog ?? emptyComposerSlashSession(),
    );
  }
  return undefined;
}
