<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityGroupInviteDialog from "./CommunityGroupInviteDialog.svelte";

  const invite = {
    uri: "nostr:naddr1qqxnzd3cxqurxve5xq6rsdpkxq6ryv3exqunsvf3xq6nwvf5x5cryd3exq6n2v35qgs8qlu8v3a7v89h7fapzphm06vltr8d8yr4w9m9c4pl2hmyqxpqqqp65w9e5aa?invite=4f0a9c",
    code: "4f0a9c",
    groupId: "writers",
    relayUrl: "wss://relay.example/",
    relayPubkey: "f".repeat(64),
  };

  const { Story } = defineMeta({
    title: "Community/Rooms/Group invite dialog",
    component: CommunityGroupInviteDialog,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Create private channel invite"
  args={{
    open: true,
    mode: "create",
    roomName: "writers",
    onCreate: fn(async () => invite),
    onJoin: fn(async () => {}),
    onCopy: fn(async () => {}),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Create invite link",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create invite" }),
    );
    await expect(args.onCreate).toHaveBeenCalledOnce();
    await expect(within(dialog).getByLabelText("Invite link")).toHaveValue(
      invite.uri,
    );
    await expect(
      within(dialog).getByText(/Invite created\. Copy it/),
    ).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Copy" }));
    await expect(args.onCopy).toHaveBeenCalledWith(invite.uri);
    await expect(
      within(dialog).getByText("Invite created and copied to the clipboard."),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityGroupInviteDialog {...args} />
  {/snippet}
</Story>

<Story
  name="Join failure retains input"
  globals={{
    colorMode: "dark",
    viewport: { value: "mobile1", isRotated: false },
  }}
  args={{
    open: true,
    mode: "join",
    onCreate: fn(async () => invite),
    onJoin: fn(async () => {
      throw new Error("Relay denied the invite code");
    }),
    onCopy: fn(async () => {}),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Join with invite",
    });
    const input = within(dialog).getByLabelText("Invite link");
    await userEvent.type(input, invite.uri);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Join group" }),
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Relay denied the invite code",
    );
    await expect(input).toHaveValue(invite.uri);
  }}
>
  {#snippet template(args)}
    <CommunityGroupInviteDialog {...args} />
  {/snippet}
</Story>
