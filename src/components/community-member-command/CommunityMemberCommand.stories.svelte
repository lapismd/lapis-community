<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityMemberCommand from "./CommunityMemberCommand.svelte";

  const directory = [
    {
      id: "steve",
      name: "Steve",
      handle: "steve",
      initials: "SJ",
      presence: "online" as const,
      role: "administrator",
      administrator: true,
    },
    {
      id: "ada",
      name: "Ada Chen",
      handle: "ada",
      initials: "AC",
      presence: "online" as const,
      role: "writer",
      roles: ["writer"],
    },
    {
      id: "mara",
      name: "Mara Singh",
      handle: "mara",
      initials: "MS",
      presence: "away" as const,
    },
    {
      id: "noor",
      name: "Noor Rahman",
      handle: "noor",
      initials: "NR",
      presence: "offline" as const,
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Members/Member command",
    component: CommunityMemberCommand,
    tags: ["visual-pending"],
  });

  const roleDefinitions = [
    {
      id: "writer",
      label: "Writer",
      description: "Can post when the room is limited to writers.",
    },
    {
      id: "moderator",
      label: "Moderator",
      description: "Can moderate content when supported by the relay.",
    },
  ];
</script>

<Story
  name="Contextual channel members"
  args={{
    open: true,
    title: "Channel members",
    roomKind: "channel",
    mode: "manage",
    members: directory,
    results: directory,
    groupMemberIds: ["steve", "ada"],
    currentMemberId: "steve",
    roleDefinitions,
    onSearch: fn(),
    onSelect: fn(),
    onRemove: fn(),
    onSetRoles: fn(async () => {}),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Channel members",
    });
    const command = within(dialog);

    await expect(command.getByText("You")).toBeVisible();
    await expect(command.getByText("Ada Chen")).toBeVisible();
    await expect(command.queryByText("Mara Singh")).not.toBeInTheDocument();
    await expect(
      command.queryByRole("button", { name: "Done" }),
    ).not.toBeInTheDocument();

    await userEvent.type(
      command.getByRole("combobox", { name: "Search members" }),
      "a",
    );
    await expect(command.getByText("In this channel")).toBeVisible();
    await expect(command.getByText("Not in this channel")).toBeVisible();
    await expect(command.getByText("Ada Chen")).toBeVisible();
    await expect(command.getByText("Mara Singh")).toBeVisible();

    await userEvent.click(
      command.getByRole("option", { name: "Add Mara Singh to channel" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mara" }),
    );

    await userEvent.click(
      command.getByRole("option", { name: "Manage Ada Chen" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Manage roles" }),
    );
    const rolesDialog = await overlay.findByRole("dialog", {
      name: "Manage roles",
    });
    await expect(within(rolesDialog).getByText("Member")).toBeVisible();
    await userEvent.click(
      within(rolesDialog).getByRole("checkbox", { name: "Moderator" }),
    );
    await userEvent.click(
      within(rolesDialog).getByRole("button", { name: "Save roles" }),
    );
    await expect(args.onSetRoles).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ada" }),
      ["moderator", "writer"],
    );

    await userEvent.click(
      command.getByRole("option", { name: "Manage Ada Chen" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Remove from channel" }),
    );
    await expect(args.onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ada" }),
    );
  }}
>
  {#snippet template(args)}
    <CommunityMemberCommand {...args} />
  {/snippet}
</Story>

<Story
  name="Role update failure retained"
  args={{
    open: true,
    title: "Forum members",
    roomKind: "forum",
    mode: "manage",
    members: [directory[1]],
    results: [directory[1]],
    groupMemberIds: ["ada"],
    roleDefinitions,
    onSearch: fn(),
    onSelect: fn(),
    onRemove: fn(),
    onSetRoles: fn(async () => {
      throw new Error("Relay denied role replacement");
    }),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const membersDialog = await overlay.findByRole("dialog", {
      name: "Forum members",
    });
    await userEvent.click(
      within(membersDialog).getByRole("option", { name: "Manage Ada Chen" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Manage roles" }),
    );
    const rolesDialog = await overlay.findByRole("dialog", {
      name: "Manage roles",
    });
    const moderator = within(rolesDialog).getByRole("checkbox", {
      name: "Moderator",
    });
    await userEvent.click(moderator);
    await userEvent.click(
      within(rolesDialog).getByRole("button", { name: "Save roles" }),
    );
    await expect(within(rolesDialog).getByRole("alert")).toHaveTextContent(
      "Relay denied role replacement",
    );
    await expect(moderator).toBeChecked();
  }}
>
  {#snippet template(args)}
    <CommunityMemberCommand {...args} />
  {/snippet}
</Story>

<Story
  name="Contextual forum members"
  args={{
    open: true,
    title: "Forum members",
    roomKind: "forum",
    mode: "manage",
    members: directory,
    results: directory,
    groupMemberIds: ["steve"],
    currentMemberId: "steve",
    roleDefinitions,
    onSearch: fn(),
    onSelect: fn(),
    onRemove: fn(),
    onSetRoles: fn(async () => {}),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Forum members",
    });
    const command = within(dialog);

    await expect(command.getByText("You")).toBeVisible();
    await expect(command.queryByText("Noor Rahman")).not.toBeInTheDocument();
    await userEvent.type(
      command.getByRole("combobox", { name: "Search members" }),
      "noor",
    );
    await expect(command.getByText("In this forum")).toBeVisible();
    await expect(command.getByText("Not in this forum")).toBeVisible();
    await expect(
      command.getByRole("option", { name: "Add Noor Rahman to forum" }),
    ).toBeVisible();

    await userEvent.clear(
      command.getByRole("combobox", { name: "Search members" }),
    );
    await expect(
      command.getByRole("option", { name: "You, administrator" }),
    ).toBeVisible();
    await expect(
      command.queryByRole("option", { name: "Manage You" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityMemberCommand {...args} />
  {/snippet}
</Story>

<Story
  name="Permission-aware member view"
  args={{
    open: true,
    title: "Channel members",
    roomKind: "channel",
    mode: "view",
    members: directory,
    results: directory,
    groupMemberIds: ["steve", "ada"],
    currentMemberId: "ada",
    onSearch: fn(),
    onSelect: fn(),
    onRemove: fn(),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Channel members",
    });
    const command = within(dialog);
    await userEvent.type(
      command.getByRole("combobox", { name: "Search members" }),
      "mara",
    );
    await expect(command.getByText("Mara Singh")).toBeVisible();
    await expect(
      command.queryByRole("option", { name: "Add Mara Singh to channel" }),
    ).not.toBeInTheDocument();
    await expect(dialog.querySelector('[aria-haspopup="menu"]')).toBeNull();
  }}
>
  {#snippet template(args)}
    <CommunityMemberCommand {...args} />
  {/snippet}
</Story>
