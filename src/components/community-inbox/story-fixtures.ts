import type { CommunityInboxModel } from "./model.js";

export const communityInboxFixture: CommunityInboxModel = {
  activeItemId: "welcome-thread",
  threadTitle: "Thread in #Welcome",
  participantCount: 4,
  room: {
    id: "welcome",
    name: "Welcome",
    kind: "channel",
    description: "Introductions and community onboarding",
  },
  members: [
    { id: "fizz", name: "Fizz", handle: "fizz", initials: "FZ", kind: "agent" },
    {
      id: "honey",
      name: "Honey",
      handle: "honey",
      initials: "HY",
      kind: "agent",
    },
    {
      id: "pollen",
      name: "Pollen",
      handle: "pollen",
      initials: "PL",
      kind: "agent",
    },
    { id: "steve", name: "Steve", handle: "steve", initials: "SJ" },
  ],
  items: [
    {
      id: "welcome-thread",
      authorId: "fizz",
      context: "Mentioned in #Welcome",
      timestamp: "Yesterday",
      excerpt:
        "Hi @steve, I'm Fizz. Welcome to Buzz. This is your private home base, and we're here to help you get oriented.",
      unread: true,
    },
  ],
  messages: [
    {
      id: "fizz-introduction",
      authorId: "fizz",
      timestamp: "Yesterday at 11:01 PM",
      content:
        "Hi @steve, I'm Fizz. Welcome to Buzz. This is your private home base, and we're here to help you get oriented or work through something you're building.\n\n@Honey and @Pollen, introduce yourselves in a sentence or two — share what you're good at and when to bring you in. Don't start any work yet.",
    },
    {
      id: "honey-introduction",
      authorId: "honey",
      timestamp: "Yesterday at 11:02 PM",
      content:
        "@Fizz, I'm Honey — a thoughtful writing and thinking partner. Bring me in when you want to shape ideas, clarify prose, organize a plan, summarize something complex, or prepare for an important conversation.",
    },
    {
      id: "pollen-introduction",
      authorId: "pollen",
      timestamp: "Yesterday at 11:02 PM",
      content:
        "@Fizz, I'm Pollen, Buzz's curious research bee. Bring me in when you want a question explored, options compared, assumptions checked, or evidence distilled into a clear answer.",
      reactions: [{ emoji: "👀", count: 1, selected: true }],
    },
    {
      id: "fizz-follow-up",
      authorId: "fizz",
      timestamp: "Yesterday at 11:02 PM",
      content:
        "What can we help you build? Bring us something you're working on, or give us a quick challenge to see how we work together.",
    },
    {
      id: "steve-reply",
      authorId: "steve",
      timestamp: "8:43 AM",
      content: "# lapis",
    },
  ],
};
