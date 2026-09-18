<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

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
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("option", { name: /dev/u, hidden: true }),
    ).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Create" })).toBeDisabled();
    await expect(
      canvas.getByText(/maintainer or administrator role/iu),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryDialog {...args} />
  {/snippet}
</Story>
