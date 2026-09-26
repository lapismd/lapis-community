<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import {
    CommunityAssetRequestError,
    type CommunityAsset,
    type CommunityAssetManagement,
  } from "../../community/asset-management.js";
  import type { CommunitySettingsState } from "../../community/index.js";
  import * as media from "../community-chat-composer/story-fixtures.js";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";

  const avatarHash = "a".repeat(64);
  const emojiHash = "b".repeat(64);
  const avatarUrl = media.communityComposerStoryImage;

  const model: CommunitySettingsState = {
    identityConnected: true,
    profile: {
      pubkey: "c".repeat(64),
      displayName: "Steve",
      username: "steve",
      about: "",
      picture: avatarUrl,
    },
    customEmojis: [],
  };

  function asset(
    sha256: string,
    url: string,
    purpose: "avatar" | "emoji",
  ): CommunityAsset {
    return {
      url,
      sha256,
      size: purpose === "avatar" ? 42_100 : 19_200,
      type: "image/png",
      uploaded: 1_700_000_000,
      nip94: [
        ["url", url],
        ["x", sha256],
      ],
      lapis: { purpose: [purpose] },
    };
  }

  const history = {
    cursor: "1700000000:2",
    owner: model.profile.pubkey,
    sha256: avatarHash,
    action: "reference-added" as const,
    reference_type: "profile",
    reference_key: model.profile.pubkey,
    slot: "picture",
    source_event_id: "d".repeat(64),
    occurred_at: 1_700_000_000,
  };

  function loadedManagement(): CommunityAssetManagement {
    let deleteAttempts = 0;
    return {
      listAssets: async (purpose) => ({
        items: [
          purpose === "avatar"
            ? asset(avatarHash, avatarUrl, purpose)
            : asset(emojiHash, `${avatarUrl}#emoji`, purpose),
        ],
      }),
      listHistory: async () => ({ items: [history] }),
      listReports: async () => {
        throw new CommunityAssetRequestError(403, "report review forbidden");
      },
      deleteAsset: async () => {
        deleteAttempts += 1;
        if (deleteAttempts === 1)
          throw new CommunityAssetRequestError(
            409,
            "asset is retained by an active registry reference",
          );
      },
    };
  }

  const emptyManagement: CommunityAssetManagement = {
    listAssets: async () => ({ items: [] }),
    listHistory: async () => ({ items: [] }),
    listReports: async () => ({ items: [] }),
    deleteAsset: async () => {},
  };

  const never = new Promise<never>(() => {});
  const loadingManagement: CommunityAssetManagement = {
    listAssets: async () => never,
    listHistory: async () => never,
    listReports: async () => never,
    deleteAsset: async () => never,
  };

  function retryManagement(): CommunityAssetManagement {
    let fail = true;
    return {
      ...emptyManagement,
      listAssets: async () => {
        if (fail) {
          fail = false;
          throw new Error("Relay media is temporarily unavailable.");
        }
        return { items: [] };
      },
    };
  }

  function refreshManagement(): CommunityAssetManagement {
    let assetCalls = 0;
    let historyCalls = 0;
    return {
      ...emptyManagement,
      listAssets: async (purpose) => {
        assetCalls += 1;
        if (assetCalls > 2) return never;
        return {
          items: [
            purpose === "avatar"
              ? asset(avatarHash, avatarUrl, purpose)
              : asset(emojiHash, `${avatarUrl}#emoji`, purpose),
          ],
        };
      },
      listHistory: async () => {
        historyCalls += 1;
        return historyCalls > 1 ? never : { items: [history] };
      },
    };
  }

  const { Story } = defineMeta({
    title: "Community/Navigation/Settings/Media",
    component: CommunitySettings,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunitySettings
  model={community.state.settings}
  section="media"
  assetManagement={assetManagement}
  onUpdateProfile={updateProfile}
  onAddCustomEmoji={saveEmoji}
  onRemoveCustomEmoji={removeEmoji}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Owned media and lifecycle"
  play={async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Media" });
    await expect(await canvas.findAllByText(avatarHash)).not.toHaveLength(0);
    await expect(canvas.getByText("In use")).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: "Delete" }),
    ).toHaveLength(1);

    await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
    const dialog = await within(document.body).findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete asset" }),
    );
    await within(dialog).findByText(
      "asset is retained by an active registry reference",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete asset" }),
    );
    await waitFor(() => expect(canvas.queryByText(emojiHash)).toBeNull());
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Asset deleted from the relay.",
    );
    await waitFor(() =>
      expect(
        document.body.querySelector('[data-ui-part="alert-dialog-overlay"]'),
      ).toBeNull(),
    );
    const loadReports = canvas.getByRole("button", { name: "Load reports" });
    await waitFor(() =>
      expect(getComputedStyle(loadReports).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(loadReports);
    await canvas.findByText(
      "Manager access is required to review the report queue.",
    );
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="media"
      assetManagement={loadedManagement()}
      onUpdateProfile={async () => {}}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Initial loading"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole("status", { name: "Loading relay media" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="media"
      assetManagement={loadingManagement}
      onUpdateProfile={async () => {}}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Empty media"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByText("No avatar or emoji uploads found."),
    ).toBeVisible();
    await expect(canvas.getByText("No lifecycle activity yet.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Load reports" }));
    await expect(
      await canvas.findByText("No asset reports are waiting."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="media"
      assetManagement={emptyManagement}
      onUpdateProfile={async () => {}}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Content-preserving refresh"
  play={async ({ canvas }) => {
    await expect(await canvas.findAllByText(avatarHash)).not.toHaveLength(0);
    const refresh = canvas.getByRole("button", { name: "Refresh" });
    await userEvent.click(refresh);
    await waitFor(() => expect(refresh).toHaveAttribute("aria-busy", "true"));
    await expect(canvas.getAllByText(avatarHash)).not.toHaveLength(0);
    await expect(canvas.queryByLabelText("Loading relay media")).toBeNull();
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="media"
      assetManagement={refreshManagement()}
      onUpdateProfile={async () => {}}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Retry relay error"
  play={async ({ canvas }) => {
    await canvas.findByText("Relay media is temporarily unavailable.");
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(
      await canvas.findByText("No avatar or emoji uploads found."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="media"
      assetManagement={retryManagement()}
      onUpdateProfile={async () => {}}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>
