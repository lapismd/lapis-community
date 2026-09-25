<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import type { CommunitySettingsState } from "../../community/index.js";

  import CommunitySettings from "./CommunitySettings.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Settings/Media upload",
    component: CommunitySettings,
    tags: ["visual-pending"],
  });

  const model: CommunitySettingsState = {
    identityConnected: true,
    profile: {
      pubkey: "b".repeat(64),
      displayName: "Steve",
      username: "steve",
      about: "",
      picture: "",
    },
    customEmojis: [],
  };
</script>

<Story
  name="Custom emoji media upload"
  play={async ({ canvas, canvasElement }) => {
    await canvas.findByRole("heading", { name: "Custom emoji" });
    await userEvent.upload(
      canvas.getByLabelText("Upload custom emoji image"),
      new File([new Uint8Array(1024 * 1024 + 1)], "party-parrot.png", {
        type: "image/png",
      }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByText("Choose an image smaller than 1 MB."),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvas.getByRole("status")).toHaveTextContent(
        "Emoji image uploaded. Save emoji to publish it.",
      ),
    );
    const image = canvasElement.querySelector<HTMLImageElement>(
      ".community-settings__emoji-preview img",
    );
    expect(image?.src).toBe("https://relay.example/media/emoji.png");
    expect(canvas.getByRole("textbox", { name: "Name" })).toHaveValue(
      "party-parrot",
    );
  }}
>
  {#snippet template()}
    <CommunitySettings
      {model}
      section="custom-emoji"
      onUpdateProfile={async () => {}}
      onUploadCustomEmojiImage={async () =>
        "https://relay.example/media/emoji.png"}
      onAddCustomEmoji={async () => {}}
      onRemoveCustomEmoji={async () => {}}
    />
  {/snippet}
</Story>
