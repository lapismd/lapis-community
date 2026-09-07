<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, within } from "storybook/test";

  import type {
    RegistryCatalogDataSource,
    RegistryReleaseInspection,
    RegistryReleaseInspectionState,
    RegistryReleaseReviewEntry,
  } from "../../registry/index.js";
  import type { NostrEvent } from "../../protocol/index.js";
  import {
    createRegistryStoryDataSource,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import CommunityReleaseReviews from "./CommunityReleaseReviews.svelte";

  const resolved = registryStoryResolvedDetail();

  function releaseEvent(
    id: string,
    createdAt: number,
    pubkey: string,
  ): NostrEvent {
    return {
      id,
      pubkey,
      created_at: createdAt,
      kind: 9,
      tags: [],
      content: `${resolved.entry.name} release`,
      sig: `${id}-signature`,
    };
  }

  function reviewEntry(
    id: string,
    state: RegistryReleaseInspectionState,
    createdAt: number,
    pubkey = "lapis-publisher",
  ): RegistryReleaseReviewEntry {
    const inspection: RegistryReleaseInspection = {
      eventId: id,
      state,
      pluginId: resolved.entry.id,
      version: resolved.entry.latestVersion,
      diagnostics:
        state === "untrusted"
          ? [
              {
                stage: "authority",
                code: "untrusted-publisher",
                message: "Release signer is not a configured publisher.",
              },
            ]
          : [],
      ...(state === "untrusted" || state === "invalid"
        ? {}
        : { preview: { entry: resolved.entry, detail: resolved.detail } }),
    };
    return {
      releaseEvent: releaseEvent(id, createdAt, pubkey),
      inspection,
      curatorDecisionEvents:
        state === "approved"
          ? [releaseEvent(`${id}-decision`, createdAt + 1, "lapis-curator")]
          : [],
    };
  }

  const entries = [
    reviewEntry("pending-release", "pending", 1_700_000_040),
    reviewEntry("approved-release", "approved", 1_700_000_030),
    reviewEntry("rejected-release", "rejected", 1_700_000_020),
    reviewEntry("untrusted-release", "untrusted", 1_700_000_010, "unknown"),
  ];
  const inspectionById = new Map(
    entries.map((entry) => [entry.releaseEvent.id, entry.inspection]),
  );
  const source: RegistryCatalogDataSource = {
    ...createRegistryStoryDataSource(),
    async loadReleaseInspection(eventId) {
      return inspectionById.get(eventId);
    },
    async loadReleaseReviewEntries() {
      return entries;
    },
  };
  const unavailableSource = createRegistryStoryDataSource();

  const { Story } = defineMeta({
    title: "Community/Registry/Release Reviews",
    component: CommunityReleaseReviews,
    tags: ["visual-pending"],
    args: {
      entries,
      source,
      onOpenPlugin: fn(),
    },
    parameters: {
      layout: "padded",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityReleaseReviews entries={reviewEntries} source={registrySource} onOpenPlugin={openPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Review ledger"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Pending review" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Reviewed" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Blocked" }),
    ).toBeVisible();
    const pending = canvas.getByRole("article", {
      name: "AI Assistant Pending",
    });
    const approved = canvas.getByRole("article", {
      name: "AI Assistant Approved",
    });
    const untrusted = canvas.getByRole("article", {
      name: /Untrusted$/u,
    });
    await expect(within(pending).getAllByText("Pending")[0]).toBeVisible();
    await expect(within(approved).getAllByText("Approved")[0]).toBeVisible();
    await expect(within(untrusted).getAllByText("Untrusted")[0]).toBeVisible();
  }}
/>

<Story name="Loading" args={{ entries: [], loading: true }} />

<Story name="Empty" args={{ entries: [] }} />

<Story
  name="Unavailable source"
  args={{ entries: [], source: unavailableSource }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Reviews unavailable")).toBeVisible();
  }}
/>

<Story
  name="Dark narrow"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile2", isRotated: false },
  }}
/>
