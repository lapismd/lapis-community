import { Nip07RegistrySigner } from "../auth/index.js";
import type { Nip07Provider } from "../auth/index.js";

import type { CommunityIdentityConnector } from "./contracts.js";

export interface Nip07CommunityIdentityConnectorOptions {
  provider?: Nip07Provider;
}

export function createNip07CommunityIdentityConnector(
  options: Nip07CommunityIdentityConnectorOptions = {},
): CommunityIdentityConnector {
  return {
    async connect() {
      const identity = new Nip07RegistrySigner(options.provider);
      await identity.getPublicKey();
      return identity;
    },
  };
}
