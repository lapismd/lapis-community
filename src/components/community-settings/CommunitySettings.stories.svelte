<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunitySettings from "./CommunitySettings.svelte";
  import CommunityNavigationShellFixture from "../community-navigation/CommunityNavigationShellFixture.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Settings",
    component: CommunitySettings,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<AppShell.Sidebar side="left">
  <CommunitySettingsNavigation
    section={settingsSection}
    onSelect={(section) => settingsSection = section}
    onClose={closeSettings}
  />
</AppShell.Sidebar>

<AppShell.Main>
  <CommunitySettings
    model={community.state.settings}
    section={settingsSection}
    profileOperation={community.state.operations["settings:profile"]}
    onUpdateProfile={community.actions.updateProfile}
    onAddCustomEmoji={community.actions.setCustomEmoji}
    onRemoveCustomEmoji={community.actions.removeCustomEmoji}
  />
</AppShell.Main>`,
        },
      },
    },
  });
</script>

<Story
  name="Personal settings"
  play={async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Profile" });
    await userEvent.click(canvas.getByRole("button", { name: "Edit" }));

    const displayName = canvas.getByRole("textbox", {
      name: "Display name",
    });
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "Steve Updated");
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(
        canvas.queryByRole("textbox", { name: "Display name" }),
      ).not.toBeInTheDocument();
      expect(canvas.getByText("Steve Updated")).toBeVisible();
    });

    await userEvent.click(
      canvas.getByRole("button", { name: "Edit profile photo" }),
    );
    await userEvent.click(await canvas.findByRole("tab", { name: "Emoji" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Use 🐝 as profile photo" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      const image = canvas
        .getByRole("img", { name: "Profile photo" })
        .querySelector("img");
      expect(image?.src).toContain("data:image/svg+xml");
    });

    const identitySummary = canvas
      .getByText("Identity details")
      .closest("summary")!;
    const identityDetails = identitySummary.closest("details")!;
    const identityChevron = identitySummary.querySelector(
      ".community-settings__identity-chevron",
    )!;
    expect(identityDetails.open).toBe(false);
    expect(getComputedStyle(identityChevron).transform).toBe("none");
    await userEvent.click(identitySummary);
    expect(identityDetails.open).toBe(true);
    await waitFor(() =>
      expect(getComputedStyle(identityChevron).transform).not.toBe("none"),
    );
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture initialActiveItemId="settings" />
  {/snippet}
</Story>

<Story
  name="Custom emoji"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Custom emoji" }),
    );
    await canvas.findByRole("heading", { name: "Custom emoji" });
    const rows = canvasElement.querySelectorAll(
      '[data-ui-part="custom-emoji-row"]',
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const description = row.children.item(0)?.getBoundingClientRect();
      const control = row.children.item(1)?.getBoundingClientRect();
      expect(description).toBeDefined();
      expect(control).toBeDefined();
      expect(control!.left).toBeGreaterThan(description!.right);
    }
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture initialActiveItemId="settings" />
  {/snippet}
</Story>
