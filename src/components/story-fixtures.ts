import type { NostrEvent } from "../protocol/index.js";

import type {
  CommunityProfile,
  ForumPost,
  ForumReaction,
} from "./registry-community/model.js";

const authors = {
  ada: "a".repeat(64),
  ben: "b".repeat(64),
  cy: "c".repeat(64),
} as const;

function event(
  id: string,
  pubkey: string,
  content: string,
  createdAt: number,
  parent?: ForumPost,
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    pubkey,
    created_at: createdAt,
    kind: parent === undefined ? 11 : 1111,
    tags:
      parent === undefined
        ? [["h", "support-ai"]]
        : [
            ["h", "support-ai"],
            ["e", parent.event.id],
            ["E", parent.rootEventId],
          ],
    content,
    sig: id.repeat(128).slice(0, 128),
  };
}

export const storyProfiles = new Map<string, CommunityProfile>([
  [authors.ada, { pubkey: authors.ada, name: "Ada Lovelace" }],
  [authors.ben, { pubkey: authors.ben, name: "Ben Stone" }],
  [authors.cy, { pubkey: authors.cy, name: "Cy Park" }],
]);

const root: ForumPost = {
  event: event(
    "1",
    authors.ada,
    "The local inference path is working well. Has anyone profiled the first-token latency with a larger vault?",
    1_788_200_000,
  ),
  content:
    "The local inference path is working well. Has anyone profiled the first-token latency with a larger vault?",
  rootEventId: "1".repeat(64),
};

const reply: ForumPost = {
  event: event(
    "2",
    authors.ben,
    "I tested with roughly 8,000 notes. Index warm-up dominates, then responses stay comfortably interactive.",
    1_788_203_600,
    root,
  ),
  content:
    "I tested with roughly 8,000 notes. Index warm-up dominates, then responses stay comfortably interactive.",
  rootEventId: root.event.id,
  parentEventId: root.event.id,
};

const followUp: ForumPost = {
  event: event(
    "3",
    authors.cy,
    "That matches my results. A small progress affordance during warm-up would make the delay much clearer.",
    1_788_207_200,
    reply,
  ),
  content:
    "That matches my results. A small progress affordance during warm-up would make the delay much clearer.",
  rootEventId: root.event.id,
  parentEventId: reply.event.id,
};

export const storyPosts = [root, reply, followUp];

export const storyReactions: ForumReaction[] = [
  {
    event: {
      ...event("4", authors.cy, "+", 1_788_208_000, root),
      kind: 7,
    },
    targetEventId: root.event.id,
    content: "+",
  },
  {
    event: {
      ...event("5", authors.ada, "👍", 1_788_208_100, reply),
      kind: 7,
    },
    targetEventId: reply.event.id,
    content: "👍",
  },
];

export function noop(): void {}

export async function noMorePosts(): Promise<boolean> {
  return false;
}
