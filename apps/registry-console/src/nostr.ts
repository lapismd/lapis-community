import {
  createLiveSnapshotTemplate,
  publishWithQuorum,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";

import { registryAuthorities } from "./api.js";
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
): Promise<{ accepted: number; required: number; total: number }> {
  const signerPubkey = await provider.getPublicKey();
  if (signerPubkey !== event.pubkey) {
    throw new Error("Connected signer does not match the event author");
  }
  const relays = config.officialRelays.map(
    (url) => new WebSocketRegistryRelay(url),
  );
  try {
    const result = await publishWithQuorum(event, relays, config.publishQuorum);
    return {
      accepted: result.accepted,
      required: result.required,
      total: result.attempts.length,
    };
  } finally {
    for (const relay of relays) relay.close();
  }
}

export async function loadLiveSnapshotTemplate(
  config: ConsoleConfig,
): Promise<NostrEventTemplate> {
  const relays = config.officialRelays.map(
    (url) => new WebSocketRegistryRelay(url),
  );
  try {
    const result = await createLiveSnapshotTemplate(
      relays,
      config.kinds,
      registryAuthorities(config),
      Math.floor(Date.now() / 1_000),
    );
    return result.template as NostrEventTemplate;
  } finally {
    for (const relay of relays) relay.close();
  }
}
