import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";

import {
  createIndexedDbRegistrySnapshotStore,
  createMemoryRegistrySnapshotStore,
  type RegistrySnapshotStore,
} from "./snapshot-store.js";

describe.each([
  ["memory", () => createMemoryRegistrySnapshotStore()],
  [
    "indexeddb",
    () =>
      createIndexedDbRegistrySnapshotStore({
        databaseName: `lapis-registry-test-${crypto.randomUUID()}`,
      }),
  ],
] as const)("%s registry snapshot store", (_name, createStore) => {
  it("round-trips raw snapshot inputs and verified resources", async () => {
    const store: RegistrySnapshotStore = createStore();
    await store.open();
    await store.saveSnapshot({
      schemaVersion: 1,
      key: "trusted-snapshot",
      synchronizedAt: "2026-09-03T12:00:00.000Z",
      events: [],
      manifests: [
        {
          attachmentSha256: "a".repeat(64),
          bytes: new Uint8Array([1, 2, 3]),
        },
      ],
    });
    await store.saveResource({
      sha256: "b".repeat(64),
      mediaType: "image/webp",
      bytes: new Uint8Array([4, 5, 6]),
      lastAccessedAt: 1,
    });

    await expect(store.loadSnapshot("trusted-snapshot")).resolves.toMatchObject(
      {
        schemaVersion: 1,
        manifests: [{ attachmentSha256: "a".repeat(64) }],
      },
    );
    expect((await store.loadResource("b".repeat(64)))?.bytes).toEqual(
      new Uint8Array([4, 5, 6]),
    );
    await store.close();
  });
});

it("prunes least-recently-used resources without removing event snapshots", async () => {
  const store = createMemoryRegistrySnapshotStore({ maxResourceBytes: 4 });
  await store.open();
  await store.saveSnapshot({
    schemaVersion: 1,
    key: "snapshot",
    synchronizedAt: "2026-09-03T12:00:00.000Z",
    events: [],
    manifests: [],
  });
  await store.saveResource({
    sha256: "a".repeat(64),
    mediaType: "image/webp",
    bytes: new Uint8Array([1, 2, 3]),
    lastAccessedAt: 1,
  });
  await store.saveResource({
    sha256: "b".repeat(64),
    mediaType: "image/webp",
    bytes: new Uint8Array([4, 5, 6]),
    lastAccessedAt: 2,
  });

  await expect(store.loadResource("a".repeat(64))).resolves.toBeUndefined();
  await expect(store.loadResource("b".repeat(64))).resolves.toBeDefined();
  await expect(store.loadSnapshot("snapshot")).resolves.toBeDefined();
  await store.close();
});

it("bounds old trust partitions without pruning the newest snapshot", async () => {
  const store = createMemoryRegistrySnapshotStore({ maxSnapshots: 2 });
  await store.open();
  for (const [index, key] of ["old", "middle", "new"].entries()) {
    await store.saveSnapshot({
      schemaVersion: 1,
      key,
      synchronizedAt: `2026-09-03T12:0${index}:00.000Z`,
      events: [],
      manifests: [],
    });
  }

  await expect(store.loadSnapshot("old")).resolves.toBeUndefined();
  await expect(store.loadSnapshot("middle")).resolves.toBeDefined();
  await expect(store.loadSnapshot("new")).resolves.toBeDefined();
  await store.close();
});
