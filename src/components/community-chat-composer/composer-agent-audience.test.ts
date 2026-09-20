import { afterEach, describe, expect, it } from "vitest";

import {
  applyAgentMentionChange,
  communityComposerMentionMembers,
  createComposerAgentAudience,
  restoreComposerDraftAfterSend,
  syncComposerAgentAudienceDraft,
} from "./composer-agent-audience.js";
import { resetPersistentAgentAudienceStore } from "./persistent-agent-audience.js";

const owner = "1".repeat(64);
const fizz = "a".repeat(64);

afterEach(() => {
  resetPersistentAgentAudienceStore();
});

describe("composer agent audience", () => {
  it("merges unknown agents into mention members", () => {
    expect(
      communityComposerMentionMembers(
        [{ id: owner, name: "Steve", handle: "steve", initials: "S" }],
        [
          {
            pubkey: fizz,
            name: "Fizz",
            ownerPubkey: owner,
            channelIds: ["general"],
          },
        ],
      ).map((member) => member.id),
    ).toEqual([owner, fizz]);
  });

  it("hydrates on first thread open and restores a trailing space", () => {
    const audience = createComposerAgentAudience({
      agents: () => [
        {
          pubkey: fizz,
          name: "Fizz",
          ownerPubkey: owner,
          channelIds: ["general"],
        },
      ],
      members: () => [],
      audience: () => ({
        ownerPubkey: owner,
        channelId: "general",
        threadRootId: "root",
      }),
      initialAgentPubkeys: () => [fizz],
      context: () => undefined,
      submitting: () => false,
    });
    audience.setEnabled(true);
    const hydrated = audience.hydrate("", "");
    expect(hydrated.value).toBe("@Fizz ");
    expect(audience.restoreAfterSend([fizz]).value).toBe("@Fizz ");
    expect(
      syncComposerAgentAudienceDraft(
        audience,
        hydrated.value ?? "",
        hydrated.key,
        [],
      ).value,
    ).toBeUndefined();
    expect(
      restoreComposerDraftAfterSend(true, audience, [fizz], [{ pubkey: fizz }]),
    ).toEqual({ value: "@Fizz ", mentionPubkeys: [fizz] });
  });

  it("strips a dismissed mention", () => {
    expect(
      applyAgentMentionChange(
        "@Fizz please continue",
        fizz,
        false,
        () => "Fizz",
      ),
    ).toBe("please continue");
  });
});
