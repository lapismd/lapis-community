import { hexToBytes } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";

import type {
  RelayAuthConnectResult,
  RelayAuthRestoreResult,
} from "../../src/auth/index.js";
import type {
  CommunityController,
  CommunityIdentity,
} from "../../src/community/index.js";
import {
  COMMUNITY_LOGIN_METHODS,
  type CommunityLoginCredentials,
} from "../../src/components/community-login/model.js";

export const COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY =
  "lapismd.community.dev.v1.private-key";

export const COMMUNITY_DEV_PRIVATE_KEY_TOAST_ID =
  "community-dev-private-key-session";

export type CommunityDevPrivateKeyStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function decodeCommunityDevPrivateKey(value: string): Uint8Array {
  const normalized = value.trim();
  if (/^[0-9a-f]{64}$/iu.test(normalized)) return hexToBytes(normalized);
  if (normalized.startsWith("nsec1")) {
    try {
      const decoded = nip19.decode(normalized);
      if (decoded.type === "nsec" && decoded.data instanceof Uint8Array) {
        return decoded.data;
      }
    } catch {
      // Fall through to the shared validation error.
    }
  }
  throw new Error("Use an nsec or a 64-character hexadecimal private key");
}

export function readCommunityDevPrivateKey(
  storage: CommunityDevPrivateKeyStorage | undefined = defaultStorage(),
): string | undefined {
  const value = storage?.getItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY)?.trim();
  if (!value) return undefined;
  try {
    decodeCommunityDevPrivateKey(value);
    return value;
  } catch {
    storage?.removeItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY);
    return undefined;
  }
}

export function persistCommunityDevPrivateKey(
  value: string,
  storage: CommunityDevPrivateKeyStorage | undefined = defaultStorage(),
): void {
  const normalized = value.trim();
  decodeCommunityDevPrivateKey(normalized);
  storage?.setItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY, normalized);
}

export function forgetCommunityDevPrivateKey(
  storage: CommunityDevPrivateKeyStorage | undefined = defaultStorage(),
): void {
  storage?.removeItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY);
}

export async function restoreCommunityDevPrivateKeyIdentity(
  controller: CommunityController,
  connect: (
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ) => Promise<CommunityIdentity>,
  storage?: CommunityDevPrivateKeyStorage,
): Promise<CommunityIdentity | undefined> {
  const privateKey = readCommunityDevPrivateKey(storage);
  if (privateKey === undefined) return undefined;
  const identity = await connect(COMMUNITY_LOGIN_METHODS.privateKey.id, {
    privateKey,
  });
  await controller.actions.connectIdentity({ connect: async () => identity });
  return identity;
}

export function attachCommunityDevPrivateKeyAuthRestore(
  auth: {
    restore: () => Promise<RelayAuthRestoreResult>;
    connect: (
      methodId: string,
      credentials?: CommunityLoginCredentials,
    ) => Promise<RelayAuthConnectResult>;
  },
  storage?: CommunityDevPrivateKeyStorage,
): void {
  const restore = auth.restore.bind(auth);
  const connect = auth.connect.bind(auth);
  auth.restore = async () => {
    const result = await restore();
    const privateKey = readCommunityDevPrivateKey(storage);
    if (privateKey === undefined || result.status === "connected") {
      return result;
    }
    try {
      return await connect(COMMUNITY_LOGIN_METHODS.privateKey.id, {
        privateKey,
      });
    } catch {
      return result;
    }
  };
}

function defaultStorage(): CommunityDevPrivateKeyStorage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}
