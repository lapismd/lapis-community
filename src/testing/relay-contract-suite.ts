import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CommunityRelay } from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export const relayContractAliceKey = new Uint8Array(32).fill(1);
export const relayContractBobKey = new Uint8Array(32).fill(2);

export interface CommunityRelayContractContext {
  connection(secretKey?: Uint8Array): Promise<CommunityRelay>;
  uniqueId(label: string): string;
  supportsCount?: boolean;
  dispose(): Promise<void> | void;
}

export type CommunityRelayContractContextFactory = () =>
  | CommunityRelayContractContext
  | Promise<CommunityRelayContractContext>;

export function registerCommunityRelayContract(
  name: string,
  createContext: CommunityRelayContractContextFactory,
): void {
  describe(name, () => {
    let context: CommunityRelayContractContext;

    beforeEach(async () => {
      context = await createContext();
    });

    afterEach(async () => {
      await context.dispose();
    });

    it("queries, counts, filters, and deterministically orders events", async () => {
      const relay = await context.connection();
      const groupId = context.uniqueId("query");
      await createGroup(relay, groupId, 90);
      const first = message(relayContractAliceKey, 100, "first", groupId);
      const second = message(relayContractAliceKey, 101, "second", groupId);
      const sameTime = message(
        relayContractAliceKey,
        101,
        "same-time",
        groupId,
      );
      await relay.publish(first);
      await relay.publish(second);
      await relay.publish(sameTime);

      const events = await relay.query({ kinds: [9], "#h": [groupId] });
      expect(events.map((event) => event.id)).toEqual(
        [first, second, sameTime]
          .toSorted(
            (left, right) =>
              right.created_at - left.created_at ||
              right.id.localeCompare(left.id),
          )
          .map((event) => event.id),
      );
      const count = relay.count?.({ kinds: [9], "#h": [groupId] });
      if (context.supportsCount === false) {
        await expect(count).rejects.toThrow(/(?:unsupported|NIP-45)/iu);
      } else {
        await expect(count).resolves.toBe(3);
      }
      const bounded = await relay.query({
        kinds: [9],
        "#h": [groupId],
        limit: 1,
      });
      expect(bounded).toHaveLength(1);
      expect(bounded[0]?.created_at).toBe(events[0]?.created_at);
    });

    it("accepts valid events and rejects invalid or mismatched authors", async () => {
      const relay = await context.connection(relayContractAliceKey);
      const groupId = context.uniqueId("publish");
      await createGroup(relay, groupId, 109);
      const event = message(relayContractAliceKey, 110, "valid", groupId);
      await expect(relay.publish(event)).resolves.toMatchObject({
        accepted: true,
      });
      await expect(
        relay.publish({ ...event, content: "tampered" }),
      ).rejects.toThrow();
      await expect(
        relay.publish(
          message(relayContractBobKey, 111, "wrong author", groupId),
        ),
      ).rejects.toThrow();
    });

    it("delivers live events and honors cancellation and close", async () => {
      const relay = await context.connection();
      const groupId = context.uniqueId("live");
      await createGroup(relay, groupId, 119);
      let resolveEvent: ((event: NostrEvent) => void) | undefined;
      const delivered = new Promise<NostrEvent>((resolve) => {
        resolveEvent = resolve;
      });
      const subscription = await relay.subscribe(
        { kinds: [9], "#h": [groupId] },
        { onevent: (event) => resolveEvent?.(event) },
      );
      const event = message(relayContractAliceKey, 120, "live", groupId);
      await relay.publish(event);
      await expect(withTimeout(delivered)).resolves.toMatchObject({
        id: event.id,
      });
      subscription.close("contract complete");

      const aborted = new AbortController();
      aborted.abort(new DOMException("contract abort", "AbortError"));
      await expect(
        relay.query({ kinds: [9], "#h": [groupId] }, aborted.signal),
      ).rejects.toThrow();
      relay.close();
      await expect(
        relay.query({ kinds: [9], "#h": [groupId] }),
      ).rejects.toThrow();
    });

    it("applies addressable replacement and author deletion", async () => {
      const relay = await context.connection();
      const identifier = context.uniqueId("state");
      const older = sign(relayContractAliceKey, {
        kind: 30_078,
        created_at: 130,
        content: "older",
        tags: [["d", identifier]],
      });
      const newer = sign(relayContractAliceKey, {
        kind: 30_078,
        created_at: 131,
        content: "newer",
        tags: [["d", identifier]],
      });
      await relay.publish(older);
      await relay.publish(newer);
      expect(
        await relay.query({ kinds: [30_078], "#d": [identifier] }),
      ).toMatchObject([{ id: newer.id, content: "newer" }]);

      const groupId = context.uniqueId("delete");
      await createGroup(relay, groupId, 131);
      const target = message(relayContractAliceKey, 132, "delete", groupId);
      await relay.publish(target);
      await relay.publish(
        sign(relayContractAliceKey, {
          kind: 5,
          created_at: 133,
          content: "",
          tags: [["e", target.id]],
        }),
      );
      expect(await relay.query({ ids: [target.id] })).toEqual([]);
    });

    it("authenticates with NIP-42 before protected operations", async () => {
      const relay = await context.connection(relayContractAliceKey);
      const groupId = context.uniqueId("auth");
      await createGroup(relay, groupId, 139);
      const event = message(
        relayContractAliceKey,
        140,
        "authenticated",
        groupId,
      );
      await expect(relay.publish(event)).resolves.toMatchObject({
        accepted: true,
      });
      expect(
        await relay.query({
          ids: [event.id],
          authors: [getPublicKey(relayContractAliceKey)],
        }),
      ).toHaveLength(1);
    });

    it("materializes NIP-29 membership, writer policy, and invite transitions", async () => {
      const groupId = context.uniqueId("group");
      const createdAt = Math.floor(Date.now() / 1_000);
      const admin = await context.connection(relayContractAliceKey);
      await admin.publish(
        sign(relayContractAliceKey, {
          kind: 9_007,
          created_at: createdAt,
          content: JSON.stringify({ name: "Contract group" }),
          tags: [
            ["h", groupId],
            ["name", "Contract group"],
            ["supported_kinds", "9", "11", "1111"],
          ],
        }),
      );
      await expect(
        waitForEvents(
          admin,
          { kinds: [39_000, 39_001, 39_002], "#d": [groupId] },
          3,
        ),
      ).resolves.toHaveLength(3);

      const member = await context.connection(relayContractBobKey);
      await member.publish(
        sign(relayContractBobKey, {
          kind: 9_021,
          created_at: createdAt + 1,
          content: "",
          tags: [["h", groupId]],
        }),
      );
      const memberPubkey = getPublicKey(relayContractBobKey);
      const members = await waitForEvents(
        member,
        { kinds: [39_002], "#d": [groupId] },
        1,
        (events) =>
          events[0]?.tags.some(
            (tag) => tag[0] === "p" && tag[1] === memberPubkey,
          ) === true,
      );
      expect(members[0]?.tags).toContainEqual(["p", memberPubkey]);
      await expect(
        member.publish(
          sign(relayContractBobKey, {
            kind: 9_002,
            created_at: createdAt + 2,
            content: "",
            tags: [
              ["h", groupId],
              ["name", "Not allowed"],
            ],
          }),
        ),
      ).rejects.toThrow();

      const roleAdmin = await context.connection(relayContractAliceKey);
      await roleAdmin.publish(
        sign(relayContractAliceKey, {
          kind: 9_000,
          created_at: createdAt + 3,
          content: "",
          tags: [
            ["h", groupId],
            ["p", memberPubkey, "writer"],
          ],
        }),
      );
      await expect(
        waitForEvents(
          roleAdmin,
          { kinds: [39_002], "#d": [groupId] },
          1,
          (events) =>
            events[0]?.tags.some(
              (tag) =>
                tag[0] === "p" &&
                tag[1] === memberPubkey &&
                tag.includes("writer"),
            ) === true,
        ),
      ).resolves.toHaveLength(1);
      await roleAdmin.publish(
        sign(relayContractAliceKey, {
          kind: 9_002,
          created_at: createdAt + 4,
          content: JSON.stringify({
            name: "Contract group",
            private: true,
            "write-restricted": true,
          }),
          tags: [
            ["h", groupId],
            ["name", "Contract group"],
            ["private"],
            ["write-restricted"],
          ],
        }),
      );
      await expect(
        waitForEvents(
          roleAdmin,
          { kinds: [39_000], "#d": [groupId] },
          1,
          (events) =>
            events[0]?.tags.some((tag) => tag[0] === "write-restricted") ===
            true,
        ),
      ).resolves.toHaveLength(1);
      const writerMember = await context.connection(relayContractBobKey);
      await expect(
        writerMember.publish(
          message(
            relayContractBobKey,
            createdAt + 5,
            "writer message",
            groupId,
          ),
        ),
      ).resolves.toMatchObject({ accepted: true });
      const clearingAdmin = await context.connection(relayContractAliceKey);
      await clearingAdmin.publish(
        sign(relayContractAliceKey, {
          kind: 9_000,
          created_at: createdAt + 6,
          content: "",
          tags: [
            ["h", groupId],
            ["p", memberPubkey],
          ],
        }),
      );
      await expect(
        waitForEvents(
          clearingAdmin,
          { kinds: [39_002], "#d": [groupId] },
          1,
          (events) =>
            events[0]?.tags.some(
              (tag) =>
                tag[0] === "p" && tag[1] === memberPubkey && tag.length === 2,
            ) === true,
        ),
      ).resolves.toHaveLength(1);
      const restrictedMember = await context.connection(relayContractBobKey);
      await expect(
        restrictedMember.publish(
          message(relayContractBobKey, createdAt + 7, "not a writer", groupId),
        ),
      ).rejects.toThrow();
      await restrictedMember.publish(
        sign(relayContractBobKey, {
          kind: 9_022,
          created_at: createdAt + 8,
          content: "",
          tags: [["h", groupId]],
        }),
      );
      const leaveObserver = await context.connection(relayContractAliceKey);
      await expect(
        waitForEvents(
          leaveObserver,
          { kinds: [39_002], "#d": [groupId] },
          1,
          (events) =>
            events[0]?.tags.every(
              (tag) => tag[0] !== "p" || tag[1] !== memberPubkey,
            ) === true,
        ),
      ).resolves.toHaveLength(1);
      const inviteAdmin = await context.connection(relayContractAliceKey);
      await inviteAdmin.publish(
        sign(relayContractAliceKey, {
          kind: 9_009,
          created_at: createdAt + 9,
          content: "",
          tags: [
            ["h", groupId],
            ["code", "contract-invite"],
          ],
        }),
      );
      const invitedMember = await context.connection(relayContractBobKey);
      await expect(
        invitedMember.publish(
          sign(relayContractBobKey, {
            kind: 9_021,
            created_at: createdAt + 10,
            content: "",
            tags: [
              ["h", groupId],
              ["code", "wrong-code"],
            ],
          }),
        ),
      ).rejects.toThrow();
      await invitedMember.publish(
        sign(relayContractBobKey, {
          kind: 9_021,
          created_at: createdAt + 11,
          content: "",
          tags: [
            ["h", groupId],
            ["code", "contract-invite"],
          ],
        }),
      );
      await expect(
        waitForEvents(
          invitedMember,
          { kinds: [39_002], "#d": [groupId] },
          1,
          (events) =>
            events[0]?.tags.some(
              (tag) => tag[0] === "p" && tag[1] === memberPubkey,
            ) === true,
        ),
      ).resolves.toHaveLength(1);
    });
  });
}

function sign(secretKey: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secretKey);
}

function message(
  secretKey: Uint8Array,
  createdAt: number,
  content: string,
  groupId: string,
): NostrEvent {
  return sign(secretKey, {
    kind: 9,
    created_at: createdAt,
    content,
    tags: [["h", groupId]],
  });
}

async function createGroup(
  relay: CommunityRelay,
  groupId: string,
  createdAt: number,
): Promise<void> {
  await relay.publish(
    sign(relayContractAliceKey, {
      kind: 9_007,
      created_at: createdAt,
      content: JSON.stringify({ name: groupId }),
      tags: [
        ["h", groupId],
        ["name", groupId],
        ["supported_kinds", "9", "7"],
      ],
    }),
  );
  await waitForEvents(relay, { kinds: [39_000], "#d": [groupId] }, 1);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 5_000,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Relay contract operation timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function waitForEvents(
  relay: CommunityRelay,
  filter: Parameters<CommunityRelay["query"]>[0],
  minimum: number,
  predicate: (events: readonly NostrEvent[]) => boolean = () => true,
): Promise<NostrEvent[]> {
  const deadline = Date.now() + 5_000;
  let lastEvents: readonly NostrEvent[] = [];
  for (;;) {
    const events = await relay.query(filter);
    lastEvents = events;
    if (events.length >= minimum && predicate(events)) return events;
    if (Date.now() >= deadline) {
      throw new Error(
        `Relay state transition timed out: ${JSON.stringify(
          lastEvents.map((event) => ({
            kind: event.kind,
            createdAt: event.created_at,
            tags: event.tags,
            content: event.content,
          })),
        )}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
