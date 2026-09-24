<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within, waitFor } from "storybook/test";
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
</script>

<Story
  name="Thinking comments stay anchored and preserve drafts after failure"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      (
        await canvas.findAllByRole("button", {
          name: "Comment on thinking",
          exact: true,
        })
      )[0]!,
    );
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Comment on thinking" });
    await userEvent.type(
      await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
      "Please compare the patent terms.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Post comment" }),
    );
    await expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Persistence unavailable",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle transcript" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle transcript" }),
    );
    await userEvent.click(
      (
        await canvas.findAllByRole("button", {
          name: "Comment on thinking",
          exact: true,
        })
      )[0]!,
    );
    dialog = body.getByRole("dialog", { name: "Comment on thinking" });
    await expect(
      await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("Please compare the patent terms.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Post comment" }),
    );
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
    await expect(canvas.getByLabelText("Published comments")).toHaveTextContent(
      "1",
    );
    await expect(
      within(
        canvas.getByRole("region", { name: "Original conversation" }),
      ).getAllByText("Please compare the patent terms.")[0],
    ).toBeVisible();
  }}
>
  {#snippet template(args)}<Harness
      failFirst
      onPublish={args.onPublish}
    />{/snippet}
</Story>
<Story
  name="Live drafts wait for durable records"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      (
        await canvas.findAllByRole("button", {
          name: "Comment on thinking",
          exact: true,
        })
      )[0]!,
    );
    const body = within(canvasElement.ownerDocument.body),
      dialog = body.getByRole("dialog", { name: "Comment on thinking" });
    await userEvent.type(
      await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
      "Check the comparison.",
    );
    await expect(
      within(dialog).getByRole("button", { name: "Post comment" }),
    ).toBeDisabled();
    await expect(
      within(dialog).getByText("Waiting for this record to be saved."),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Persist checkpoint" }),
    );
    await userEvent.click(
      (
        await canvas.findAllByRole("button", {
          name: "Comment on thinking",
          exact: true,
        })
      )[0]!,
    );
    await userEvent.click(body.getByRole("button", { name: "Post comment" }));
    await expect(canvas.getByLabelText("Published comments")).toHaveTextContent(
      "1",
    );
  }}>{#snippet template()}<Harness live />{/snippet}</Story
>

<Story
  name="Text selections plan steps and tools use durable record identities"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const closeFinished = async () => {
      await waitFor(() =>
        expect(
          getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
        ).not.toBe("none"),
      );
    };
    await userEvent.click(
      (
        await canvas.findAllByRole("button", {
          name: "Comment on thinking",
          exact: true,
        })
      )[0]!,
    );
    let dialog = body.getByRole("dialog", { name: "Comment on thinking" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Comment target" }),
    );
    await userEvent.click(
      body.getByRole("option", { name: "Text", exact: true }),
    );
    const excerpt = within(dialog).getByLabelText("Transcript excerpt");
    const range = canvasElement.ownerDocument.createRange();
    range.setStart(excerpt.firstChild!, 8);
    range.setEnd(excerpt.firstChild!, 18);
    const selection = canvasElement.ownerDocument.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Use selected text" }),
    );
    await expect(within(dialog).getByRole("blockquote")).toHaveTextContent(
      "Apache 2.0",
    );
    await userEvent.type(
      await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
      "Check this license.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Post comment" }),
    );
    await closeFinished();
    const original = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    await expect(original.getAllByText("Comment on thinking")[0]).toBeVisible();
    await expect(original.getAllByRole("blockquote")[0]).toHaveTextContent(
      "Apache 2.0",
    );
    const first = args.onPublish.mock.calls[0]![0];
    expect(first.tags).toEqual(
      expect.arrayContaining([
        ["record", "record-2"],
        ["part", "text"],
      ]),
    );
    expect(
      JSON.parse(first.tags.find((tag) => tag[0] === "selection")![1]!),
    ).toMatchObject({ start: 8, end: 18, exact: "Apache 2.0" });
    for (const [label, record, part] of [
      ["plan", "record-3", "Plan step 2"],
      ["tool input", "record-4", "Tool input"],
      ["tool output", "record-5", "Tool output"],
      ["assistant text", "record-1", "Text"],
    ]) {
      await userEvent.click(
        (
          await canvas.findAllByRole("button", {
            name: `Comment on ${label}`,
            exact: true,
          })
        )[0]!,
      );
      dialog = body.getByRole("dialog", { name: `Comment on ${label}` });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Comment target" }),
      );
      await userEvent.click(
        body.getByRole("option", { name: part, exact: true }),
      );
      await userEvent.type(
        await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
        `Review ${label}.`,
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Post comment" }),
      );
      await closeFinished();
      expect(args.onPublish.mock.calls.at(-1)![0].tags).toContainEqual([
        "record",
        record,
      ]);
    }
    expect(args.onPublish).toHaveBeenCalledTimes(5);
    expect(
      args.onPublish.mock.calls.every(([event]) => event.kind === 1111),
    ).toBe(true);
  }}
>
  {#snippet template(args)}<Harness onPublish={args.onPublish} />{/snippet}
</Story>

<Story
  name="Native checkpoint plans remain commentable in the original thread"
  args={{ onPublish: fn() }}
  play={async ({ canvas, canvasElement, args }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    await userEvent.click(
      await thread.findByRole("button", {
        name: "Comment on plan",
        exact: true,
      }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Comment on plan" },
    );
    await userEvent.type(
      await within(dialog).findByRole("textbox", { name: "Markdown editor" }),
      "Verify the license plan.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Post comment" }),
    );
    await waitFor(() => expect(args.onPublish).toHaveBeenCalledOnce());
    await expect(
      (await thread.findAllByText("Verify the license plan."))[0],
    ).toBeVisible();
  }}
>
  {#snippet template(args)}<Harness
      native
      onPublish={args.onPublish}
    />{/snippet}
</Story>
