<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within, waitFor } from "storybook/test";
  import CommunityTranscriptComments from "./CommunityTranscriptComments.svelte";
  import Harness from "../../testing/TranscriptCommentsHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Transcript replies",
    component: CommunityTranscriptComments,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityAgentTranscript {activity} {agent} {members} />",
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Grouped tools expose replies on each call"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement, args }) => {
    await expect(
      canvas.queryByRole("button", { name: "Comment on tool input" }),
    ).not.toBeInTheDocument();
    const expand = (
      await canvas.findAllByRole("button", { name: "Expand 2 tool calls" })
    )[0]!;
    await userEvent.click(expand);
    const items = await canvas.findAllByRole("group", {
      name: "Tool activity: Read file",
    });
    const item = items[0]!;
    await userEvent.hover(item);
    await waitFor(() =>
      expect(
        getComputedStyle(
          within(item).getByRole("group", { name: /Actions for/ }),
        ).pointerEvents,
      ).toBe("auto"),
    );
    const reply = within(item).getByRole("button", {
      name: "Reply",
      exact: true,
    });
    await userEvent.click(reply);
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole("dialog"),
    ).not.toBeInTheDocument();
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    const composer = thread.getByRole("textbox", { name: "Markdown editor" });
    await waitFor(() => expect(composer).toHaveFocus());
    await userEvent.type(composer, "Please check this tool result.");
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
    const event = args.onPublish.mock.calls[0]![0];
    expect(event.kind).toBe(1111);
    expect(event.tags).toContainEqual(["record", "record-4"]);
    expect(
      event.tags.some(([key]) => ["selection", "part"].includes(key)),
    ).toBe(false);
    await expect(
      await thread.findAllByText("Please check this tool result.", {
        exact: true,
      }),
    ).toHaveLength(1);
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      grouped
      onPublish={args.onPublish}
    />{/snippet}
</Story>

<Story
  name="Reply preserves the ordinary thread draft and failed comment"
  args={{ onPublish: fn() }}
  play={async ({ canvas, args }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    await userEvent.type(
      thread.getByRole("textbox", { name: "Markdown editor" }),
      "Ordinary reply draft",
    );
    const item = (
      await canvas.findAllByRole("group", { name: "Thinking" })
    )[0]!;
    await userEvent.hover(item);
    await waitFor(() =>
      expect(
        getComputedStyle(
          within(item).getByRole("group", { name: /Actions for/ }),
        ).pointerEvents,
      ).toBe("auto"),
    );
    await userEvent.click(
      within(item).getByRole("button", { name: "Reply", exact: true }),
    );
    await userEvent.type(
      thread.getByRole("textbox", { name: "Markdown editor" }),
      "Check the patent terms.",
    );
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    await expect(await thread.findByRole("alert")).toHaveTextContent(
      "Persistence unavailable",
    );
    await userEvent.click(thread.getByRole("button", { name: "Cancel reply" }));
    await expect(
      thread.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("Ordinary reply draft");
    await userEvent.hover(item);
    await waitFor(() =>
      expect(
        getComputedStyle(
          within(item).getByRole("group", { name: /Actions for/ }),
        ).pointerEvents,
      ).toBe("auto"),
    );
    await userEvent.click(
      within(item).getByRole("button", { name: "Reply", exact: true }),
    );
    await expect(
      thread.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("Check the patent terms.");
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
    await expect(
      thread.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("Ordinary reply draft");
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      failFirst
      onPublish={args.onPublish}
    />{/snippet}
</Story>
