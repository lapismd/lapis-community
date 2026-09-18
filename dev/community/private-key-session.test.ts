import { bytesToHex } from "@noble/hashes/utils.js";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { COMMUNITY_LOGIN_METHODS } from "../../src/components/community-login/model.js";
import type { CommunityController } from "../../src/community/index.js";
import {
  attachCommunityDevPrivateKeyAuthRestore,
  COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY,
  decodeCommunityDevPrivateKey,
  forgetCommunityDevPrivateKey,
  persistCommunityDevPrivateKey,
  readCommunityDevPrivateKey,
  restoreCommunityDevPrivateKeyIdentity,
  type CommunityDevPrivateKeyStorage,
} from "./private-key-session.js";

function memoryStorage(
  initial: Record<string, string> = {},
): CommunityDevPrivateKeyStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("community Vite private-key session", () => {
  const secret = generateSecretKey();
  const nsec = nip19.nsecEncode(secret);
  const hex = bytesToHex(secret);

  it("decodes nsec and hexadecimal secrets", () => {
    expect(decodeCommunityDevPrivateKey(nsec)).toEqual(secret);
    expect(decodeCommunityDevPrivateKey(hex)).toEqual(secret);
    expect(() => decodeCommunityDevPrivateKey("not-a-key")).toThrow(
      /nsec or a 64-character hexadecimal private key/u,
    );
  });

  it("persists a valid pasted secret and forgets it", () => {
    const storage = memoryStorage();
    persistCommunityDevPrivateKey(` ${nsec} `, storage);
    expect(storage.getItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY)).toBe(nsec);
    expect(readCommunityDevPrivateKey(storage)).toBe(nsec);
    forgetCommunityDevPrivateKey(storage);
    expect(readCommunityDevPrivateKey(storage)).toBeUndefined();
  });

  it("rejects invalid secrets and clears a corrupt stored value", () => {
    const storage = memoryStorage();
    expect(() => persistCommunityDevPrivateKey("nsec1nope", storage)).toThrow(
      /nsec or a 64-character hexadecimal private key/u,
    );
    expect(storage.getItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY)).toBeNull();
    storage.setItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY, "corrupt");
    expect(readCommunityDevPrivateKey(storage)).toBeUndefined();
    expect(storage.getItem(COMMUNITY_DEV_PRIVATE_KEY_STORAGE_KEY)).toBeNull();
  });

  it("restores a persisted key through the host connector", async () => {
    const storage = memoryStorage();
    persistCommunityDevPrivateKey(hex, storage);
    const identity = { id: "restored" };
    const connect = vi.fn(async () => identity);
    const controller = {
      actions: {
        connectIdentity: vi.fn(async () => undefined),
      },
    } as unknown as CommunityController;
    await expect(
      restoreCommunityDevPrivateKeyIdentity(controller, connect, storage),
    ).resolves.toBe(identity);
    expect(connect).toHaveBeenCalledWith(
      COMMUNITY_LOGIN_METHODS.privateKey.id,
      {
        privateKey: hex,
      },
    );
    expect(controller.actions.connectIdentity).toHaveBeenCalledTimes(1);
  });

  it("reconnects an anonymous or reconnect-required auth restore", async () => {
    const storage = memoryStorage();
    persistCommunityDevPrivateKey(nsec, storage);
    const connected = { status: "connected" as const };
    const auth = {
      restore: vi.fn(async () => ({ status: "anonymous" as const })),
      connect: vi.fn(async () => connected),
    };
    attachCommunityDevPrivateKeyAuthRestore(auth, storage);
    await expect(auth.restore()).resolves.toBe(connected);
    expect(auth.connect).toHaveBeenCalledWith(
      COMMUNITY_LOGIN_METHODS.privateKey.id,
      { privateKey: nsec },
    );
  });

  it("leaves an already connected auth restore untouched", async () => {
    const storage = memoryStorage();
    persistCommunityDevPrivateKey(nsec, storage);
    const connected = { status: "connected" as const };
    const auth = {
      restore: vi.fn(async () => connected),
      connect: vi.fn(),
    };
    attachCommunityDevPrivateKeyAuthRestore(auth, storage);
    await expect(auth.restore()).resolves.toBe(connected);
    expect(auth.connect).not.toHaveBeenCalled();
  });
});
