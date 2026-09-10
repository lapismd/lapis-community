<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityAgentProfile from "./CommunityAgentProfile.svelte";
  import Harness from "../community-agents/CommunityAgentsStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Profile",
    component: CommunityAgentProfile,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgentProfile } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgentProfile {agent} {rooms} {canMessage} onMessage={messageAgent} onFollow={followAgent} onActivity={openActivity} onCopy={copyKey} onOpenChannel={openChannel} onAddChannel={addToChannel} onRemoveChannel={removeFromChannel} />`,
        },
      },
    },
  });
</script>

<Story
  name="Message follow and activity"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Message", exact: true }),
    );
    await expect(
      canvas.getByText("Conversation with Research opened"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    );
    await expect(
      canvas.getByRole("button", { name: "Unfollow", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy Research's public key" }),
    );
    await expect(canvas.getByText("Public key copied")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Activity log" }));
    await expect(
      canvas.getByText("Here are the project updates."),
    ).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>
<Story
  name="Channel membership failure and retry"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add to channel" }),
    );
    let dialog = body.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add agent", exact: true }),
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Relay denied",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add agent", exact: true }),
    );
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
    await expect(
      canvas.getByRole("button", { name: "# support", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Research from support" }),
    );
    dialog = body.getByRole("dialog");
    await expect(
      within(dialog).getByRole("heading", {
        name: "Remove Research from support?",
      }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
    await expect(
      canvas.getByRole("button", { name: "# support", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Research from support" }),
    );
    await userEvent.click(
      within(body.getByRole("dialog")).getByRole("button", {
        name: "Remove agent",
        exact: true,
      }),
    );
    await expect(
      canvas.queryByRole("button", { name: "# support", exact: true }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness screen="profile" failAction />{/snippet}</Story
>
<Story
  name="Follow publication failure"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent("Relay denied");
    await expect(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  }}
  >{#snippet template()}<Harness screen="profile" failAction />{/snippet}</Story
>
<Story
  name="Encryption unavailable"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Message", exact: true }),
    ).toBeDisabled();
    await expect(
      canvas.getByText(
        "Connect a signer with encryption support to message this agent.",
      ),
    ).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="profile"
      variant="no-encryption"
    />{/snippet}</Story
>
<Story
  name="Permission denied"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await expect(
      canvas.getByRole("button", { name: "Add to channel" }),
    ).toBeDisabled();
    await expect(
      canvas.queryByRole("button", { name: "Remove Research from general" }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness
      screen="profile"
      variant="denied"
    />{/snippet}</Story
>
<Story name="Offline narrow"
  >{#snippet template()}<Harness
      screen="profile"
      variant="offline"
      narrow
    />{/snippet}</Story
>
