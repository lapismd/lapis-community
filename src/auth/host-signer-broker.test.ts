import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import {
  HostOwnedNostrSignerBroker,
  type ConnectedNip46Signer,
  type HostNostrNip46Factory,
  type HostNostrSignerAccount,
  type HostNostrSignerAccountStore,
  type HostNostrSignerCredentialStore,
  type HostNostrSignerPermissionRequest,
} from "./host-signer-broker.js";
import { SecretKeyRegistrySigner } from "./signer.js";

describe("host-owned Nostr signer broker", () => {
  it("creates a local identity while keeping its key behind the credential store", async () => {
    const fixture = createBrokerFixture();
    const context = { pluginId: "community" };
    const account = await fixture.broker.requestProfileCreation(context, {
      displayName: "Alice",
    });

    expect(account).toEqual({
      id: "account-1",
      label: "Alice",
      pubkey: expect.stringMatching(/^[0-9a-f]{64}$/),
      kind: "local",
    });
    expect(JSON.stringify(account)).not.toContain("secretKey");
    expect(fixture.credentials.values.get(account.id)).toMatch(
      /"kind":"local","secretKeyHex":"[0-9a-f]{64}"/,
    );
    await expect(fixture.broker.listAccounts(context)).resolves.toEqual([
      account,
    ]);

    const template = {
      kind: 0,
      created_at: 1_800_000_000,
      tags: [] as string[][],
      content: JSON.stringify({ display_name: "Alice" }),
    };
    await expect(
      fixture.broker.signEvent(context, account.id, template),
    ).resolves.toMatchObject({ ...template, pubkey: account.pubkey });
  });

  it("uses keychain-backed NIP-46 client credentials and reconnects on demand", async () => {
    const remoteSecret = generateSecretKey();
    const close = vi.fn(async () => undefined);
    const factory: HostNostrNip46Factory = {
      connect: vi.fn(async () => createRemoteSigner(remoteSecret, close)),
    };
    const fixture = createBrokerFixture({ nip46: factory });
    const context = { pluginId: "community" };
    const account = await fixture.broker.connectRemoteSigner(context, {
      bunkerUrl: `bunker://${"b".repeat(64)}?relay=wss%3A%2F%2Frelay.example&secret=invite`,
      label: "Amber",
    });

    expect(account).toMatchObject({
      id: "account-1",
      label: "Amber",
      pubkey: getPublicKey(remoteSecret),
      kind: "nip46",
    });
    const stored = fixture.credentials.values.get(account.id)!;
    expect(stored).toContain('"kind":"nip46"');
    expect(stored).toContain('"clientSecretKeyHex":"');
    expect(JSON.stringify(account)).not.toContain("bunker://");

    await fixture.broker.close(context, account.id);
    expect(close).toHaveBeenCalledOnce();
    await expect(
      fixture.broker.signEvent(context, account.id, {
        kind: 1,
        created_at: 1_800_000_001,
        tags: [],
        content: "Signed remotely",
      }),
    ).resolves.toMatchObject({ pubkey: account.pubkey });
    expect(factory.connect).toHaveBeenCalledTimes(2);
  });

  it("checks plugin permission before generating or loading credentials", async () => {
    const permissions: HostNostrSignerPermissionRequest[] = [];
    const fixture = createBrokerFixture({
      authorize: async (request) => {
        permissions.push(request);
        return false;
      },
    });

    await expect(
      fixture.broker.requestProfileCreation(
        { pluginId: "untrusted-plugin" },
        { displayName: "Blocked" },
      ),
    ).rejects.toThrow("permission denied");
    expect(fixture.credentials.values.size).toBe(0);
    expect(fixture.accounts.values.size).toBe(0);
    expect(permissions).toEqual([
      { pluginId: "untrusted-plugin", action: "create-profile" },
    ]);
  });

  it("rejects a remote signer that changes the requested event", async () => {
    const secret = generateSecretKey();
    const fixture = createBrokerFixture({
      nip46: {
        connect: async () => ({
          ...createRemoteSigner(secret, async () => undefined),
          signEvent: async (event) =>
            finalizeEvent({ ...event, content: "changed" }, secret),
        }),
      },
    });
    const context = { pluginId: "community" };
    const account = await fixture.broker.connectRemoteSigner(context, {
      bunkerUrl: `bunker://${"b".repeat(64)}?relay=wss%3A%2F%2Frelay.example`,
    });

    await expect(
      fixture.broker.signEvent(context, account.id, {
        kind: 1,
        created_at: 1,
        tags: [],
        content: "original",
      }),
    ).rejects.toThrow("invalid or changed event");
  });
});

const createBrokerFixture = (
  overrides: {
    authorize?: (request: HostNostrSignerPermissionRequest) => Promise<boolean>;
    nip46?: HostNostrNip46Factory;
  } = {},
) => {
  const accounts = new MemoryAccountStore();
  const credentials = new MemoryCredentialStore();
  const broker = new HostOwnedNostrSignerBroker({
    accounts,
    credentials,
    authorize: overrides.authorize ?? (async () => true),
    ...(overrides.nip46 ? { nip46: overrides.nip46 } : {}),
    randomId: () => "account-1",
  });
  return { accounts, broker, credentials };
};

const createRemoteSigner = (
  secret: Uint8Array,
  close: () => Promise<void>,
): ConnectedNip46Signer => {
  const signer = new SecretKeyRegistrySigner(secret);
  return {
    getPublicKey: () => signer.getPublicKey(),
    signEvent: (event) => signer.signEvent(event),
    nip44: signer.nip44,
    close,
  };
};

class MemoryAccountStore implements HostNostrSignerAccountStore {
  readonly values = new Map<string, HostNostrSignerAccount>();

  async list(): Promise<HostNostrSignerAccount[]> {
    return [...this.values.values()];
  }

  async get(accountId: string): Promise<HostNostrSignerAccount | null> {
    return this.values.get(accountId) ?? null;
  }

  async put(account: HostNostrSignerAccount): Promise<void> {
    this.values.set(account.id, { ...account });
  }
}

class MemoryCredentialStore implements HostNostrSignerCredentialStore {
  readonly values = new Map<string, string>();

  async get(accountId: string): Promise<string | null> {
    return this.values.get(accountId) ?? null;
  }

  async put(accountId: string, credential: string): Promise<void> {
    this.values.set(accountId, credential);
  }

  async delete(accountId: string): Promise<void> {
    this.values.delete(accountId);
  }
}
