<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import type {
    RegistryCatalogDataSource,
    RegistryReleaseInspection,
    RegistryReleaseInspectionState,
    RegistryReleaseReviewEntry,
  } from "../../registry/index.js";
  import type { NostrEvent } from "../../protocol/index.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
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
  const members: readonly CommunityMemberModel[] = [
    {
      id: "lapis-publisher",
      name: "Lapis Publisher",
      handle: "@lapis-publisher",
      initials: "LP",
      role: "Publisher",
    },
    {
      id: "unknown",
      name: "Unknown publisher",
      handle: "@unknown",
      initials: "UP",
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Registry/Release Reviews",
    component: CommunityReleaseReviews,
    tags: ["visual-pending"],
    args: {
      entries,
      source,
      members,
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
    const pendingToggle = canvas.getByRole("button", {
      name: /Pending review 1/u,
    });
    const reviewedToggle = canvas.getByRole("button", {
      name: /Reviewed 2/u,
    });
    const blockedToggle = canvas.getByRole("button", {
      name: /Blocked 1/u,
    });
    await expect(pendingToggle).toHaveAttribute("data-state", "on");
    await expect(reviewedToggle).toBeEnabled();
    await expect(blockedToggle).toBeEnabled();
    const pending = canvas.getByRole("article", {
      name: "AI Assistant Pending",
    });
    await expect(pending).toBeVisible();
    await expect(
      pending.querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();

    const approved = canvas.getByRole("article", {
      name: "AI Assistant Approved",
    });
    await expect(approved).toBeVisible();
    const untrusted = canvas.getByRole("article", { name: /Untrusted$/u });
    await expect(untrusted).toBeVisible();

    await userEvent.click(reviewedToggle);
    await expect(reviewedToggle).toHaveAttribute("data-state", "off");
    await expect(
      canvas.queryByRole("article", { name: "AI Assistant Approved" }),
    ).toBeNull();
    await expect(pending).toBeVisible();
    await expect(untrusted).toBeVisible();

    await userEvent.click(reviewedToggle);
    await expect(reviewedToggle).toHaveAttribute("data-state", "on");
    const restoredApproved = canvas.getByRole("article", {
      name: "AI Assistant Approved",
    });
    await expect(restoredApproved).toBeVisible();
    await expect(
      within(restoredApproved).getByText(/Posted by Lapis Publisher/u),
    ).toBeVisible();

    await userEvent.hover(restoredApproved);
    const pluginCard = await within(restoredApproved).findByRole("button", {
      name: /AI Assistant/u,
    });
    await userEvent.hover(pluginCard);
    await expect(pluginCard).toBeVisible();
    await expect(within(pluginCard).getByText("AI Assistant")).toBeVisible();
    const approvedStateBadge =
      within(restoredApproved).getAllByText("Approved")[0];
    await expect(approvedStateBadge).toHaveAttribute(
      "data-ui-component",
      "badge",
    );
    await expect(approvedStateBadge).toHaveAttribute(
      "data-ui-part",
      "community-chip",
    );

    await userEvent.click(blockedToggle);
    await expect(blockedToggle).toHaveAttribute("data-state", "off");
    await expect(
      canvas.queryByRole("article", { name: /Untrusted$/u }),
    ).toBeNull();
    await userEvent.click(blockedToggle);
    const restoredUntrusted = canvas.getByRole("article", {
      name: /Untrusted$/u,
    });
    await expect(restoredUntrusted).toBeVisible();
    const untrustedStateBadge =
      within(restoredUntrusted).getAllByText("Untrusted")[0];
    await expect(untrustedStateBadge).toBeVisible();
    await expect(untrustedStateBadge).toHaveAttribute(
      "data-ui-component",
      "badge",
    );
    await expect(untrustedStateBadge).toHaveAttribute(
      "data-ui-part",
      "community-chip",
    );
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
