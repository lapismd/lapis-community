import data from "@emoji-mart/data";
import { init, SearchIndex } from "emoji-mart";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import {
  compareAutocompleteMatch,
  compactEmojiShortcode,
} from "./autocomplete-rank.js";
import { detectComposerSlash } from "./composer-slash.js";
import { isSafeCommunityEmojiUrl } from "./model.js";

export type CommunityComposerAutocompleteKind =
  | "member"
  | "room"
  | "emoji"
  | "slash";

export interface CommunityComposerAutocompleteQuery {
  kind: CommunityComposerAutocompleteKind;
  query: string;
  from: number;
  to: number;
}

export interface CommunityComposerAutocompleteItem {
  id: string;
  kind: CommunityComposerAutocompleteKind;
  label: string;
  detail?: string;
  member?: CommunityMemberModel;
  room?: CommunityRoomModel;
  native?: string;
  customEmoji?: CommunityCustomEmoji;
}

interface EmojiMartSearchResult {
  id: string;
  name: string;
  skins?: Array<{ native?: string }>;
}

let emojiIndexReady: Promise<void> | undefined;

/**
 * Detect the active chat reference at the cursor. Mention queries can contain
 * spaces while they remain a prefix of a known display name, matching Buzz's
 * readable `@Display Name` wire format. Room and emoji queries stay single-token.
 */
export function detectCommunityComposerAutocomplete(
  value: string,
  cursorPosition: number,
  members: readonly CommunityMemberModel[],
): CommunityComposerAutocompleteQuery | null {
  const cursor = Math.max(0, Math.min(cursorPosition, value.length));
  const beforeCursor = value.slice(0, cursor);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const line = beforeCursor.slice(lineStart);

  const emoji = /(?:^|\s):([^\s:]{2,})$/u.exec(line);
  if (emoji) {
    const query = emoji[1] ?? "";
    return {
      kind: "emoji",
      query,
      from: cursor - query.length - 1,
      to: cursor,
    };
  }

  const room = /(?:^|[\s([{])#([^\s#:]*)$/u.exec(line);
  if (room) {
    const query = room[1] ?? "";
    return {
      kind: "room",
      query,
      from: cursor - query.length - 1,
      to: cursor,
    };
  }

  const simpleMention = /(?:^|[\s([{])@([^\s@#:]*)$/u.exec(line);
  if (simpleMention) {
    const query = simpleMention[1] ?? "";
    return {
      kind: "member",
      query,
      from: cursor - query.length - 1,
      to: cursor,
    };
  }

  const knownNames = members
    .map((member) => member.name.trim().toLocaleLowerCase())
    .filter(Boolean);
  const scanStart = Math.max(lineStart, cursor - 80);
  for (let index = cursor - 1; index >= scanStart; index -= 1) {
    const character = value[index];
    if (character === "@") {
      const before = value[index - 1] ?? "";
      if (index > 0 && !/[\s([{]/u.test(before)) continue;
      const candidate = value.slice(index + 1, cursor);
      if (candidate === "") return null;
      const normalized = candidate.toLocaleLowerCase();
      if (
        normalized.endsWith(" ") &&
        knownNames.includes(normalized.trimEnd())
      ) {
        return null;
      }
      if (knownNames.some((name) => name.startsWith(normalized))) {
        return {
          kind: "member",
          query: candidate,
          from: index,
          to: cursor,
        };
      }
      return null;
    }
  }
  return detectComposerSlash(value, cursor, line);
}

export function communityMemberAutocompleteItems(
  members: readonly CommunityMemberModel[],
  query: string,
): CommunityComposerAutocompleteItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  return members
    .filter((member) =>
      `${member.name} ${member.handle}`
        .toLocaleLowerCase()
        .includes(normalized),
    )
    .sort((left, right) =>
      compareAutocompleteMatch(
        `${left.name} ${left.handle}`,
        `${right.name} ${right.handle}`,
        normalized,
      ),
    )
    .slice(0, 12)
    .map((member) => ({
      id: `member:${member.id}`,
      kind: "member",
      label: member.name,
      detail: `@${member.handle}`,
      member,
    }));
}

export function communityRoomAutocompleteItems(
  rooms: readonly CommunityRoomModel[],
  query: string,
): CommunityComposerAutocompleteItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  return rooms
    .filter(
      (room) =>
        room.kind !== "direct" &&
        room.archived !== true &&
        room.name.toLocaleLowerCase().includes(normalized),
    )
    .sort((left, right) =>
      compareAutocompleteMatch(left.name, right.name, normalized),
    )
    .slice(0, 12)
    .map((room) => ({
      id: `room:${room.id}`,
      kind: "room",
      label: room.name,
      detail: room.kind === "forum" ? "Forum" : "Channel",
      room,
    }));
}

export async function communityEmojiAutocompleteItems(
  communityEmojis: readonly CommunityCustomEmoji[],
  query: string,
): Promise<CommunityComposerAutocompleteItem[]> {
  const normalized = query.trim().toLocaleLowerCase();
  const compactQuery = compactEmojiShortcode(normalized);
  const shortcodeCounts = new Map<string, number>();
  for (const emoji of communityEmojis) {
    const shortcode = emoji.shortcode.trim().toLocaleLowerCase();
    if (shortcode !== "" && isSafeCommunityEmojiUrl(emoji.url)) {
      shortcodeCounts.set(shortcode, (shortcodeCounts.get(shortcode) ?? 0) + 1);
    }
  }
  const custom = communityEmojis
    .filter(
      (emoji) =>
        isSafeCommunityEmojiUrl(emoji.url) &&
        shortcodeCounts.get(emoji.shortcode.trim().toLocaleLowerCase()) === 1 &&
        compactEmojiShortcode(emoji.shortcode).includes(compactQuery),
    )
    .sort((left, right) =>
      compareAutocompleteMatch(left.shortcode, right.shortcode, normalized),
    )
    .map((emoji) => ({
      id: `custom:${emoji.ownerPubkey}:${emoji.shortcode}`,
      kind: "emoji" as const,
      label: emoji.shortcode,
      detail: "Community emoji",
      customEmoji: emoji,
    }));

  try {
    emojiIndexReady ??= init({ data });
    await emojiIndexReady;
    const results = (await SearchIndex.search(normalized, {
      caller: "community-chat-composer",
      maxResults: 24,
    })) as EmojiMartSearchResult[] | null;
    const standard = (results ?? []).flatMap((emoji) => {
      const native = emoji.skins?.[0]?.native;
      return native
        ? [
            {
              id: `standard:${emoji.id}`,
              kind: "emoji" as const,
              label: emoji.id,
              detail: emoji.name,
              native,
            },
          ]
        : [];
    });
    return [...custom, ...standard].slice(0, 24);
  } catch {
    return custom.slice(0, 24);
  }
}
