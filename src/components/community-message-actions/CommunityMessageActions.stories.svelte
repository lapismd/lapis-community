<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityMessageActions from "./CommunityMessageActions.svelte";
  const { Story } = defineMeta({
    title: "Community/Messages/Shared actions",
    component: CommunityMessageActions,
    tags: ["visual-pending"],
    args: {
      id: "record",
      authorName: "Nyra",
      visible: true,
      onReply: fn(),
      onCopyMessage: fn(),
      onCopyEvent: fn(),
      onCopyLink: fn(),
    },
    parameters: {
      docs: {
        source: {
          code: '<CommunityMessageActions id="record" authorName="Nyra" visible {onReply} {onCopyMessage} {onCopyEvent} {onCopyLink} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Keyboard reply and copy actions"
  play={async ({ canvas, canvasElement, args }) => {
    const reply = canvas.getByRole("button", { name: "Reply", exact: true });
    reply.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onReply).toHaveBeenCalledWith("record");
    await userEvent.click(
      canvas.getByRole("button", { name: "More message actions" }),
    );
    const menu = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await menu.findByRole("menuitem", { name: "Copy event", exact: true }),
    );
    await expect(args.onCopyEvent).toHaveBeenCalledWith("record");
  }}
>
  {#snippet template(args)}<div
      style="position:relative;margin-top:3rem;height:4rem"
    >
      <CommunityMessageActions {...args} />
    </div>{/snippet}
</Story>
<Story
  name="Live targets explain unavailable durable actions"
  args={{ disabledReason: "Waiting for this record to be saved" }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Reply", exact: true }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: "Copy message link" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("group", { name: /Actions for/ }),
    ).toHaveAccessibleDescription("Waiting for this record to be saved");
  }}
>
  {#snippet template(args)}<div
      style="position:relative;margin-top:3rem;height:4rem"
    >
      <CommunityMessageActions {...args} />
    </div>{/snippet}
</Story>
