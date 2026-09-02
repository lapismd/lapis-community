import type {
  CommunityDetailsModel,
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityModel,
  CommunityWorkspaceNavigationSectionModel,
  CommunityWorkspaceModel,
  CommunityThreadModel,
  CommunityTopicModel,
} from "./model.js";

export const communityStoryMembers: CommunityMemberModel[] = [
  {
    id: "ada",
    name: "Ada Lovelace",
    handle: "ada",
    initials: "AL",
    presence: "online",
    role: "curator",
  },
  {
    id: "ben",
    name: "Ben Stone",
    handle: "benstone",
    initials: "BS",
    presence: "online",
    role: "publisher",
  },
  {
    id: "cy",
    name: "Cy Park",
    handle: "cypark",
    initials: "CP",
    presence: "away",
  },
  {
    id: "mara",
    name: "Mara Chen",
    handle: "marac",
    initials: "MC",
    presence: "online",
    role: "moderator",
  },
  {
    id: "noor",
    name: "Noor Rahman",
    handle: "noor",
    initials: "NR",
    presence: "offline",
  },
];

export const communityStoryCommunities: CommunityModel[] = [
  {
    id: "lapis",
    name: "Lapis Community",
    initials: "LC",
    description: "Build, publish, and support Lapis plugins",
  },
  {
    id: "makers",
    name: "Plugin Makers",
    initials: "PM",
    description: "Independent plugin maintainers",
    unreadCount: 4,
  },
  {
    id: "security",
    name: "Security Lab",
    initials: "SL",
    description: "Coordinated security work",
  },
];

export const communityStoryNavigation: CommunityWorkspaceNavigationSectionModel[] =
  [
    {
      id: "channels",
      label: "Channels",
      rooms: [
        {
          id: "announcements",
          name: "announcements",
          kind: "channel",
          description: "News from the Lapis team",
          memberCount: 248,
        },
        {
          id: "general",
          name: "general",
          kind: "channel",
          description: "Conversation across the Lapis community",
          memberCount: 248,
        },
        {
          id: "plugin-development",
          name: "plugin-development",
          kind: "channel",
          description: "Build plugins with other publishers",
          unreadCount: 12,
          mentionCount: 2,
          memberCount: 91,
        },
      ],
    },
    {
      id: "forums",
      label: "Forums",
      rooms: [
        {
          id: "support-ai",
          name: "support-ai",
          kind: "forum",
          description: "Questions, guides, and support for the AI plugin",
          unreadCount: 7,
          memberCount: 126,
        },
        {
          id: "plugin-ideas",
          name: "plugin-ideas",
          kind: "forum",
          description: "Propose and refine new plugin ideas",
          memberCount: 183,
        },
      ],
    },
    {
      id: "direct-messages",
      label: "Direct messages",
      rooms: [
        { id: "dm-ada", name: "Ada Lovelace", kind: "direct", private: true },
        { id: "dm-mara", name: "Mara Chen", kind: "direct", private: true },
      ],
    },
  ];

export const communityStoryMessages: CommunityMessageModel[] = [
  {
    id: "message-welcome",
    authorId: "ada",
    timestamp: "09:12",
    createdAt: "2026-09-02T09:12:00Z",
    content:
      "Morning everyone — the new community relay is ready for another local test. Today I would like to focus on how plugin support moves between a quick channel answer and a durable forum topic.",
    reactions: [
      { emoji: "👋", count: 7, selected: true },
      { emoji: "🚀", count: 3 },
    ],
    replyCount: 3,
  },
  {
    id: "message-release",
    authorId: "ben",
    timestamp: "09:18",
    createdAt: "2026-09-02T09:18:00Z",
    content:
      "I have published the AI plugin fixture against the local relay. The release message and its approval resolve correctly, and the rendered registry now links back to the support forum.",
    reactions: [
      { emoji: "✅", count: 5 },
      { emoji: "🎉", count: 4 },
    ],
    replyCount: 8,
    replyLabel: "8 replies · last reply 4 minutes ago",
  },
  {
    id: "message-question",
    authorId: "cy",
    timestamp: "09:24",
    createdAt: "2026-09-02T09:24:00Z",
    content:
      "Does the support forum keep the same signed reply relationship when a topic is moved between categories? I can add that to the browser acceptance notes.",
  },
  {
    id: "message-answer",
    authorId: "mara",
    timestamp: "09:28",
    createdAt: "2026-09-02T09:28:00Z",
    edited: true,
    content:
      "Yes. The UI category is derived from the room, while the signed root and parent references remain unchanged. Moderation can hide a post from this view without changing registry trust.",
    reactions: [{ emoji: "💡", count: 2 }],
    replyCount: 2,
  },
  {
    id: "message-docs",
    authorId: "noor",
    timestamp: "09:36",
    createdAt: "2026-09-02T09:36:00Z",
    content:
      "I will turn the outcome into a short forum guide so it remains discoverable after this channel scrolls on.",
    reactions: [{ emoji: "🙌", count: 3 }],
  },
];

export const communityStoryThread: CommunityThreadModel = {
  rootMessageId: "message-release",
  messages: [
    communityStoryMessages[1]!,
    {
      id: "thread-1",
      authorId: "mara",
      parentMessageId: "message-release",
      timestamp: "09:20",
      content:
        "Confirmed here too. The approval is visible in the public read model but the relay still treats it as an ordinary signed message.",
      reactions: [{ emoji: "👍", count: 2, selected: true }],
    },
    {
      id: "thread-2",
      authorId: "ada",
      parentMessageId: "thread-1",
      timestamp: "09:22",
      content:
        "Exactly. Authority belongs to the configured curator key in the materializer, not to a special relay endpoint.",
      reactions: [{ emoji: "🔐", count: 3 }],
    },
    {
      id: "thread-3",
      authorId: "ben",
      parentMessageId: "thread-2",
      timestamp: "09:27",
      content:
        "I will add the event identifiers to the test notes and keep the UI fixture free of relay calls.",
    },
  ],
};

export const communityStoryTopics: CommunityTopicModel[] = [
  {
    id: "topic-large-vault",
    title: "First-token latency with a large vault",
    excerpt:
      "Comparing local inference warm-up and response times across larger collections of notes.",
    authorId: "ada",
    tags: ["performance", "local-ai"],
    replyCount: 34,
    participantIds: ["ada", "ben", "cy", "noor"],
    lastActivityLabel: "12 min",
    pinned: true,
  },
  {
    id: "topic-provider",
    title: "Recommended provider settings for private workspaces",
    excerpt:
      "A practical baseline for keeping requests local and making remote providers explicitly opt-in.",
    authorId: "mara",
    tags: ["guide", "privacy"],
    replyCount: 18,
    participantIds: ["mara", "ada", "noor"],
    lastActivityLabel: "1 hr",
    solved: true,
  },
  {
    id: "topic-context",
    title: "How should context selection work across linked notes?",
    excerpt:
      "Exploring predictable context boundaries when a note embeds or links to another document.",
    authorId: "cy",
    tags: ["design"],
    replyCount: 27,
    participantIds: ["cy", "ben", "ada"],
    lastActivityLabel: "3 hr",
  },
  {
    id: "topic-model-download",
    title: "Model download resumes after an interrupted connection",
    excerpt:
      "The download restarts from zero on one platform; sharing logs and a possible recovery path.",
    authorId: "noor",
    tags: ["support"],
    replyCount: 9,
    participantIds: ["noor", "ben"],
    lastActivityLabel: "Yesterday",
  },
];

export const communityForumMessages: CommunityMessageModel[] = [
  {
    id: "forum-root",
    authorId: "ada",
    timestamp: "Aug 28",
    content:
      "I have been profiling first-token latency with vaults between 1,000 and 20,000 notes. The initial index warm-up dominates the first request, but later turns remain comfortably interactive.\n\nThe main question is whether the plugin should show a distinct warm-up state or treat this as ordinary generation progress. A clear state would help people understand that their model is healthy and still local.",
    reactions: [
      { emoji: "👍", count: 14, selected: true },
      { emoji: "🧪", count: 6 },
    ],
    replyCount: 34,
    replyLabel: "34 replies",
  },
  {
    id: "forum-reply-1",
    authorId: "ben",
    parentMessageId: "forum-root",
    timestamp: "Aug 28",
    content:
      "My results are similar at roughly 8,000 notes. Separating index warm-up from generation would make the delay much easier to reason about, especially after an application restart.",
    reactions: [{ emoji: "💡", count: 8 }],
  },
  {
    id: "forum-reply-2",
    authorId: "cy",
    parentMessageId: "forum-reply-1",
    timestamp: "Aug 29",
    content:
      "Could that indicator also expose the number of files remaining? A determinate progress bar may be noisy, but a short status such as ‘warming 2 of 4 indexes’ would set expectations.",
    reactions: [{ emoji: "➕", count: 5 }],
  },
  {
    id: "forum-reply-3",
    authorId: "mara",
    parentMessageId: "forum-root",
    timestamp: "Today",
    content:
      "I have marked this for the next plugin design review. The implementation should keep the progress source in the host capability rather than estimating it inside the presentation component.",
    reactions: [{ emoji: "✅", count: 7 }],
  },
];

export const communityStoryDetails: CommunityDetailsModel = {
  description:
    "A public room for questions, guides, and durable support conversations about the Lapis AI plugin.",
  guidelines: [
    "Search for an existing topic before opening a new one.",
    "Remove private note content and credentials from examples.",
    "Mark the answer that resolved your question when possible.",
  ],
  memberIds: ["ada", "ben", "cy", "mara", "noor"],
  moderatorIds: ["ada", "mara"],
};

function baseModel(): CommunityWorkspaceModel {
  return {
    communities: communityStoryCommunities,
    activeCommunityId: "lapis",
    navigationSections: communityStoryNavigation,
    activeRoomId: "general",
    view: "channel",
    messages: communityStoryMessages,
    topics: communityStoryTopics,
    members: communityStoryMembers,
    currentMemberId: "ada",
    thread: communityStoryThread,
    details: communityStoryDetails,
    sidePanel: "none",
  };
}

export function createChannelStoryModel(
  sidePanel: "thread" | "details" | "none" = "none",
): CommunityWorkspaceModel {
  return { ...baseModel(), sidePanel };
}

export function createForumIndexStoryModel(): CommunityWorkspaceModel {
  return {
    ...baseModel(),
    activeRoomId: "support-ai",
    view: "forum-index",
    sidePanel: "none",
  };
}
