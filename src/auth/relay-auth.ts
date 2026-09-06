import type {
  RegistryRelay,
  RelayAuthSigner,
  RelayPublishResult,
} from "../nostr/index.js";

import type { RegistrySigner } from "./types.js";

const relayAuthSigners = new WeakMap<RegistrySigner, RelayAuthSigner>();

function relayAuthSigner(signer: RegistrySigner): RelayAuthSigner {
  const current = relayAuthSigners.get(signer);
  if (current !== undefined) return current;
  const created: RelayAuthSigner = async (template) =>
    await signer.signEvent(template);
  relayAuthSigners.set(signer, created);
  return created;
}

export async function authenticateRegistryRelay(
  relay: RegistryRelay,
  signer: RegistrySigner,
  signal?: AbortSignal,
): Promise<RelayPublishResult> {
  if (relay.authenticate === undefined) {
    throw new Error(`${relay.url}: relay transport does not support NIP-42`);
  }
  return await relay.authenticate(relayAuthSigner(signer), signal);
}
