<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityMemberHoverCard from "./CommunityMemberHoverCard.svelte";
  import CommunityMemberHoverCardPresenceStoryHarness from "./CommunityMemberHoverCardPresenceStoryHarness.svelte";

  const member = communityStoryMembers[1]!;
  const { Story } = defineMeta({
    title: "Community/Members/Hover Card",
    component: CommunityMemberHoverCard,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Contact actions"
  args={{
    member,
    avatarShape: "rounded",
    onOpenProfile: fn(),
    onViewActivity: fn(),
    onMessage: fn(),
    onWave: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const avatar = canvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });
    await userEvent.hover(avatar);
    const preview = await page.findByRole("group", {
      name: "Ben Stone contact preview",
    });
    await expect(preview).toBeVisible();
    await expect(avatar.querySelector("[data-shape]")).toHaveAttribute(
      "data-shape",
      "rounded",
    );
    await userEvent.click(
      page.getByRole("button", { name: "View activity log for Ben Stone" }),
    );
    await expect(args.onViewActivity).toHaveBeenCalledWith(member);
    await userEvent.click(
      page.getByRole("button", { name: "Message Ben Stone" }),
    );
    await expect(args.onMessage).toHaveBeenCalledWith(member);
    await userEvent.click(
      page.getByRole("button", { name: "Wave to Ben Stone" }),
    );
    await expect(args.onWave).toHaveBeenCalledWith(member);
    await userEvent.click(avatar);
    await expect(args.onOpenProfile).toHaveBeenCalledWith(member);
  }}
>
  {#snippet template(args)}
    <div style="min-height: 18rem; padding: 4rem;">
      <CommunityMemberHoverCard {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Mention trigger"
  args={{
    member: {
      ...member,
      presence: "offline",
      avatarUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%232563eb'/%3E%3Ccircle cx='32' cy='25' r='12' fill='white'/%3E%3Cpath d='M12 62c2-15 10-23 20-23s18 8 20 23' fill='white'/%3E%3C/svg%3E",
    },
    trigger: "mention",
    triggerLabel: "@Ben Stone",
    onOpenProfile: fn(),
    openDelay: 120,
  }}
  play={async ({ canvas, canvasElement }) => {
    const mention = canvas.getByRole("button", { name: "Ben Stone" });
    const avatar = mention.querySelector<HTMLElement>(
      '[data-ui-component="community-member-avatar"]',
    )!;
    const image = avatar.querySelector("img")!;
    const label = within(mention).getByText("Ben Stone");
    const prefix = canvas.getByTestId("mention-prefix");
    await waitFor(() => expect(image.complete).toBe(true));
    const labelRange = label.ownerDocument.createRange();
    labelRange.selectNodeContents(label);
    const prefixRange = prefix.ownerDocument.createRange();
    prefixRange.selectNodeContents(prefix);
    await expect(mention).not.toHaveTextContent("@Ben Stone");
    await expect(
      Math.abs(
        prefixRange.getBoundingClientRect().bottom -
          labelRange.getBoundingClientRect().bottom,
      ),
    ).toBeLessThan(1);
    await expect(
      Math.abs(
        mention.getBoundingClientRect().top +
          mention.getBoundingClientRect().height / 2 -
          (avatar.getBoundingClientRect().top +
            avatar.getBoundingClientRect().height / 2),
      ),
    ).toBeLessThan(1);
    await expect(image.getBoundingClientRect().width).toBe(
      avatar.getBoundingClientRect().width,
    );
    await expect(image.getBoundingClientRect().height).toBe(
      avatar.getBoundingClientRect().height,
    );
    await userEvent.hover(mention);
    const preview = await within(canvasElement.ownerDocument.body).findByRole(
      "group",
      { name: "Ben Stone contact preview" },
    );
    await expect(
      preview.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "online");
  }}
>
  {#snippet template(args)}
    <p style="min-height: 18rem; padding: 4rem;">
      <span data-testid="mention-prefix">Ask</span>
      <CommunityMemberHoverCardPresenceStoryHarness
        member={args.member}
        trigger={args.trigger}
        triggerLabel={args.triggerLabel}
      /> to review this message.
    </p>
  {/snippet}
</Story>

<Story
  name="Current member presence"
  args={{
    member: { ...member, presence: "offline" },
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const avatar = canvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });
    await userEvent.hover(avatar);
    const avatarPreview = await page.findByRole("group", {
      name: "Ben Stone contact preview",
    });
    await expect(
      avatarPreview.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "online");
  }}
>
  {#snippet template(args)}
    <div style="min-height: 18rem; padding: 4rem;">
      <CommunityMemberHoverCardPresenceStoryHarness member={args.member} />
    </div>
  {/snippet}
</Story>

<Story
  name="Escape dismisses during pointer interaction"
  args={{ member, trigger: "mention", openDelay: 0 }}
  play={async ({ canvas, canvasElement }) => {
    const document = canvasElement.ownerDocument;
    await userEvent.hover(canvas.getByRole("button", { name: "Ben Stone" }));
    const preview = await within(document.body).findByRole("group", {
      name: "Ben Stone contact preview",
    });
    await userEvent.pointer({
      target: within(preview).getByText("Ben Stone"),
      keys: "[MouseLeft>]",
    });
    try {
      // Escape is explicit dismissal even while a pointer interaction is active.
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(preview).not.toBeVisible());
    } finally {
      await userEvent.pointer({ keys: "[/MouseLeft]" });
    }
  }}
/>

<Story
  name="Unavailable default actions"
  args={{ member }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.hover(
      canvas.getByRole("button", { name: "View Ben Stone's profile" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByRole("button", { name: "Message Ben Stone" }),
    ).toBeDisabled();
    await expect(
      body.getByRole("button", { name: "Wave to Ben Stone" }),
    ).toBeDisabled();
  }}
/>

<Story
  name="Prefixed handle"
  args={{
    member: { ...member, handle: "@benstone" },
    openDelay: 120,
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.hover(
      canvas.getByRole("button", { name: "View Ben Stone's profile" }),
    );
    const preview = await within(canvasElement.ownerDocument.body).findByRole(
      "group",
      { name: "Ben Stone contact preview" },
    );
    await expect(
      within(preview).getByText("@benstone", { exact: true }),
    ).toBeVisible();
    await expect(
      within(preview).queryByText("@@benstone", { exact: true }),
    ).toBeNull();
  }}
>
  {#snippet template(args)}
    <div style="min-height: 18rem; padding: 4rem;">
      <CommunityMemberHoverCard {...args} />
    </div>
  {/snippet}
</Story>
