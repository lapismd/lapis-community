<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityRoomEditor from "./CommunityRoomEditor.svelte";
  const { Story } = defineMeta({
    title: "Community/Rooms/Room editor",
    component: CommunityRoomEditor,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Edit channel"
  args={{
    open: true,
    roomKind: "channel",
    initial: {
      name: "general",
      description: "Community chat",
      visibility: "public",
      lifecycle: "ongoing",
      postingPolicy: "standard",
    },
    writerPolicySupported: true,
    onSave: fn(async () => {}),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const name = overlay.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "announcements");
    await userEvent.click(
      overlay.getByRole("radio", { name: /Writers and administrators/ }),
    );
    await userEvent.click(
      overlay.getByRole("button", { name: "Save changes" }),
    );
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "announcements",
        postingPolicy: "writers",
      }),
    );
  }}
>
  {#snippet template(args)}
    <CommunityRoomEditor {...args} />
  {/snippet}
</Story>

<Story
  name="Private forum error on mobile dark"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
  args={{
    open: true,
    roomKind: "forum",
    initial: {
      name: "reviewers",
      description: "Private review forum",
      visibility: "private",
      lifecycle: "ongoing",
      postingPolicy: "writers",
    },
    writerPolicySupported: true,
    onSave: fn(async () => {
      throw new Error("Relay denied metadata update");
    }),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      overlay.getByRole("button", { name: "Save changes" }),
    );
    await expect(
      overlay.getByText("Relay denied metadata update"),
    ).toBeVisible();
    await expect(overlay.getByLabelText("Name")).toHaveValue("reviewers");
    await expect(
      overlay.getByRole("radio", { name: /Writers and administrators/ }),
    ).toBeChecked();
  }}
>
  {#snippet template(args)}
    <CommunityRoomEditor {...args} />
  {/snippet}
</Story>
