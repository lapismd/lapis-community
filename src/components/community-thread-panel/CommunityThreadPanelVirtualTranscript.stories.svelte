<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, waitFor } from "storybook/test";

  import AgentConversationHarness from "../../testing/AgentConversationHarness.svelte";
  import {
    agent,
    owner,
    request,
    response,
  } from "../../testing/agent-conversation-fixture.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const messages = [
    {
      id: request.id,
      authorId: owner,
      content: request.content,
      createdAt: new Date(request.created_at * 1_000).toISOString(),
      timestamp: "09:00",
      sourceEvent: request,
    },
    {
      id: response.id,
      authorId: agent,
      parentMessageId: request.id,
      content: response.content,
      createdAt: new Date(response.created_at * 1_000).toISOString(),
      timestamp: "09:01",
      sourceEvent: response,
    },
    ...Array.from({ length: 24 }, (_, index) => ({
      id: `after-transcript-${index}`,
      authorId: index % 2 ? owner : agent,
      parentMessageId: request.id,
      content: `Later reply ${index} with enough content to exercise the compact message estimate.`,
      createdAt: new Date(1_700_000_100_000 + index * 60_000).toISOString(),
      timestamp: "09:02",
    })),
  ];
  const members = [
    {
      id: owner,
      name: "Operator",
      handle: "operator",
      initials: "OP",
      role: "administrator" as const,
    },
    {
      id: agent,
      name: "Nyra",
      handle: "nyra",
      initials: "NY",
      role: "writer" as const,
      isAgent: true,
    },
  ];
  const rooms = [
    {
      id: "room",
      groupId: "room",
      name: "Plugin development",
      kind: "channel" as const,
      unreadCount: 0,
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Virtualized agent transcript keeps its scroll range"
  args={{
    thread: { rootMessageId: request.id, messages },
    members,
    rooms,
    virtualize: true,
    currentMemberId: owner,
    history: { hasOlder: false, loading: false },
    presentation: { key: "story:thread-transcript-estimate", draft: "" },
    onSendReply: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    const content = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="virtual-content"]',
    )!;
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(1_000));
    await waitFor(() =>
      expect(Number.parseFloat(content.style.height)).toBeGreaterThan(2_600),
    );
    const estimatedHeight = Number.parseFloat(content.style.height);

    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -3_000 }));
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-ui-part="virtual-row"][data-index="0"]',
        ),
      ).not.toBeNull(),
    );
    const reasoningCopies = await canvas.findAllByText(
      "Inspecting the README before editing.",
    );
    const visibleReasoning = reasoningCopies.find(
      (copy) => copy.getClientRects().length > 0,
    );
    await expect(visibleReasoning).toBeDefined();
    await expect(visibleReasoning!).toBeVisible();
    await waitFor(() =>
      expect(
        Math.abs(Number.parseFloat(content.style.height) - estimatedHeight),
      ).toBeLessThanOrEqual(48),
    );
  }}
>
  {#snippet template(args)}<AgentConversationHarness>
      <div
        style="width: min(100%, 30rem); height: 34rem; border: 1px solid var(--border);"
      >
        <CommunityThreadPanel {...args} />
      </div>
    </AgentConversationHarness>{/snippet}
</Story>
