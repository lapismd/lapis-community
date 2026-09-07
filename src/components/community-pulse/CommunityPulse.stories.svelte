<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";

  import CommunityPulse from "./CommunityPulse.svelte";
  import CommunityPulseStoryHarness from "./CommunityPulseStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import {
    CommunityPulse,
    type CommunityPulseModel,
  } from "@lapismd/lapis-community/components";

  let { model }: { model: CommunityPulseModel } = $props();
<\/script>

<CommunityPulse
  {model}
  currentMember={signedInMember}
  onSelectTab={(tab) => pulse.selectTab(tab)}
  onPublish={(submission, replyToEventId) =>
    pulse.publish(submission, replyToEventId)}
  onToggleLike={(eventId) => pulse.toggleLike(eventId)}
  onShare={shareNote}
  onOpenProfile={openProfile}
  onMessageMember={startDirectMessage}
/>`;

  const { Story } = defineMeta({
    title: "Community/Pulse/Pulse",
    component: CommunityPulse,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "A Buzz-inspired public note feed with a compact composer, personal tabs, agent activity grouping, replies, reactions, sharing, and member actions.",
        },
      },
    },
  });
</script>

<Story
  name="Everyone"
  play={async ({ canvas }) => {
    const runtime = canvas.getByTestId("community-pulse-story");
    const avaActions = canvas.getByLabelText("Actions for Ava Chen's note");

    await expect(
      canvas.getByText("Pulse", { selector: "strong" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("group", { name: "Pulse composer" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Pulse composer" }),
    );
    await expect(
      canvas.getByRole("group", { name: "Pulse composer" }),
    ).toBeVisible();
    await userEvent.click(runtime);
    await expect(
      canvas.queryByRole("group", { name: "Pulse composer" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Pulse composer" }),
    );
    const composer = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.type(composer, "A new Pulse note");
    await userEvent.click(canvas.getByRole("button", { name: "Post note" }));
    await expect(canvas.getByText("A new Pulse note")).toBeVisible();

    await userEvent.click(
      within(avaActions).getByRole("button", {
        name: "Unlike Ava Chen's note",
      }),
    );
    await expect(runtime).toHaveAttribute(
      "data-last-action",
      `liked:${"a".repeat(64)}`,
    );

    await userEvent.click(
      within(avaActions).getByRole("button", {
        name: "Reply to Ava Chen's note",
      }),
    );
    await expect(
      canvas.getByRole("group", { name: "Reply to Ava Chen" }),
    ).toBeVisible();
    const replyComposer = canvas.getByRole("group", {
      name: "Reply to Ava Chen",
    });
    await userEvent.type(
      within(replyComposer).getByRole("textbox", { name: "Markdown editor" }),
      "A thoughtful reply",
    );
    await userEvent.click(
      within(replyComposer).getByRole("button", { name: "Post reply" }),
    );
    await expect(canvas.getByText("A thoughtful reply")).toBeVisible();

    const avaNote = canvas.getByRole("article", { name: "Ava Chen" });
    const parentProfileTrigger = within(avaNote).getByRole("button", {
      name: "View Steve's profile",
    });
    await expect(parentProfileTrigger).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
    await userEvent.click(
      within(avaNote).getByRole("button", { name: "Ava Chen" }),
    );
    await expect(runtime).toHaveAttribute(
      "data-last-action",
      `profile:${"2".repeat(64)}`,
    );

    await userEvent.click(
      within(avaActions).getByRole("button", {
        name: "Share Ava Chen's note",
      }),
    );
    await expect(runtime).toHaveAttribute(
      "data-last-action",
      `shared:${"a".repeat(64)}`,
    );
    await userEvent.click(
      within(avaActions).getByRole("button", {
        name: "Start DM with Ava Chen",
      }),
    );
    await expect(runtime).toHaveAttribute(
      "data-last-action",
      `dm:${"2".repeat(64)}`,
    );

    await userEvent.click(canvas.getByRole("tab", { name: "Search Pulse" }));
    await expect(
      canvas.getByRole("heading", { name: "What are you looking for?" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("textbox", { name: "Search Pulse" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityPulseStoryHarness />
  {/snippet}
</Story>

<Story
  name="Personal and agent feeds"
  play={async ({ canvas }) => {
    for (const tab of ["Following", "Liked", "Mine", "Agents"]) {
      await userEvent.click(
        canvas.getByRole("tab", {
          name: tab === "Agents" ? /^Agents/u : tab,
        }),
      );
      await expect(canvas.getByTestId("community-pulse-story")).toHaveAttribute(
        "data-last-action",
        `tab:${tab.toLocaleLowerCase()}`,
      );
    }
    await expect(canvas.getByText("Noor Automations")).toBeVisible();
    await expect(
      canvas.queryByRole("group", { name: "Pulse composer" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityPulseStoryHarness />
  {/snippet}
</Story>

<Story name="Initial loading">
  {#snippet template()}
    <CommunityPulseStoryHarness feedState="loading" />
  {/snippet}
</Story>

<Story name="Empty agent directory">
  {#snippet template()}
    <CommunityPulseStoryHarness
      initialTab="agents"
      feedState="empty"
      agentDirectory="empty"
    />
  {/snippet}
</Story>

<Story
  name="Relay error"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The relay paused this Pulse request.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(canvas.getByTestId("community-pulse-story")).toHaveAttribute(
      "data-last-action",
      "retried",
    );
  }}
>
  {#snippet template()}
    <CommunityPulseStoryHarness feedState="error" />
  {/snippet}
</Story>

<Story name="Agents omitted">
  {#snippet template()}
    <CommunityPulseStoryHarness agentDirectory="absent" />
  {/snippet}
</Story>

<Story
  name="Responsive"
  globals={{ viewport: { value: "mobile1", isRotated: false } }}
>
  {#snippet template()}
    <CommunityPulseStoryHarness agentDirectory="absent" />
  {/snippet}
</Story>
