import * as keytr from "@sovit.xyz/keytr";

import type { CommunityKeytrLibrary } from "../../src/auth/index.js";

/** Development/reference adapter. Published Community source never imports Keytr. */
export const communityKeytrLibrary: CommunityKeytrLibrary = {
  checkCapabilities: () => keytr.checkCapabilities(),
  setup: (options) => keytr.setup(options),
  addBackupGateway: (secret, options) =>
    keytr.addBackupGateway(secret, options),
  discoverPasskey: (options) => keytr.discoverPasskey(options),
  authenticatePasskey: (options) =>
    keytr.authenticatePasskey({
      credentialId: options.credentialId,
      rpId: options.rpId,
      ...(options.transports === undefined
        ? {}
        : { transports: [...options.transports] as AuthenticatorTransport[] }),
    }),
  fetchKeytrEvents: (pubkey, relayUrls) =>
    keytr.fetchKeytrEvents(pubkey, relayUrls),
  parseKeytrEvent: (event) => keytr.parseKeytrEvent(event),
  decryptNsec: (options) => keytr.decryptNsec(options),
  publishKeytrEvent: (event, relayUrls) =>
    keytr.publishKeytrEvent(event, relayUrls),
  signalUnknownCredential: (rpId, credentialId) =>
    keytr.signalUnknownCredential(rpId, credentialId),
};
