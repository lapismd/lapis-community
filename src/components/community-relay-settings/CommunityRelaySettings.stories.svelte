<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityRelaySettings from "./CommunityRelaySettings.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Community Settings",
    component: CommunityRelaySettings,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityRelaySettings
  bind:open
  connection={community.state.connections[0]}
  operation={community.state.operations[\"settings:relay:lapis-community\"]}
  onSave={(relayUrl) =>
    community.actions.updateRelayUrl(\"lapis-community\", relayUrl)}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Relay URL"
  args={{
    open: true,
    connection: {
      communityId: "lapis-community",
      name: "Lapis Community",
      relayUrl: "ws://registry.localhost:8281",
    },
    onSave: fn(async () => {}),
  }}
/>

<Story
  name="Clear cache confirmation"
  args={{
    open: true,
    connection: {
      communityId: "lapis-community",
      name: "Lapis Community",
      relayUrl: "ws://registry.localhost:8281",
    },
    cache: {
      mode: "indexeddb" as const,
      approximateBytes: 24_576,
      lastSynchronizedAt: 1_700_000_000,
    },
    onSave: fn(async () => {}),
    onClearCache: fn(async () => {}),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const document = canvasElement.ownerDocument;
    const overlay = within(document.body);
    await userEvent.click(overlay.getByRole("button", { name: "Clear cache" }));
    const dialog = await overlay.findByRole("alertdialog", {
      name: "Clear local community data?",
    });
    await expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(448);
    await expect(dialog.getBoundingClientRect().width).toBeLessThan(
      canvasElement.ownerDocument.documentElement.clientWidth,
    );
    const destructiveProbe = document.createElement("span");
    destructiveProbe.style.color = "var(--destructive)";
    document.body.append(destructiveProbe);
    const destructiveColor = getComputedStyle(destructiveProbe).color;
    destructiveProbe.remove();
    await expect(
      getComputedStyle(
        within(dialog).getByRole("button", { name: "Clear cache" }),
      ).backgroundColor,
    ).toBe(destructiveColor);
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await expect(args.onClearCache).not.toHaveBeenCalled();
  }}
/>
