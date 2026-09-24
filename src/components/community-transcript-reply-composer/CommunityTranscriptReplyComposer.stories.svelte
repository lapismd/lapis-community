<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityTranscriptReplyComposer from "./CommunityTranscriptReplyComposer.svelte";
  import Harness from "../../testing/TranscriptCommentsHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Transcript composer",
    component: CommunityTranscriptReplyComposer,
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
  name="Item drafts survive switching and remounting but never cross viewers"
  play={async ({ canvas }) => {
    const thread = within(
      canvas.getByRole("region", { name: "Original conversation" }),
    );
    async function select(name: string) {
      const item = (
        await canvas.findAllByRole("group", { name, exact: true })
      )[0]!;
      const reply = within(item).getByRole("button", {
        name: "Reply",
        exact: true,
      });
      reply.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(
          thread.getByRole("textbox", { name: "Markdown editor" }),
        ).toHaveFocus(),
      );
      return thread.getByRole("textbox", { name: "Markdown editor" });
    }
    await userEvent.type(await select("Thinking"), "Thinking draft");
    await userEvent.type(await select("Plan step 1"), "Plan draft");
    await expect(await select("Thinking")).toHaveTextContent("Thinking draft");
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle transcript" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle transcript" }),
    );
    await expect(await select("Plan step 1")).toHaveTextContent("Plan draft");
    await userEvent.click(
      canvas.getByRole("button", { name: "Switch viewer" }),
    );
    await expect(await select("Thinking")).not.toHaveTextContent(
      "Thinking draft",
    );
  }}
>
  {#snippet template()}<div style="max-width:360px">
      <Harness threadPanel switchViewer />
    </div>{/snippet}
</Story>
