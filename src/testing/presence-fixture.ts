import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type { NostrEvent } from "../protocol/index.js";
import type { InMemoryRelayPolicy } from "./in-memory-community-relay.js";

/** Single-connection fixture exercising the production presence transport. */
export function createPresenceFixture(secret: Uint8Array) {
  const accounts = new Map<
    string,
    { status: string; mode: string; revision: number; expiry: number }
  >();
  const now = () => Math.floor(Date.now() / 1000);
  const eventFor = (pubkey: string) => {
    const account = accounts.get(pubkey);
    const status =
      account && account.expiry > now() && account.mode !== "offline"
        ? account.mode === "away"
          ? "away"
          : account.status
        : "offline";
    return finalizeEvent(
      {
        kind: 20001,
        created_at: now(),
        content: status,
        tags: [
          ["p", pubkey],
          ["presence-mode", account?.mode ?? "auto"],
          ["presence-revision", String(account?.revision ?? 0)],
          [
            "expiration",
            String(
              account && account.expiry > now() ? account.expiry : now() + 180,
            ),
          ],
        ],
      },
      secret,
    );
  };
  const policy: InMemoryRelayPolicy = {
    process(event: NostrEvent) {
      if (event.kind !== 20001) return;
      const old = accounts.get(event.pubkey);
      accounts.set(event.pubkey, {
        status: event.content,
        mode:
          event.tags.find((tag) => tag[0] === "presence-mode")?.[1] ??
          old?.mode ??
          "auto",
        revision: (old?.revision ?? 0) + 1,
        expiry: now() + 180,
      });
      return { generatedEvents: [eventFor(event.pubkey)] };
    },
  };
  const fetcher: typeof globalThis.fetch = async (_input, init) => {
    if (!init?.body)
      return Response.json({
        self: getPublicKey(secret),
        lapis_presence: { version: 1 },
      });
    const filters = JSON.parse(String(init.body)) as { authors: string[] }[];
    return Response.json(
      filters.flatMap((filter) => filter.authors.map(eventFor)),
    );
  };
  return { policy, fetch: fetcher };
}
