import { createHash } from "node:crypto";

import {
  createPluginCommentTemplate,
  createPluginReplyTemplate,
  createRatingTemplate,
  createReactionTemplate,
} from "@lapismd/registry-protocol";
import type {
  CommunityKindMap,
  NostrEvent,
  RatingContent,
} from "@lapismd/registry-protocol";
import { finalizeEvent } from "nostr-tools/pure";

const day = 86_400;

export const demoParticipants = [
  { name: "Maya", displayName: "Maya Chen" },
  { name: "owen_local", displayName: "Owen" },
  { name: "Priya", displayName: "Priya N." },
  { name: "Theo", displayName: "Theo Martin" },
  { name: "sable_notes", displayName: "Sable" },
  { name: "Jonas", displayName: "Jonas Reed" },
  { name: "alba", displayName: "Alba" },
  { name: "Nico", displayName: "Nico S." },
  { name: "Kira", displayName: "Kira Patel" },
  { name: "Devon", displayName: "Devon" },
  { name: "Lena", displayName: "Lena Ortiz" },
  { name: "Samir", displayName: "Samir A." },
] as const;

interface DemoPost {
  author: number;
  day: number;
  parent?: number | undefined;
  content: string;
}

const demoPosts: readonly DemoPost[] = [
  {
    author: 0,
    day: 0,
    content:
      "I have been using the AI plugin for a week across a research vault and a daily-notes vault. The inline rewrite flow is already useful, but the part that makes it feel native is that I can keep the source note visible while I review a proposed change.\n\nThe biggest question for me is trust. I would like the provider, model, and files included in the request to be visible before anything leaves the device. A compact approval step would make it much easier to use this with work notes.\n\nHas anyone settled on a good local-model setup, or are most people using a hosted provider?",
  },
  {
    author: 1,
    day: 0,
    parent: 0,
    content:
      "I am using the local provider with a small model for summaries and a hosted model for harder edits. The split works well. A per-action provider badge would help because I sometimes forget which route is active.",
  },
  {
    author: 2,
    day: 1,
    parent: 0,
    content:
      "The approval step is the feature I want too. Ideally it would list the note, linked attachments, and selected text separately rather than saying only that context will be shared.",
  },
  {
    author: 3,
    day: 1,
    parent: 2,
    content:
      "Yes, and it should remember the choice only for that command. A blanket permission for the whole vault would be too easy to grant by accident.",
  },
  {
    author: 4,
    day: 2,
    content:
      "A small win: the transcript being stored as ordinary Markdown has made experiments much easier to audit. I moved a note between machines and the conversation remained readable without the plugin enabled.",
  },
  {
    author: 5,
    day: 3,
    parent: 4,
    content:
      "Does the transcript include tool calls as well as messages? That is the piece I need when a response changes several notes.",
  },
  {
    author: 4,
    day: 3,
    parent: 5,
    content:
      "It includes the visible result today. I would still like a folded technical section with the exact inputs and tool results for debugging.",
  },
  {
    author: 6,
    day: 4,
    content:
      "For long sessions I would love a way to pin two or three source notes as durable context. Re-adding the same references on every prompt is safe, but it becomes repetitive during an editing pass.",
  },
  {
    author: 7,
    day: 5,
    parent: 7,
    content:
      "A visible context shelf could solve that without making the scope mysterious. Each pinned item could have a remove button and an estimated token count.",
  },
  {
    author: 8,
    day: 6,
    parent: 7,
    content:
      "Token count would be especially useful for local models with smaller context windows. It could warn before older sources are dropped.",
  },
  {
    author: 9,
    day: 7,
    content:
      "The keyboard flow is close, but focus returns to the editor after I accept a suggestion and I lose my place in the chat. Keeping focus in the conversation until Escape would make reviewing several alternatives faster.",
  },
  {
    author: 10,
    day: 8,
    parent: 10,
    content:
      "I can reproduce this with the command palette flow. It is more noticeable with a screen reader because the accepted state is announced after focus has already moved.",
  },
  {
    author: 3,
    day: 9,
    content:
      "Has anyone tried this on a large vault? My index is around twelve thousand notes. Search is quick after startup, though the initial embedding pass took most of an afternoon on a laptop.",
  },
  {
    author: 11,
    day: 9,
    parent: 12,
    content:
      "About nine thousand notes here. Incremental updates have been cheap after the first pass. I excluded archive and build folders, which cut the initial work substantially.",
  },
  {
    author: 1,
    day: 10,
    parent: 12,
    content:
      "It would be helpful if the settings showed the last indexed time and number of excluded files. At the moment I check the logs when I am unsure whether a folder rule matched.",
  },
  {
    author: 2,
    day: 12,
    content:
      "I used the plugin to turn a month of rough meeting notes into a project brief. The useful pattern was asking for an outline first, editing that manually, and only then generating prose section by section.\n\nOne-shot generation was faster but much less faithful to the decisions in the notes. The staged flow kept citations close to the source and made mistakes obvious.\n\nA reusable prompt sequence, stored in the vault, would make this workflow easier to repeat and share with a team.",
  },
  {
    author: 5,
    day: 13,
    parent: 15,
    content:
      "That sounds like a good fit for command presets. I would want them to be plain files so they can be reviewed and versioned alongside the notes.",
  },
  {
    author: 6,
    day: 15,
    content:
      "Small request: show an estimated cost before sending a large hosted-model request. It does not need to be exact; even a low, medium, high indication would prevent surprises.",
  },
  {
    author: 8,
    day: 16,
    parent: 17,
    content:
      "I would pair that with the context list Maya described. Cost without showing what contributes to it can still feel arbitrary.",
  },
  {
    author: 0,
    day: 18,
    parent: 2,
    content:
      "Coming back after the latest local build: the context preview now makes the provider hand-off much easier to understand. I deliberately attached a PDF and two notes; each source was listed separately and removing one updated the estimate immediately.",
  },
  {
    author: 7,
    day: 19,
    parent: 19,
    content:
      "That sounds promising. Does the preview also distinguish selected text from the whole note?",
  },
  {
    author: 0,
    day: 19,
    parent: 20,
    content:
      "Yes. Selected text appears as its own item and the surrounding note is not included unless you add it explicitly.",
  },
  {
    author: 10,
    day: 21,
    content:
      "Accessibility follow-up: the current approval list reads clearly in VoiceOver and the remove buttons have useful labels. The remaining issue for me is announcing when generation starts and ends without moving focus.",
  },
  {
    author: 9,
    day: 23,
    parent: 22,
    content:
      "Agreed. A quiet status region would handle that and would also help keyboard users when a local model takes a while to respond.",
  },
];

const reactionPlan = [
  { target: 0, content: "+", authors: [1, 2, 3, 4, 6, 8, 10] },
  { target: 0, content: "💡", authors: [5, 7, 9] },
  { target: 2, content: "+", authors: [0, 3, 6, 8] },
  { target: 3, content: "👍", authors: [0, 2, 4] },
  { target: 4, content: "+", authors: [1, 5, 11] },
  { target: 7, content: "💡", authors: [0, 2, 7, 8] },
  { target: 9, content: "+", authors: [1, 6] },
  { target: 10, content: "👍", authors: [2, 10] },
  { target: 15, content: "🎉", authors: [0, 4, 5, 7, 11] },
  { target: 17, content: "💡", authors: [3, 8, 9] },
  { target: 19, content: "🎉", authors: [1, 2, 6, 10] },
  { target: 22, content: "+", authors: [0, 3, 9] },
] as const;

export interface DemoDiscussionOptions {
  pluginId: string;
  pluginAddress: string;
  pluginKind: number;
  publisherPubkey: string;
  version: string;
  kinds: CommunityKindMap;
  seedSecret: Uint8Array;
  startCreatedAt: number;
}

export interface DemoDiscussion {
  events: NostrEvent[];
  posts: NostrEvent[];
  participantSecrets: Uint8Array[];
  participantPubkeys: string[];
  nextCreatedAt: number;
}

export function createDemoDiscussion(
  options: DemoDiscussionOptions,
): DemoDiscussion {
  const authorSecrets = demoParticipants.map((_, index) =>
    deriveAuthorSecret(options.seedSecret, index),
  );
  const profiles = demoParticipants.map((participant, index) =>
    finalizeEvent(
      {
        kind: 0,
        created_at: options.startCreatedAt + index,
        tags: [],
        content: JSON.stringify({
          name: participant.name,
          display_name: participant.displayName,
          about: "Local Lapis registry demo participant",
        }),
      },
      authorSecrets[index]!,
    ),
  );
  const ratings = authorSecrets.slice(0, 8).map((authorSecret, index) => {
    const rating: RatingContent["rating"] = [5, 4, 5, 4, 5, 3, 5, 4][
      index
    ]! as RatingContent["rating"];
    return finalizeEvent(
      createRatingTemplate(
        {
          schema: "lapis.registry.rating/1",
          pluginId: options.pluginId,
          rating,
          status: "active",
          version: options.version,
        },
        options.pluginAddress,
        options.kinds,
        options.startCreatedAt + 60 + index,
      ),
      authorSecret,
    );
  });
  const posts: NostrEvent[] = [];
  for (const [index, post] of demoPosts.entries()) {
    const createdAt =
      options.startCreatedAt + day + post.day * day + index * 61;
    const parent = post.parent === undefined ? undefined : posts[post.parent];
    const template =
      parent === undefined
        ? createPluginCommentTemplate(
            post.content,
            {
              pluginAddress: options.pluginAddress,
              pluginKind: options.pluginKind,
              publisherPubkey: options.publisherPubkey,
            },
            options.kinds,
            createdAt,
          )
        : createPluginReplyTemplate(
            post.content,
            {
              pluginAddress: options.pluginAddress,
              pluginKind: options.pluginKind,
              publisherPubkey: options.publisherPubkey,
              parentEventId: parent.id,
              parentPubkey: parent.pubkey,
            },
            options.kinds,
            createdAt,
          );
    posts.push(finalizeEvent(template, authorSecrets[post.author]!));
  }
  const reactionBase = options.startCreatedAt + 25 * day;
  const reactions = reactionPlan.flatMap((group, groupIndex) =>
    group.authors.map((author, authorIndex) => {
      const target = posts[group.target]!;
      return finalizeEvent(
        createReactionTemplate(
          group.content,
          {
            eventId: target.id,
            eventKind: target.kind,
            eventPubkey: target.pubkey,
          },
          options.kinds,
          reactionBase + groupIndex * 60 + authorIndex,
        ),
        authorSecrets[author]!,
      );
    }),
  );
  return {
    events: [...profiles, ...ratings, ...posts, ...reactions],
    posts,
    participantSecrets: authorSecrets,
    participantPubkeys: profiles.map((profile) => profile.pubkey),
    nextCreatedAt: reactionBase + reactionPlan.length * 60 + 1,
  };
}

function deriveAuthorSecret(seed: Uint8Array, index: number): Uint8Array {
  return createHash("sha256")
    .update(seed)
    .update(`lapis-registry-demo-author-${index}`)
    .digest();
}
