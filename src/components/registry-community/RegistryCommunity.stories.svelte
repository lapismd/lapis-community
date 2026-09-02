<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import RegistryCommunity from "./RegistryCommunity.svelte";
  import RegistryCommunityStoryHarness from "./RegistryCommunityStoryHarness.svelte";

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
    const runtime = await canvas.findByTestId("registry-community-runtime");
    await expect(runtime).toHaveAttribute(
      "data-community-backend",
      expect.stringMatching(/^(memory|docker|live)$/u),
    );
    if (runtime.dataset.communityBackend === "live") return;

    await expect(
      await canvas.findByText("Registry Demo community discussion"),
    ).toBeVisible();
    await expect(
      await canvas.findByText("Seeded registry discussion"),
    ).toBeVisible();
    await expect(
      canvas.getByText("The shared controller boundary keeps this portable."),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        canvas.queryByRole("button", { name: "Connect Nostr" }),
      ).toBeNull();
    });

    const composer = canvas.getByRole("textbox", {
      name: "Add to the discussion",
    });
    await userEvent.type(composer, "Published through the shared relay source");
    await userEvent.click(
      canvas.getByRole("button", { name: "Publish comment" }),
    );
    await expect(
      await canvas.findByText("Published through the shared relay source"),
    ).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Comment published",
    );
  }}
>
  {#snippet template()}
    <RegistryCommunityStoryHarness />
  {/snippet}
</Story>
