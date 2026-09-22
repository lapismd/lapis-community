import { describe, expect, it } from "vitest";

import {
  inboxConversationPending,
  inboxMessagesBelongToItem,
} from "./inbox-conversation-pending.js";

const welcome = {
  id: "welcome-thread",
  authorId: "fizz",
  context: "Mentioned in #Welcome",
  timestamp: "Yesterday",
  excerpt: "Welcome",
  rootEventId: "fizz-introduction",
  latestEventId: "steve-reply",
};
const support = {
  id: "support-thread",
  authorId: "honey",
  context: "Thread in #support",
  timestamp: "Today",
  excerpt: "Need a second conversation",
  rootEventId: "support-root",
  latestEventId: "support-latest",
};
const welcomeMessages = [
  { id: "fizz-introduction" },
  { id: "steve-reply", parentMessageId: "fizz-introduction" },
];

describe("inboxMessagesBelongToItem", () => {
  it("accepts the selected root or latest event", () => {
    expect(inboxMessagesBelongToItem(welcomeMessages, welcome)).toBe(true);
    expect(inboxMessagesBelongToItem(welcomeMessages, support)).toBe(false);
  });

  it("accepts an owner reply after the latest incoming event", () => {
    expect(
      inboxMessagesBelongToItem(
        [
          { id: "fizz-introduction" },
          { id: "steve-reply", parentMessageId: "fizz-introduction" },
          { id: "owner-continue", parentMessageId: "steve-reply" },
        ],
        welcome,
      ),
    ).toBe(true);
  });

  it("rejects a same-room dump that only contains the selected latest", () => {
    expect(
      inboxMessagesBelongToItem(
        [
          { id: "other-root" },
          { id: "other-reply", parentMessageId: "other-root" },
          { id: "support-latest", parentMessageId: "support-root" },
        ],
        support,
      ),
    ).toBe(false);
  });
});

describe("inboxConversationPending", () => {
  it("waits while the requested id has not been projected", () => {
    expect(
      inboxConversationPending(
        {
          activeItemId: welcome.id,
          items: [welcome, support],
          messages: welcomeMessages,
          selectedItem: welcome,
        },
        support.id,
      ),
    ).toBe(true);
  });

  it("hides the previous conversation after the selected id updates", () => {
    expect(
      inboxConversationPending({
        activeItemId: support.id,
        items: [welcome, support],
        messages: welcomeMessages,
        selectedItem: support,
      }),
    ).toBe(true);
  });

  it("is ready when an owner reply follows the latest incoming event", () => {
    expect(
      inboxConversationPending({
        activeItemId: welcome.id,
        items: [welcome, support],
        messages: [
          { id: "fizz-introduction" },
          { id: "steve-reply", parentMessageId: "fizz-introduction" },
          { id: "owner-continue", parentMessageId: "steve-reply" },
        ],
        selectedItem: welcome,
      }),
    ).toBe(false);
  });

  it("is ready when the projected messages belong to the selection", () => {
    expect(
      inboxConversationPending({
        activeItemId: welcome.id,
        items: [welcome, support],
        messages: welcomeMessages,
        selectedItem: welcome,
      }),
    ).toBe(false);
  });

  it("waits when the selected conversation still has no messages", () => {
    expect(
      inboxConversationPending({
        activeItemId: support.id,
        items: [welcome, support],
        messages: [],
        selectedItem: support,
      }),
    ).toBe(true);
  });
});
