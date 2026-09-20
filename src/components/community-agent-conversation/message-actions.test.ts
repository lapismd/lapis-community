import { describe, expect, it } from "vitest";
import {
  discussionEdit,
  discussionDeletion,
  discussionPermalink,
} from "./message-actions.js";
import { conversationMessage, visibleEvents } from "./model.js";
import {
  request,
  response,
  signOwner,
} from "../../testing/agent-conversation-fixture.js";

describe("native discussion actions", () => {
  it("projects authored edits without changing the signed source or reply anchors", () => {
    const edit = signOwner(
      discussionEdit(request, request.pubkey, "Revised request"),
    );
    const model = conversationMessage(
      request,
      [request, response, edit],
      request.pubkey,
    );
    expect(model.content).toBe("Revised request");
    expect(model.edited).toBe(true);
    expect(model.sourceEvent).toBe(request);
    expect(model.id).toBe(request.id);
    expect(model.replyCount).toBe(1);
    const forged = signOwner({
      ...edit,
      tags: [
        ["h", "other"],
        ["e", request.id],
      ],
    });
    expect(conversationMessage(request, [forged]).content).toBe(
      request.content,
    );
    expect(() => discussionEdit(response, request.pubkey, "forged")).toThrow(
      "Only the author",
    );
    expect(() => discussionDeletion(response, request.pubkey)).toThrow(
      "Only the author",
    );
    expect(discussionPermalink(request)).toMatch(/^nostr:nevent1/);
  });
  it("deletes only the author's referenced message", () => {
    const deletion = signOwner(discussionDeletion(request, request.pubkey));
    expect(visibleEvents([request, response, deletion])).not.toContain(request);
    expect(visibleEvents([request, response, deletion])).toContain(response);
    expect(() => discussionEdit(request, request.pubkey, " ")).toThrow();
  });
});
