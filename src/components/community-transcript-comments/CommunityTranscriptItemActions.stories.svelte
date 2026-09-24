<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within, waitFor } from "storybook/test";
  import { verifyEvent } from "nostr-tools/pure";
  import { parseCommunityEntityLink } from "../../community/community-links.js";
  import CommunityTranscriptComments from "./CommunityTranscriptComments.svelte";
  import Harness from "../../testing/TranscriptCommentsHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Transcript item actions",
    component: CommunityTranscriptComments,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: 'import { CommunityThreadPanel } from "@lapismd/lapis-community/components";\n<CommunityThreadPanel {thread} {members} {rooms} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Copy uses the signed checkpoint and reactions stay on the exact step"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement, args }) => {
    const item = (
      await canvas.findAllByRole("group", { name: "Plan step 1", exact: true })
    )[0]!;
    const other = (
      await canvas.findAllByRole("group", { name: "Plan step 2", exact: true })
    )[0]!;
    const controls = within(item),
      body = within(canvasElement.ownerDocument.body);
    const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      controls.getByRole("button", { name: "Copy message link" }).focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      const link = parseCommunityEntityLink(writeText.mock.calls[0]![0]);
      expect(link).toMatchObject({
        kind: "message",
        record: "record-3",
        part: "plan:0",
      });
      await userEvent.click(
        controls.getByRole("button", { name: "More message actions" }),
      );
      await userEvent.click(
        await body.findByRole("menuitem", { name: "Copy event", exact: true }),
      );
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      const copied = writeText.mock.calls[1]![0];
      expect(copied).toContain("Inspect the repository");
      const event = JSON.parse(
        copied.split("```json\n")[1]!.split("\n```")[0]!,
      );
      expect(event.kind).toBe(3907);
      expect(verifyEvent(event)).toBe(true);
      expect(event.id).toBe(
        link?.kind === "message" ? link.checkpoint : undefined,
      );
      await userEvent.click(
        controls.getByRole("button", { name: "Add reaction" }),
      );
      const emoji = await waitFor(() => {
        const button = canvasElement.ownerDocument
          .querySelector("em-emoji-picker")
          ?.shadowRoot?.querySelector<HTMLButtonElement>(
            'button[aria-label="🤣"]',
          );
        expect(button).toBeTruthy();
        return button!;
      });
      await userEvent.click(emoji);
      await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
      expect(args.onPublish.mock.calls[0]![0]).toMatchObject({ kind: 7 });
      expect(args.onPublish.mock.calls[0]![0].tags).toContainEqual([
        "part",
        "plan:0",
      ]);
      const reaction = await controls.findByRole("button", { name: /🤣/ });
      await expect(
        within(other).queryByRole("button", { name: /🤣/ }),
      ).not.toBeInTheDocument();
      await userEvent.click(reaction);
      await waitFor(() => expect(args.onPublish).toHaveBeenCalledTimes(2));
      expect(args.onPublish.mock.calls[1]![0].kind).toBe(5);
      await waitFor(() =>
        expect(
          controls.queryByRole("button", { name: /🤣/ }),
        ).not.toBeInTheDocument(),
      );
    } finally {
      if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      onPublish={args.onPublish}
    />{/snippet}
</Story>
