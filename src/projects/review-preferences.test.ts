import { describe, expect, it } from "vitest";

import type { ProjectForgeCatalogStorage } from "./catalog-store.js";
import {
  createBrowserProjectReviewPreferenceStore,
  projectReviewDiffViewModeKey,
  projectReviewViewedFilesKey,
  type ProjectReviewPreferenceScope,
  type ProjectReviewViewedFilesScope,
} from "./review-preferences.js";

function memoryStorage(): ProjectForgeCatalogStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const scope: ProjectReviewPreferenceScope = {
  relayUrl: "wss://relay.example.com",
  communityId: "community",
  memberId: "a".repeat(64),
};
const viewedScope: ProjectReviewViewedFilesScope = {
  ...scope,
  repository: `30617:${"b".repeat(64)}:community`,
  pullRequestId: "c".repeat(64),
  base: "d".repeat(40),
  head: "e".repeat(40),
};

describe("project review preferences", () => {
  it("keeps diff mode at member scope and viewed files at revision scope", () => {
    const storage = memoryStorage();
    const store = createBrowserProjectReviewPreferenceStore({ storage });

    store.saveDiffViewMode(scope, "split");
    store.saveViewedFiles(viewedScope, ["src/a.ts", "src/a.ts", "README.md"]);

    expect(store.loadDiffViewMode(scope)).toBe("split");
    expect(store.loadViewedFiles(viewedScope)).toEqual([
      "src/a.ts",
      "README.md",
    ]);
    expect(
      store.loadViewedFiles({ ...viewedScope, head: "f".repeat(40) }),
    ).toEqual([]);
    expect(projectReviewDiffViewModeKey(scope)).not.toBe(
      projectReviewViewedFilesKey(viewedScope),
    );
  });

  it("ignores malformed and stale values without throwing", () => {
    const storage = memoryStorage();
    const store = createBrowserProjectReviewPreferenceStore({ storage });
    storage.setItem(projectReviewDiffViewModeKey(scope), "not-json");
    storage.setItem(
      projectReviewViewedFilesKey(viewedScope),
      JSON.stringify({ version: 0, value: ["src/a.ts"] }),
    );

    expect(store.loadDiffViewMode(scope)).toBeUndefined();
    expect(store.loadViewedFiles(viewedScope)).toEqual([]);
  });

  it("normalizes equivalent relay URLs in storage keys", () => {
    expect(projectReviewDiffViewModeKey(scope)).toBe(
      projectReviewDiffViewModeKey({
        ...scope,
        relayUrl: "wss://relay.example.com/",
      }),
    );
  });
});
