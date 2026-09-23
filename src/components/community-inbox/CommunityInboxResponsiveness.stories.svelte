<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fireEvent, userEvent, waitFor } from "storybook/test";
  import CommunityInbox from "./CommunityInbox.svelte";
  import CommunityInboxResponsivenessHarness from "./CommunityInboxResponsivenessHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Inbox/Responsiveness",
    component: CommunityInbox,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          code: `<script lang="ts">
  import { CommunityInbox } from "@lapismd/lapis-community/components";
<\/script>
<CommunityInbox model={inbox} conversationLoading={pending} onSelect={selectConversation} onSend={send} onMarkAllRead={markAllRead} onOpenChannelSettings={openSettings} />`,
        },
      },
    },
  });
</script>

<Story
  name="Bounded adapter reads"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText(/First discussion message 19\./),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Report parent reads" }),
    );
    const result = canvas.getByTestId("inbox-responsiveness");
    expect(Number(result.dataset.parentReads)).toBeLessThan(200);
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh adapter" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Report parent reads" }),
    );
    expect(Number(result.dataset.parentReads)).toBeLessThan(200);
    await expect(
      canvas.getByText(/First discussion message 19\./),
    ).toBeInTheDocument();
  }}
>
  {#snippet template()}<CommunityInboxResponsivenessHarness />{/snippet}
</Story>

<Story
  name="Cached selection paints pending state"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText(/First discussion message 19\./),
    ).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: /^Second thread:/ }),
    );
    await waitFor(() =>
      expect(
        canvas.getByText(/Second discussion message 19\./),
      ).toBeInTheDocument(),
    );
    await expect(canvas.getByTestId("inbox-responsiveness")).toHaveAttribute(
      "data-skeleton-before-selection",
      "true",
    );
    await expect(
      canvas.queryByText(/First discussion message 19\./),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}<CommunityInboxResponsivenessHarness />{/snippet}
</Story>

<Story
  name="Rapid selection keeps the latest request"
  play={async ({ canvas }) => {
    const second = canvas.getByRole("button", { name: /^Second thread:/ });
    const third = canvas.getByRole("button", { name: /^Third thread:/ });
    fireEvent.click(second);
    fireEvent.click(third);
    await waitFor(() =>
      expect(
        canvas.getByText(/Third discussion message 19\./),
      ).toBeInTheDocument(),
    );
    await expect(canvas.getByTestId("inbox-responsiveness")).toHaveAttribute(
      "data-selection-calls",
      "Third",
    );
  }}
>
  {#snippet template()}<CommunityInboxResponsivenessHarness />{/snippet}
</Story>

<Story
  name="Leaving cancels a pending selection"
  play={async ({ canvas }) => {
    fireEvent.click(canvas.getByRole("button", { name: /^Second thread:/ }));
    fireEvent.click(canvas.getByRole("button", { name: "Hide inbox" }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await expect(
      canvas.queryByRole("region", { name: "Selected inbox thread" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId("inbox-responsiveness")).toHaveAttribute(
      "data-selection-calls",
      "",
    );
  }}
>
  {#snippet template()}<CommunityInboxResponsivenessHarness />{/snippet}
</Story>
