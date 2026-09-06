<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import RegistryCommunity from "./RegistryCommunity.svelte";
  import RegistryCommunityStoryHarness from "./RegistryCommunityStoryHarness.svelte";
  import RegistryCommunityLongTimelineStoryHarness from "./RegistryCommunityLongTimelineStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { RegistryCommunity } from "@lapismd/lapis-community/components";
<\/script>

<RegistryCommunity
  plugin="registry-demo"
  name="Registry Demo"
  version="1.2.3"
  publisher="<publisher-pubkey>"
  relays='["wss://relay.example"]'
/>`;

  const { Story } = defineMeta({
    title: "Community/Registry/Community lifecycle",
    component: RegistryCommunity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "The complete public registry composition. It uses isolated signed events in memory by default and the same data-source boundary over Docker when the Storybook relay backend is enabled.",
        },
      },
    },
  });
</script>

<Story
  name="Loaded discussion and publish"
  play={async ({ canvas }) => {
    const runtime = await canvas.findByTestId(
      "registry-community-runtime",
      {},
      { timeout: 10_000 },
    );
    await expect(runtime).toHaveAttribute(
      "data-community-backend",
      expect.stringMatching(/^(memory|docker|live)$/u),
    );
    if (runtime.dataset.communityBackend === "live") return;

    await expect(
      await canvas.findByRole("region", {
        name: "Registry Demo community discussion",
      }),
    ).toBeVisible();
    await expect(
      (await canvas.findAllByText("Seeded registry discussion"))[0],
    ).toBeVisible();
    await expect(
      canvas.getByText("The shared controller boundary keeps this portable."),
    ).toBeVisible();
    const composerTrigger = canvas.getByRole("button", {
      name: "Start a discussion about Registry Demo",
    });
    const finalPost = canvas
      .getByText("The shared controller boundary keeps this portable.")
      .closest("[data-post-id]");
    if (finalPost === null)
      throw new Error("Expected the final discussion post");
    await expect(
      finalPost.compareDocumentPosition(composerTrigger) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    await expect(canvas.queryByText("1 relay")).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("heading", { name: "Discussion" }),
    ).not.toBeInTheDocument();
    await userEvent.click(composerTrigger);
    await expect(
      canvas.queryByText("No comments yet. Start the conversation."),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "Open profile for Publisher" },
        { timeout: 15_000 },
      ),
    );
    await expect(
      await within(document.body).findByText("Nostr community profile"),
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "Open profile for Publisher" },
        { timeout: 15_000 },
      ),
    );

    const composer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.type(composer, "Published through the shared relay source");
    await userEvent.click(
      canvas.getByRole("button", { name: "Publish comment" }),
    );
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "Comment published",
    );
    await expect(
      await canvas.findByText("Published through the shared relay source"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <RegistryCommunityStoryHarness />
  {/snippet}
</Story>

<Story
  name="Delayed 260 post timeline"
  parameters={{
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop" },
  }}
  play={async ({ canvas }) => {
    const runtime = await canvas.findByTestId(
      "long-timeline-runtime",
      {},
      { timeout: 10_000 },
    );
    if (runtime.dataset.communityBackend === "live") return;
    const community = await canvas.findByRole("region", {
      name: "Registry Demo community discussion",
    });
    await expect(
      await canvas.findByText(/Reply 259:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    if (runtime.dataset.communityBackend === "memory") {
      await expect(community).toHaveAttribute(
        "data-comment-count-available",
        "false",
      );
    }
    const timeline = await canvas.findByRole(
      "slider",
      { name: "Discussion position" },
      { timeout: 15_000 },
    );
    await expect(timeline).toHaveAttribute("aria-valuemax", "260");
    const track = canvas.getByRole("group", {
      name: "Discussion timeline",
    });
    const timelineActions = canvas.getByRole("group", {
      name: "Discussion timeline actions",
    });
    const timelineReply = within(timelineActions).getByRole("button", {
      name: "Reply to this discussion",
    });
    const timelineFollow = within(timelineActions).getByRole("button", {
      name: "Follow new activity",
    });
    await expect(timelineReply.textContent?.trim()).toBe("");
    await expect(timelineFollow.textContent?.trim()).toBe("");
    await userEvent.click(timelineFollow);
    await expect(
      within(timelineActions).getByRole("button", {
        name: "Stop following this discussion",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    const bookmark = canvas.getByRole("button", { name: "Bookmark" });
    await userEvent.click(bookmark);
    await expect(
      canvas.getByRole("button", { name: "Remove bookmark" }),
    ).toHaveAttribute("aria-pressed", "true");
    const handleBounds = timeline.getBoundingClientRect();
    const trackBounds = track.getBoundingClientRect();
    let loadedWhileDragging = false;
    timeline.addEventListener(
      "pointermove",
      () => {
        loadedWhileDragging =
          canvas.queryByRole("status", {
            name: "Loading discussion posts",
          }) !== null;
      },
      { once: true },
    );
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: timeline,
        coords: {
          x: handleBounds.left + handleBounds.width / 2,
          y: handleBounds.top + handleBounds.height / 2,
        },
      },
      {
        target: timeline,
        coords: {
          x: trackBounds.left + trackBounds.width / 2,
          y: trackBounds.top + trackBounds.height / 2,
        },
      },
      {
        keys: "[/MouseLeft]",
        target: timeline,
        coords: {
          x: trackBounds.left + trackBounds.width / 2,
          y: trackBounds.top + trackBounds.height / 2,
        },
      },
    ]);
    await expect(loadedWhileDragging).toBe(false);
    await expect(
      canvas.getByRole("status", { name: "Loading discussion posts" }),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(Number(timeline.getAttribute("aria-valuenow"))).toBeLessThan(
          240,
        ),
      { timeout: 15_000 },
    );
    await waitFor(
      () => expect(timeline).toHaveAttribute("aria-disabled", "false"),
      { timeout: 15_000 },
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Go to the first post" }),
    );
    await expect(
      canvas.getByRole("status", { name: "Loading discussion posts" }),
    ).toBeVisible();
    await expect(
      (
        await canvas.findAllByText(
          "Seeded registry discussion",
          {},
          {
            timeout: 15_000,
          },
        )
      )[0],
    ).toBeVisible();
    await waitFor(() => expect(timeline).toHaveAttribute("aria-valuenow", "1"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Go to the latest post" }),
    );
    await expect(
      canvas.getByRole("status", { name: "Loading discussion posts" }),
    ).toBeVisible();
    await expect(
      await canvas.findByText(/Reply 259:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    await waitFor(
      () => expect(timeline).toHaveAttribute("aria-valuenow", "260"),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <RegistryCommunityLongTimelineStoryHarness
      countLatencyMs={4_000}
      postsPerSecond={2}
    />
  {/snippet}
</Story>

<Story
  name="Approximate discussion count"
  parameters={{
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop" },
  }}
  play={async ({ canvas }) => {
    const community = await canvas.findByRole(
      "region",
      { name: "Registry Demo community discussion" },
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(community).toHaveAttribute(
          "data-comment-total-approximate",
          "true",
        ),
      { timeout: 15_000 },
    );
    await expect(canvas.getByLabelText("Approximately 40 posts")).toBeVisible();
    await expect(
      await canvas.findByText(/Reply 39:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(community).toHaveAttribute(
          "data-comment-total-approximate",
          "true",
        ),
      { timeout: 15_000 },
    );
    const timeline = canvas.getByRole("slider", {
      name: "Discussion position",
    });
    await expect(timeline).toHaveAttribute("aria-disabled", "true");
    await expect(timeline).toHaveAttribute(
      "aria-valuetext",
      "Approximately 40 posts; exact timeline navigation unavailable",
    );
  }}
>
  {#snippet template()}
    <RegistryCommunityLongTimelineStoryHarness
      namespace="approximate-timeline"
      countMode="approximate"
      postCount={40}
    />
  {/snippet}
</Story>

<Story
  name="Unavailable discussion count"
  parameters={{
    layout: "fullscreen",
    viewport: { defaultViewport: "desktop" },
  }}
  play={async ({ canvas }) => {
    const community = await canvas.findByRole(
      "region",
      { name: "Registry Demo community discussion" },
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByText(/Reply 39:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    await expect(community).toHaveAttribute(
      "data-comment-count-available",
      "false",
    );
    await expect(
      canvas.getByLabelText(
        "At least 20 loaded posts; total count unavailable",
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("slider", { name: "Discussion position" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <RegistryCommunityLongTimelineStoryHarness
      namespace="unavailable-timeline"
      countMode="unavailable"
      postCount={40}
    />
  {/snippet}
</Story>
