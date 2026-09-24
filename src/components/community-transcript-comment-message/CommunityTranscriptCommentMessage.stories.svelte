<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityTranscriptCommentMessage from "./CommunityTranscriptCommentMessage.svelte";
  import Harness from "../../testing/TranscriptCommentsHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Transcript feedback message",
    component: CommunityTranscriptCommentMessage,
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
  name="Feedback is one normal message with target navigation and author controls"
  play={async ({ canvas, canvasElement }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    const text = await thread.findByText("Check the patent terms.", {
      exact: true,
    });
    await expect(
      thread.getAllByText("Check the patent terms.", { exact: true }),
    ).toHaveLength(1);
    const message = text.closest<HTMLElement>("[data-message-id]")!;
    const target = within(message).getByRole("button", {
      name: /Replying to Nyra:/,
    });
    await userEvent.click(target);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toHaveAttribute(
        "data-record-id",
        "record-2",
      ),
    );
    message.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
    );
    await waitFor(() =>
      expect(
        getComputedStyle(
          within(message).getByRole("group", { name: /Actions for/ }),
        ).pointerEvents,
      ).toBe("auto"),
    );
    await userEvent.click(
      within(message).getByRole("button", { name: "More message actions" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByRole("menuitem", { name: "Edit message" }),
    ).toBeVisible();
    await expect(
      body.getByRole("menuitem", { name: "Delete message" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  }}
>
  {#snippet template()}<Harness threadPanel initialComment />{/snippet}
</Story>
