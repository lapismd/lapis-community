import {
  authenticateRegistryRelay,
  type RegistrySigner,
} from "../auth/index.js";
import type {
  CommunityRelay,
  CommunityRelaySubscription,
} from "../nostr/index.js";
import {
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_REGISTRY_HEAD_TOPIC,
  LAPIS_RELEASE_TOPIC,
  NIP29_KINDS,
  type NostrEvent,
} from "../protocol/index.js";

export async function subscribeRegistryCatalogRelays(options: {
  relays: readonly CommunityRelay[];
  readerSigner: RegistrySigner;
  signal: AbortSignal;
  releaseGroupId: string;
  subscriptions: Set<CommunityRelaySubscription>;
  onEvent(event: NostrEvent): void;
}): Promise<void> {
  await Promise.allSettled(
    options.relays.map(async (relay) => {
      await authenticateRegistryRelay(
        relay,
        options.readerSigner,
        options.signal,
      );
      const handlers = {
        onevent(event: NostrEvent) {
          options.onEvent(event);
        },
      };
      const [releaseSubscription, decisionSubscription] = await Promise.all([
        relay.subscribe(
          {
            kinds: [NIP29_KINDS.streamMessage],
            "#h": [options.releaseGroupId],
            "#t": [
              LAPIS_RELEASE_TOPIC,
              LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
              LAPIS_REGISTRY_HEAD_TOPIC,
            ],
          },
          handlers,
          options.signal,
        ),
        relay.subscribe(
          {
            kinds: [NIP29_KINDS.reaction],
            "#h": [options.releaseGroupId],
          },
          handlers,
          options.signal,
        ),
      ]);
      options.subscriptions.add(releaseSubscription);
      options.subscriptions.add(decisionSubscription);
    }),
  );
}
