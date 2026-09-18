import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";
import { generateSecretKey } from "nostr-tools/pure";

import {
  Nip07RegistrySigner,
  SecretKeyRegistrySigner,
  type CommunityKeytrLoginIntegration,
  type RelayIdentityConnectContext,
} from "../../src/auth/index.js";
import type { CommunityIdentity } from "../../src/community/index.js";
import {
  COMMUNITY_LOGIN_METHODS,
  type CommunityLoginCredentials,
} from "../../src/components/community-login/model.js";
import {
  decodeCommunityDevPrivateKey,
  persistCommunityDevPrivateKey,
} from "./private-key-session.js";

export function createCommunityDevIdentityConnector(options: {
  keytrIntegration?: CommunityKeytrLoginIntegration;
}): {
  connect: (
    methodId: string,
    credentials?: CommunityLoginCredentials,
    context?: RelayIdentityConnectContext,
  ) => Promise<CommunityIdentity>;
  dispose: () => Promise<void>;
} {
  let activeBunker: BunkerSigner | undefined;
  const keytrIntegration = options.keytrIntegration;

  async function remoteIdentity(
    value: string | undefined,
  ): Promise<CommunityIdentity> {
    const input = value?.trim() ?? "";
    if (input === "") {
      throw new Error("Paste a bunker URL before using Remote signer");
    }
    const pointer = await parseBunkerInput(input);
    if (pointer === null) throw new Error("The remote signer URL is invalid");
    await activeBunker?.close();
    const bunker = BunkerSigner.fromBunker(generateSecretKey(), pointer, {
      onauth: (url) => void window.open(url, "_blank", "noopener,noreferrer"),
    });
    await bunker.connect({ name: "Lapis Community Dev", url: location.origin });
    activeBunker = bunker;
    return {
      getPublicKey: () => bunker.getPublicKey(),
      signEvent: (template) => bunker.signEvent(template),
      nip44: {
        encrypt: (pubkey, plaintext) => bunker.nip44Encrypt(pubkey, plaintext),
        decrypt: (pubkey, ciphertext) =>
          bunker.nip44Decrypt(pubkey, ciphertext),
      },
    };
  }

  return {
    async connect(methodId, credentials, context) {
      let identity: CommunityIdentity;
      if (methodId === keytrIntegration?.method.id) {
        identity = await keytrIntegration.connect(
          methodId,
          credentials,
          context,
        );
      } else if (methodId === COMMUNITY_LOGIN_METHODS.browserExtension.id) {
        const extension = new Nip07RegistrySigner();
        await extension.getPublicKey();
        return extension;
      } else if (methodId === COMMUNITY_LOGIN_METHODS.remoteSigner.id) {
        identity = await remoteIdentity(credentials?.remoteSignerUrl);
      } else if (methodId === COMMUNITY_LOGIN_METHODS.createAccount.id) {
        identity = new SecretKeyRegistrySigner(generateSecretKey());
      } else if (methodId === COMMUNITY_LOGIN_METHODS.privateKey.id) {
        if (credentials?.privateKey === undefined) {
          throw new Error("Private key is required");
        }
        persistCommunityDevPrivateKey(credentials.privateKey);
        identity = new SecretKeyRegistrySigner(
          decodeCommunityDevPrivateKey(credentials.privateKey),
        );
      } else {
        throw new Error(`Unknown login method: ${methodId}`);
      }
      return identity;
    },
    async dispose() {
      await activeBunker?.close();
      activeBunker = undefined;
    },
  };
}
