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
      defaultRelayUrl: "ws://registry.localhost:8281",
      relayUrlSource: "default" as const,
    },
    onSave: fn(async () => {}),
    onReset: fn(async () => {}),
  }}
/>

<Story
  name="Saved relay override"
  args={{
    open: true,
    connection: {
      communityId: "lapis-community",
      name: "Lapis Community",
      relayUrl: "wss://relay-override.example",
      defaultRelayUrl: "ws://registry.localhost:8281",
      relayUrlSource: "override" as const,
    },
    onSave: fn(async () => {}),
    onReset: fn(async () => {}),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByText("Using a saved override.", { exact: false }),
    ).toBeVisible();
    await userEvent.click(
      overlay.getByRole("button", { name: "Use app default" }),
    );
    await expect(args.onReset).toHaveBeenCalledOnce();
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
      defaultRelayUrl: "ws://registry.localhost:8281",
      relayUrlSource: "default" as const,
    },
    cache: {
      mode: "indexeddb" as const,
      approximateBytes: 24_576,
      lastSynchronizedAt: 1_700_000_000,
    },
    onSave: fn(async () => {}),
    onReset: fn(async () => {}),
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
