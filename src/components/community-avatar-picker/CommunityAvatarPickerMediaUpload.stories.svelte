<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import CommunityAvatarPicker from "./CommunityAvatarPicker.svelte";

  const { Story } = defineMeta({
    title: "Community/Primitives/Avatar/Media upload",
    component: CommunityAvatarPicker,
    tags: ["visual-pending"],
  });
</script>

<script lang="ts">
  let uploadedAvatar = $state("");
</script>

<Story
  name="Relay media URL"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Upload relay avatar" }),
    );
    const body = within(document.body);
    await userEvent.upload(
      await body.findByLabelText("Upload avatar image"),
      new File([new Uint8Array(1024 * 1024 + 1)], "avatar.png", {
        type: "image/png",
      }),
    );
    await waitFor(() =>
      expect(
        body.queryByText("Choose an image smaller than 1 MB."),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        body.getByRole("img", { name: "Selected avatar" }),
      ).toHaveAttribute("src", "https://relay.example/media/avatar.png"),
    );
  }}
>
  {#snippet template()}
    <CommunityAvatarPicker
      bind:value={uploadedAvatar}
      label="Upload relay avatar"
      onUploadImage={async () => "https://relay.example/media/avatar.png"}
    />
  {/snippet}
</Story>
