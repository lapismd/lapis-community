import { WebSocketRegistryRelay } from "@lapismd/registry-nostr";

import type { ConsoleConfig } from "./api.js";
import type { Nip07Provider, NostrEvent, NostrEventTemplate } from "./types.js";

function exactTemplate(
  requested: NostrEventTemplate,
  signed: NostrEvent,
): boolean {
  return (
    signed.kind === requested.kind &&
    signed.created_at === requested.created_at &&
    signed.content === requested.content &&
    JSON.stringify(signed.tags) === JSON.stringify(requested.tags)
  );
}

export function requireNip07(): Nip07Provider {
  if (window.nostr === undefined) {
    throw new Error("No NIP-07 signer extension is available in this browser");
  }
  return window.nostr;
}

export async function signExactTemplate(
  provider: Nip07Provider,
  template: NostrEventTemplate,
): Promise<NostrEvent> {
  const signed = await provider.signEvent(template);
  if (!exactTemplate(template, signed)) {
    throw new Error("Signer changed the requested event template");
  }
  return signed;
}

export async function publishSignedEvent(
  config: ConsoleConfig,
  provider: Nip07Provider,
  event: NostrEvent,
): Promise<{ accepted: number; total: number }> {
  const signerPubkey = await provider.getPublicKey();
  if (signerPubkey !== event.pubkey) {
    throw new Error("Connected signer does not match the event author");
  }
  const relays = config.buzzRelays.map(
    (url) => new WebSocketRegistryRelay(url, { authenticationRelayUrl: url }),
  );
  try {
    const attempts = await Promise.allSettled(
      relays.map(async (relay) => {
        await relay.authenticate(async (template) =>
          provider.signEvent(template),
        );
        return await relay.publish(event);
      }),
    );
    const accepted = attempts.filter(
      (attempt) => attempt.status === "fulfilled",
    ).length;
    if (accepted === 0) throw new Error("No Buzz relay accepted the event");
    return { accepted, total: attempts.length };
  } finally {
    for (const relay of relays) relay.close();
  }
}
