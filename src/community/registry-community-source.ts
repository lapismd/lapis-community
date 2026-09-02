import type { CommunityRelay } from "../nostr/index.js";

import type { CommunityDataSource } from "./contracts.js";
import {
  createNip29CommunitySource,
  type Nip29CommunitySourceOptions,
} from "./nip29-community-source.js";

export type RegistryCommunityDataSourceOptions = Nip29CommunitySourceOptions;

/**
 * Community source used by the registry composition root.
 *
 * The normal `CommunityDataSource` session is available to consumers that need
 * the unified workspace projection. RegistryCommunity also uses `relay()` for
 * its bounded, count-backed discussion window without taking ownership of a
 * concrete WebSocket implementation.
 */
export interface RegistryCommunityDataSource extends CommunityDataSource {
  relay(url: string): CommunityRelay;
  close(): void;
}

export function createRegistryCommunityDataSource(
  options: RegistryCommunityDataSourceOptions,
): RegistryCommunityDataSource {
  const source = createNip29CommunitySource(options);
  const relays = new Map<string, CommunityRelay>();

  return {
    open: source.open,
    relay(url) {
      const current = relays.get(url);
      if (current !== undefined) return current;
      const created = options.relayFactory.create(url);
      relays.set(url, created);
      return created;
    },
    close() {
      for (const relay of relays.values()) relay.close();
      relays.clear();
    },
  };
}
