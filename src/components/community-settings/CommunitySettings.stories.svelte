<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import type { CommunityController } from "../../community/index.js";

  import CommunitySettings from "./CommunitySettings.svelte";
  import CommunityNavigationShellFixture from "../community-navigation/CommunityNavigationShellFixture.svelte";
  let personalController: CommunityController | undefined;

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
    const edit = canvas.getByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toBeEnabled());
    await userEvent.click(edit);

    const displayName = canvas.getByRole("textbox", {
      name: "Display name",
    });
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "Steve Updated");
    await waitFor(() =>
      expect(personalController?.state.presence?.status).toBe("ready"),
    );
    const beforePresence = personalController!.state;
    await personalController!.actions.setPresencePreference!("away");
    expect(personalController!.state).toBe(beforePresence);
    await expect(displayName).toBeInTheDocument();
    await expect(displayName).toHaveValue("Steve Updated");
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
    await userEvent.click(
      await within(document.body).findByRole("tab", { name: "Emoji" }),
    );
    await userEvent.click(
      within(document.body).getByRole("button", { name: "Use 🐝 as avatar" }),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      const image = canvas.getByRole("img", {
        name: "Selected avatar",
      }) as HTMLImageElement;
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
    <CommunityNavigationShellFixture
      initialActiveItemId="settings"
      onControllerReady={(controller) => {
        personalController = controller;
      }}
    />
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
