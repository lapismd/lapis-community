<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityCommitDiff from "./CommunityCommitDiff.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    checkpoint,
    commit,
  } from "../../testing/agent-conversation-fixture.js";
  const onPublish = fn();
  const { Story } = defineMeta({
    title: "Community/Projects/Commit Discussion Diff",
    component: CommunityCommitDiff,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
    args: {
      checkpoints: [checkpoint],
      commitId: commit,
      files: [{ path: "README", patch: "@@ -1 +1 @@\n-Old text\n+New text\n" }],
    },
  });
</script>

<Story
  name="Comment on an exact diff line"
  play={async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector(
      '[data-diff-line-variant="added"]',
    );
    if (!line) throw new Error("Added diff line missing");
    await userEvent.hover(line);
    const button = (
      await canvas.findAllByRole("button", { name: "Comment on README line 1" })
    ).at(-1)!;
    for (
      let i = 0;
      i < 40 && button.ownerDocument.activeElement !== button;
      i++
    )
      await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const editor = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.click(editor);
    await userEvent.paste("Please clarify this line.");
    await userEvent.click(
      canvas.getByRole("button", { name: "Comment", exact: true }),
    );
    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    await expect(onPublish.mock.lastCall?.[0].tags).toEqual(
      expect.arrayContaining([
        ["c", commit],
        ["file", "README"],
        ["side", "new"],
        ["line", "1"],
      ]),
    );
    await expect(
      await canvas.findByText("Please clarify this line."),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}<Harness {onPublish}
      ><CommunityCommitDiff {...args} /></Harness
    >{/snippet}
</Story>
