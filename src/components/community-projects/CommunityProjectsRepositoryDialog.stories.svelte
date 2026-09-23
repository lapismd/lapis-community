<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityProjectsRepositoryDialog from "./CommunityProjectsRepositoryDialog.svelte";

  const rooms = [
    {
      id: "dev",
      groupId: "dev",
      name: "dev",
      kind: "channel",
      permissions: {
        publish: { state: "enabled" },
        join: { state: "denied" },
        leave: { state: "enabled" },
        update: { state: "denied" },
        delete: { state: "denied" },
        manageMembers: { state: "denied" },
        maintain: {
          state: "denied",
          reason:
            "A maintainer or administrator role is required to create repositories and review or merge pull requests",
          requirement: "maintainer",
        },
      },
    },
  ] as CommunityRoomModel[];

  const { Story } = defineMeta({
    title: "Community/Projects/Repository dialog",
    component: CommunityProjectsRepositoryDialog,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Create repository requires maintainer"
  args={{
    open: true,
    draft: {
      project: "",
      channelId: "dev",
      name: "notes",
      identifier: "notes",
      description: "",
      mode: "hosted",
      cloneUrl: "",
      webUrl: "",
    },
    channels: rooms,
    rooms,
    onOpenChange: fn(),
    onSelectProject: fn(),
    onSubmit: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const document = within(canvasElement.ownerDocument.body);
    const dialog = within(
      await document.findByRole("dialog", {
        name: "Create a new repository",
      }),
    );
    await expect(
      dialog.getByRole("button", { name: "Create repository" }),
    ).toBeDisabled();
    await expect(
      dialog.getByText(/maintainer or administrator role/iu),
    ).toBeVisible();
    await userEvent.click(
      dialog.getByRole("button", { name: "Repository channel" }),
    );
    const option = await document.findByRole("option", { name: /dev/u });
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute("data-disabled");
    await userEvent.keyboard("{Escape}");
    await expect(
      dialog.getByRole("button", { name: "Create repository" }),
    ).toBeDisabled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryDialog {...args} />
  {/snippet}
</Story>
