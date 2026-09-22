import { afterEach, describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import { createComposerAgentAudience } from "./composer-agent-audience.js";
import { syncComposerAgentAudienceDraft } from "./composer-audience-draft-sync.js";
import {
  resetPersistentAgentAudienceStore,
  subscribePersistentAgentAudience,
} from "./persistent-agent-audience.js";

const owner = "1".repeat(64);
const fizz = "a".repeat(64);

afterEach(() => {
  resetPersistentAgentAudienceStore();
});

describe("composer audience draft sync", () => {
  it("does not thrash the audience store when draft sync repeats", () => {
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
    const first = syncComposerAgentAudienceDraft(audience, "", "", []);
    expect(first.value).toBe(`nostr:${npubEncode(fizz)} `);
    let notifications = 0;
    const unsubscribe = subscribePersistentAgentAudience(() => {
      notifications += 1;
    });
    for (let index = 0; index < 20; index += 1) {
      const next = syncComposerAgentAudienceDraft(audience, "", first.key, [
        fizz,
      ]);
      expect(next.value).toBeUndefined();
      expect(audience.mentionButtonMember()?.id).toBe(fizz);
    }
    unsubscribe();
    expect(notifications).toBe(0);
  });
});
