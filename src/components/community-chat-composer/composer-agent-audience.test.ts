import { afterEach, describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

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
    expect(hydrated.value).toBe(`nostr:${npubEncode(fizz)} `);
    expect(audience.restoreAfterSend([fizz]).value).toBe(
      `nostr:${npubEncode(fizz)} `,
    );
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
    ).toEqual({
      value: `nostr:${npubEncode(fizz)} `,
      mentionPubkeys: [fizz],
    });
  });

  it("promotes a colliding agent mention into the address lock", () => {
    const nyra = "c".repeat(64);
    const audience = createComposerAgentAudience({
      agents: () => [
        {
          pubkey: nyra,
          name: "Nyra",
          ownerPubkey: owner,
          channelIds: ["general"],
        },
      ],
      members: () => [
        { id: "nyra", name: "Nyra", handle: "nyra-human", initials: "NY" },
      ],
      audience: () => ({
        ownerPubkey: owner,
        channelId: "general",
        threadRootId: "nyra-root",
      }),
      initialAgentPubkeys: () => [],
      context: () => undefined,
      submitting: () => false,
    });
    audience.setEnabled(true);
    const synced = syncComposerAgentAudienceDraft(audience, "@Nyra ", "", [
      nyra,
    ]);
    expect(synced.mentionPubkeys).toContain(nyra);
    expect(audience.mentionButtonMember()?.id).toBe(nyra);
    expect(audience.mentionButtonMember()?.kind).toBe("agent");
  });

  it("exposes a mention lock member only while auto-mention is on", () => {
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
    expect(audience.mentionButtonMember()).toBeUndefined();
    audience.setEnabled(true);
    audience.hydrate("", "");
    expect(audience.mentionButtonMember()?.id).toBe(fizz);
    audience.setEnabled(false);
    expect(audience.mentionButtonMember()).toBeUndefined();
  });

  it("does not re-address a dismissed agent from leftover draft text", () => {
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
    const first = syncComposerAgentAudienceDraft(audience, "@Fizz ", "", [
      fizz,
    ]);
    expect(audience.mentionButtonMember()?.id).toBe(fizz);
    audience.dismiss(fizz);
    const next = syncComposerAgentAudienceDraft(
      audience,
      "@Fizz leftover",
      first.key,
      [],
    );
    expect(audience.mentionButtonMember()).toBeUndefined();
    expect(next.mentionPubkeys).not.toContain(fizz);
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
