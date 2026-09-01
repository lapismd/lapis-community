import type {
  RegistryRelay,
  RelayPublishResult,
} from "@lapismd/registry-nostr";
import {
  createMembershipRegistrationTemplate,
  type MembershipKindMap,
  type NostrEvent,
} from "@lapismd/registry-protocol";

import type { RegistrySigner } from "./types.js";

export interface RelayRegistrationResult {
  event: NostrEvent;
  authentication: RelayPublishResult;
  publication: RelayPublishResult;
}

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

export async function registerRelayMember(options: {
  relay: RegistryRelay;
  signer: RegistrySigner;
  kinds: MembershipKindMap;
  createdAt?: number;
  signal?: AbortSignal;
}): Promise<RelayRegistrationResult> {
  const event = await options.signer.signEvent(
    createMembershipRegistrationTemplate(
      options.kinds,
      options.createdAt ?? Math.floor(Date.now() / 1_000),
    ),
  );
  const authentication = await authenticateRegistryRelay(
    options.relay,
    options.signer,
    options.signal,
  );
  const publication = await options.relay.publish(event, options.signal);
  return { event, authentication, publication };
}
