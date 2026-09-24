<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fn,
    spyOn,
    userEvent,
    within,
    waitFor,
  } from "storybook/test";
  import CommunityTranscriptComments from "./CommunityTranscriptComments.svelte";
  import Harness from "../../testing/TranscriptCommentsHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Transcript comments",
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
  async function replyTo(item: HTMLElement) {
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
  }
</script>

<Story
  name="Live drafts wait for a durable record without losing text"
  args={{ onPublish: fn() }}
  play={async ({ canvas, args }) => {
    const warnings = spyOn(console, "warn");
    try {
      const item = (
        await canvas.findAllByRole("group", { name: "Thinking", exact: true })
      )[0]!;
      await replyTo(item);
      const thread = within(
        canvas.getByRole("region", { name: "Original conversation" }),
      );
      const editor = thread.getByRole("textbox", { name: "Markdown editor" });
      await userEvent.type(editor, "Check the final comparison.");
      await expect(
        thread.getByRole("button", { name: "Send reply" }),
      ).toBeDisabled();
      await expect(
        thread.getByText(/Waiting for this record to be saved/),
      ).toBeVisible();
      await expect(
        within(item).getByRole("button", { name: "Add reaction" }),
      ).toBeDisabled();
      await expect(
        within(item).getByRole("button", { name: "Copy message link" }),
      ).toBeDisabled();
      await userEvent.click(
        canvas.getByRole("button", { name: "Persist checkpoint" }),
      );
      await waitFor(() =>
        expect(
          thread.getByRole("button", { name: "Send reply" }),
        ).toBeEnabled(),
      );
      await expect(
        thread.getByRole("textbox", { name: "Markdown editor" }),
      ).toHaveTextContent("Check the final comparison.");
      await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
      await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
      expect(args.onPublish.mock.calls[0]![0].tags).toContainEqual([
        "record",
        "record-2",
      ]);
      await waitFor(() =>
        expect(
          thread.getByRole("textbox", { name: "Markdown editor" }),
        ).not.toHaveTextContent("Check the final comparison."),
      );
      expect(
        warnings.mock.calls.filter((args) =>
          args.some((arg) => String(arg).includes("derived_inert")),
        ),
      ).toEqual([]);
    } finally {
      warnings.mockRestore();
    }
  }}
>
  {#snippet template(args)}<Harness
      live
      threadPanel
      onPublish={args.onPublish}
    />{/snippet}
</Story>

<Story
  name="Tool detail toggles raw output without losing message actions"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const expandButtons = await canvas.findAllByRole("button", {
      name: /Expand .*edited files/,
    });
    await userEvent.click(expandButtons[0]!);
    const items = await canvas.findAllByRole("group", {
      name: "Tool activity: edit_file",
    });
    const item = items[0]!;
    await userEvent.click(
      within(item).getByRole("button", {
        name: "Show details for Edited file",
      }),
    );
    await expect(within(item).getByText("fixture.ts")).toBeVisible();
    await userEvent.hover(item);
    await waitFor(() =>
      expect(
        getComputedStyle(
          within(item).getByRole("group", { name: /Actions for/ }),
        ).pointerEvents,
      ).toBe("auto"),
    );
    await expect(
      within(item).getByRole("button", { name: "Reply", exact: true }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(item).getByRole("button", { name: "More message actions" }),
    );
    await expect(
      body.getByRole("menuitem", { name: "Copy message" }),
    ).toBeVisible();
    await userEvent.click(
      body.getByRole("menuitem", { name: "Show raw output" }),
    );
    await expect(within(item).getByText(/Input/)).toBeVisible();
    expect(within(item).getAllByText(/oldText/).length).toBeGreaterThan(0);
    await userEvent.click(
      within(item).getByRole("button", { name: "More message actions" }),
    );
    await expect(
      body.getByRole("menuitem", { name: "Show rich output" }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      richTools
      onPublish={args.onPublish}
    />{/snippet}
</Story>

<Story
  name="Plan steps and assistant replies target individual items"
  args={{ onPublish: fn() }}
  play={async ({ canvas, args }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    for (const [label, record, part] of [
      ["Plan step 2", "record-3", "plan:1"],
      ["Assistant message", "record-1", undefined],
    ]) {
      await replyTo(
        (await canvas.findAllByRole("group", { name: label, exact: true }))[0]!,
      );
      await userEvent.type(
        thread.getByRole("textbox", { name: "Markdown editor" }),
        `Review ${label}.`,
      );
      await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
      await waitFor(() =>
        expect(args.onPublish.mock.calls.at(-1)?.[0].content).toBe(
          `Review ${label}.`,
        ),
      );
      const tags = args.onPublish.mock.calls.at(-1)![0].tags;
      expect(tags).toContainEqual(["record", record]);
      if (part) expect(tags).toContainEqual(["part", part]);
      else expect(tags.some(([key]) => key === "part")).toBe(false);
      await expect(
        thread.getAllByText(`Review ${label}.`, { exact: true }),
      ).toHaveLength(1);
    }
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      onPublish={args.onPublish}
    />{/snippet}
</Story>

<Story
  name="Native checkpoint plans reply through the original composer"
  args={{ onPublish: fn() }}
  play={async ({ canvas, args }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    await replyTo(await thread.findByRole("group", { name: "Plan step 1" }));
    await userEvent.type(
      thread.getByRole("textbox", { name: "Markdown editor" }),
      "Verify the license plan.",
    );
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
    expect(args.onPublish.mock.calls[0]![0].tags).toContainEqual([
      "part",
      "plan:0",
    ]);
    await expect(
      await thread.findAllByText("Verify the license plan.", { exact: true }),
    ).toHaveLength(1);
  }}
>
  {#snippet template(args)}<Harness
      native
      threadPanel
      onPublish={args.onPublish}
    />{/snippet}
</Story>

<Story
  name="Feedback followups use the same timeline composer"
  args={{ onPublish: fn() }}
  play={async ({ canvas, args }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    await replyTo(
      (
        await canvas.findAllByRole("group", { name: "Thinking", exact: true })
      )[0]!,
    );
    await userEvent.type(
      thread.getByRole("textbox", { name: "Markdown editor" }),
      "Check this comparison.",
    );
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    const comment = (
      await thread.findByText("Check this comparison.", { exact: true })
    ).closest<HTMLElement>("[data-message-id]")!;
    await userEvent.hover(comment);
    const actions = within(comment).getByRole("group", { name: /Actions for/ });
    await waitFor(() =>
      expect(getComputedStyle(actions).pointerEvents).toBe("auto"),
    );
    await userEvent.click(
      within(comment).getByRole("button", { name: "Reply", exact: true }),
    );
    await expect(
      thread.getByRole("group", { name: "Replying to Operator" }),
    ).toBeVisible();
    await userEvent.type(
      thread.getByRole("textbox", { name: "Markdown editor" }),
      "And document the tradeoff.",
    );
    await userEvent.click(thread.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledTimes(2));
    const event = args.onPublish.mock.calls[1]![0];
    expect(event.kind).toBe(1111);
    expect(event.tags).toContainEqual(["k", "1111"]);
    expect(event.tags).toContainEqual(["e", comment.dataset.messageId]);
    await expect(
      await thread.findAllByText("And document the tradeoff.", { exact: true }),
    ).toHaveLength(1);
    await expect(
      canvas.getAllByRole("textbox", { name: "Markdown editor" }),
    ).toHaveLength(1);
  }}
>
  {#snippet template(args)}<Harness
      threadPanel
      onPublish={args.onPublish}
    />{/snippet}
</Story>
