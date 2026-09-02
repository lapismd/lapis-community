import type { RegistryRelay, RelayPublishResult } from "../nostr/index.js";

import type { RegistrySigner } from "./types.js";

export async function authenticateRegistryRelay(
  relay: RegistryRelay,
  signer: RegistrySigner,
  signal?: AbortSignal,
): Promise<RelayPublishResult> {
  if (relay.authenticate === undefined) {
    throw new Error(`${relay.url}: relay transport does not support NIP-42`);
  }
  return await relay.authenticate(
    async (template) => await signer.signEvent(template),
    signal,
  );
}
