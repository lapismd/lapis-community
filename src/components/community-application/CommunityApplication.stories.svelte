<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import CommunityApplicationCacheStoryHarness from "./CommunityApplicationCacheStoryHarness.svelte";

  const consumerSource = `<script lang="ts">
  import { onMount } from "svelte";
  import {
    CommunityApplication,
    RegistryCommunity,
  } from "@lapismd/lapis-community/components";
  import { createNip29RegistryCatalogDataSource } from "@lapismd/lapis-community/registry";
  import {
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
    createCommunityController,
    createNip29CommunitySource,
  } from "@lapismd/lapis-community/community";
  import { createWebSocketCommunityRelayFactory } from "@lapismd/lapis-community/nostr";

  const relayFactory = createWebSocketCommunityRelayFactory();

  const community = createCommunityController({
    scopes,
    identity,
    stateStore,
    source: createNip29CommunitySource({
      relayFactory,
    }),
    configurationStore: createBrowserCommunityConfigurationStore(),
    runtime: createBrowserCommunityEventRuntime(),
  });
  const registrySource = createNip29RegistryCatalogDataSource({
    relays: registryRelays,
    authorities: registryAuthorities,
    relayFactory,
    blossomUrl: registryBlossomUrl,
  });

  onMount(() => {
    community.initialize();
    return () => {
      registrySource.dispose();
      community.dispose();
    };
  });
<\/script>

{#snippet registryDiscussion()}
    <RegistryCommunity
      plugin={selectedPlugin}
      name={selectedPluginName}
      version={selectedVersion}
      publisher={publisher}
      relays={JSON.stringify(relays)}
    />
{/snippet}

<CommunityApplication
  controller={community}
  extensions={{ activityLog: openMemberActivityLog }}
  registryOptions={{
    source: registrySource,
    discussion: registryDiscussion,
    installActions,
    onInstall: installPlugin,
  }}
/>`;

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        story: { inline: false, iframeHeight: 700 },
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "The near-final application composition: one controller-backed shell for Inbox, Registry, independently scrolling channels, forums, direct messages, settings, profile identity, history, fixed composers, reaction summaries, threads, and detail panels.",
        },
      },
    },
  });
</script>

<Story name="Cached startup offline">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="cached-offline" />
  {/snippet}
</Story>

<Story
  name="Cold cache offline"
  play={async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Registry" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="cold-offline" />
  {/snippet}
</Story>

<Story name="Degraded persistent storage">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="degraded" />
  {/snippet}
</Story>

<Story name="Mid-session disconnect">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="mid-session-disconnect" />
  {/snippet}
</Story>

<Story name="Reconnect from cache">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="reconnect" />
  {/snippet}
</Story>

<Story
  name="Registry configuration required"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole("heading", {
        name: "Plugin registry is not configured",
      }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness
      scenario="cold-offline"
      initialDestination="registry"
      registryConfigured={false}
    />
  {/snippet}
</Story>

<Story
  name="Logged out"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      await canvas.findByRole("button", { name: "Registry" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Connect to Nostr" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Registry" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for Guest" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Update your status" }),
    );
    const dialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    await expect(dialog).toBeVisible();
    const login = within(dialog);
    await expect(
      login.getByRole("button", { name: /Browser extension/u }),
    ).toBeVisible();
    await expect(
      login.getByRole("button", { name: /Remote signer/u }),
    ).toBeVisible();
    await expect(
      login.getByRole("button", { name: /Create a new account/u }),
    ).toBeVisible();
    await expect(
      login.getByRole("button", { name: /Paste a private key/u }),
    ).toBeVisible();
    await userEvent.click(login.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness signedIn={false} />
  {/snippet}
</Story>

<Story
  name="Login transition"
  play={async ({ canvas, canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Open profile menu for Guest",
      }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Update your status" }),
    );
    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    await userEvent.click(
      within(loginDialog).getByRole("button", { name: /Remote signer/u }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    const statusDialog = await overlay.findByRole("dialog", {
      name: "Update your status",
    });
    await expect(statusDialog).toBeVisible();
    await userEvent.click(
      within(statusDialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(statusDialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness signedIn={false} />
  {/snippet}
</Story>

<Story
  name="Discovery and search"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend === "live") return;

    const overlay = within(canvasElement.ownerDocument.body);
    const searchTrigger = canvas.getByRole("button", {
      name: "Search community",
    });
    const waitForSearchTrigger = async (): Promise<void> => {
      await waitFor(() =>
        expect(getComputedStyle(searchTrigger).pointerEvents).not.toBe("none"),
      );
    };
    await expect(searchTrigger.tagName).toBe("BUTTON");
    await userEvent.click(searchTrigger);

    let searchDialog = await overlay.findByRole("dialog", {
      name: "Search community",
    });
    await expect(
      within(searchDialog).getByRole("option", { name: "Browse channels" }),
    ).toBeVisible();
    await userEvent.click(
      within(searchDialog).getByRole("option", { name: "Browse channels" }),
    );

    const roomBrowser = await overlay.findByRole("dialog", {
      name: "Browse channels",
    });
    await expect(
      within(roomBrowser).getByLabelText("Search channels"),
    ).toBeVisible();
    await expect(
      within(roomBrowser).getByRole("button", {
        name: "Sort channels by A to Z",
      }),
    ).toBeVisible();
    await expect(
      within(roomBrowser).getByRole("tab", { name: "All channels" }),
    ).toBeVisible();
    await userEvent.click(
      within(roomBrowser).getByRole("button", {
        name: "Create a new channel",
      }),
    );
    const roomEditor = await overlay.findByRole("dialog", {
      name: "Create channel",
    });
    await userEvent.click(
      within(roomEditor).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(roomEditor).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await waitForSearchTrigger();

    await userEvent.click(searchTrigger);
    searchDialog = await overlay.findByRole("dialog", {
      name: "Search community",
    });
    let searchInput = within(searchDialog).getByLabelText("Search community");
    await userEvent.type(searchInput, "portable");
    await userEvent.click(
      await within(searchDialog).findByRole("option", {
        name: /How should portable forums work/u,
      }),
    );
    await waitFor(() => expect(searchDialog).not.toBeInTheDocument());
    await waitFor(() => {
      expect(
        application.querySelector('[data-ui-part="room-title"]'),
      ).toHaveTextContent("support");
    });
    await expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();
    const forumToolbar = canvas.getByLabelText("support toolbar");
    await expect(
      forumToolbar.querySelector('[data-ui-part="room-kind-icon"]'),
    ).not.toBeNull();
    let backToPosts = await canvas.findByRole("button", {
      name: "Back to posts",
    });
    await expect(
      backToPosts.getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(forumToolbar.getBoundingClientRect().bottom);
    await expect(
      backToPosts.getBoundingClientRect().top -
        forumToolbar.getBoundingClientRect().bottom,
    ).toBeLessThan(80);
    await waitForSearchTrigger();
    await userEvent.click(searchTrigger);
    searchDialog = await overlay.findByRole("dialog", {
      name: "Search community",
    });
    await userEvent.click(
      within(searchDialog).getByRole("option", {
        name: /Search in #support/u,
      }),
    );
    searchDialog = await overlay.findByRole("dialog", {
      name: "Search in #support",
    });
    searchInput = within(searchDialog).getByLabelText("Search in #support");
    await userEvent.type(searchInput, "URLs");
    await userEvent.click(
      await within(searchDialog).findByRole("option", {
        name: /Portable forum URLs should retain relay and group identity/u,
      }),
    );
    await waitFor(() => expect(searchDialog).not.toBeInTheDocument());
    await expect(
      canvas.getByText("How should portable forums work?"),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "Agreed. The reply and activity columns should stay aligned.",
      ),
    ).toBeVisible();
    backToPosts = await canvas.findByRole("button", {
      name: "Back to posts",
    });
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(backToPosts);
    const newPost = await canvas.findByRole("button", {
      name: "Start a new post in support",
    });
    await userEvent.click(newPost);
    await expect(
      canvas.getByRole("combobox", { name: "Message" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    await userEvent.click(searchTrigger);
    searchDialog = await overlay.findByRole("dialog", {
      name: "Search community",
    });
    searchInput = within(searchDialog).getByLabelText("Search community");
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "Member");
    const memberResults = await within(searchDialog).findAllByRole("option", {
      name: /Member/u,
    });
    const directMessageResult = memberResults.find((result) =>
      result.textContent?.includes("Direct message"),
    );
    if (!directMessageResult)
      throw new Error("Expected the direct-message search result");
    await userEvent.click(directMessageResult);
    await waitFor(() => {
      expect(
        application.querySelector('[data-ui-part="room-title"]'),
      ).toHaveTextContent("Member");
    });
    await expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();
    const directMessageNavigation = canvas.getByRole("button", {
      name: "Member",
    });
    await expect(
      directMessageNavigation.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).not.toBeNull();
    await expect(
      directMessageNavigation.querySelector('[data-ui-part="presence"]'),
    ).not.toBeNull();
    await expect(
      application
        .querySelector('[data-ui-part="room-title"]')
        ?.querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();
    const directMessageToolbar = canvas.getByLabelText("Member toolbar");
    await expect(
      parseFloat(getComputedStyle(directMessageToolbar).paddingBlockStart),
    ).toBeGreaterThanOrEqual(10);
    await expect(
      canvas.getByText(
        "This is the beginning of your direct message with Member.",
      ),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness />
  {/snippet}
</Story>

<Story
  name="Full community app"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Registry" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getAllByRole("button", { name: /Plugins/u })[0]!,
    );
    await expect(await canvas.findByText("8 results")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(await canvas.findByText("8 results")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await expect(await canvas.findByText("8 results")).toBeVisible();
    const application = canvas.getByTestId("full-community-application");
    const shell = application.querySelector<HTMLElement>(
      "[data-right-sidebar-state]",
    );
    if (!shell) throw new Error("Expected the application shell state element");
    const rightSidebars = (): NodeListOf<HTMLElement> =>
      canvasElement.querySelectorAll<HTMLElement>('aside[data-side="right"]');
    const expectRightPanel = async (
      label: "Channel settings sidebar" | "Thread sidebar" | "Profile sidebar",
    ): Promise<HTMLElement> => {
      const sidebar = await canvas.findByLabelText(label);
      await expect(sidebar).toBeVisible();
      await expect(rightSidebars()).toHaveLength(1);
      await expect(shell).toHaveAttribute(
        "data-right-sidebar-state",
        "expanded",
      );
      return sidebar;
    };
    const expectNoRightPanel = async (): Promise<void> => {
      await waitFor(() => expect(rightSidebars()).toHaveLength(0));
      await expect(shell).toHaveAttribute("data-right-sidebar-state", "closed");
    };

    if (application.dataset.communityBackend === "live") {
      await expectNoRightPanel();
      return;
    }

    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "Manage channel" }),
    );
    await expectRightPanel("Channel settings sidebar");

    await fireEvent.click(
      canvas.getAllByRole("button", { name: "Reply in thread" })[0]!,
    );
    let threadSidebar = await expectRightPanel("Thread sidebar");
    await waitFor(
      () =>
        expect(
          within(threadSidebar).getByRole("group", {
            name: /^Replying to /u,
          }),
        ).toBeVisible(),
      { timeout: 15_000 },
    );
    await expect(threadSidebar.getBoundingClientRect().width).toBeGreaterThan(
      200,
    );
    const roomTitle = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="room-title"]',
    );
    const sidebarTitle = within(threadSidebar).getByText("Thread");
    await expect(roomTitle).not.toBeNull();
    await expect(getComputedStyle(sidebarTitle).fontSize).toBe(
      getComputedStyle(roomTitle!).fontSize,
    );
    await expect(
      within(threadSidebar).queryByLabelText(/^Thread from /u),
    ).toBeNull();
    await expect(
      within(threadSidebar).getByText(/^Reply in thread to /u),
    ).toBeVisible();

    await fireEvent.click(
      within(threadSidebar).getAllByRole("button", {
        name: /^View .+'s profile$/u,
      })[0]!,
    );
    await expectRightPanel("Profile sidebar");
    await expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    threadSidebar = await expectRightPanel("Thread sidebar");
    await waitFor(
      () =>
        expect(
          within(threadSidebar).getByRole("group", {
            name: /^Replying to /u,
          }),
        ).toBeVisible(),
      { timeout: 15_000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expectRightPanel("Channel settings sidebar");
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await expectRightPanel("Thread sidebar");
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    const profileSidebar = await expectRightPanel("Profile sidebar");

    await userEvent.click(
      within(profileSidebar).getByRole("button", { name: /Close/u }),
    );
    await expect(application).toHaveAttribute(
      "data-last-action",
      "closed-side-panel",
    );
    await expectNoRightPanel();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expectRightPanel("Profile sidebar");

    await fireEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    await fireEvent.click(
      canvas.getAllByRole("button", { name: "Reply in thread" })[0]!,
    );
    await expectRightPanel("Thread sidebar");
    await expect(canvas.queryByLabelText("Profile sidebar")).toBeNull();
    await expect(
      canvas.queryByLabelText("Channel settings sidebar"),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Registry" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await expectNoRightPanel();

    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expectRightPanel("Thread sidebar");
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await expectNoRightPanel();

    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open general menu" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Settings" }),
    );
    await expectRightPanel("Channel settings sidebar");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await expectNoRightPanel();
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await expectRightPanel("Channel settings sidebar");

    await userEvent.click(canvas.getByRole("button", { name: "Inbox" }));
    await expectNoRightPanel();
    await fireEvent.click(
      canvas.getAllByRole("button", { name: "Reply in thread" })[0]!,
    );
    await expect(
      await canvas.findByRole("group", { name: /^Replying to /u }),
    ).toBeVisible();
    await expectNoRightPanel();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness />
  {/snippet}
</Story>

<Story
  name="Responsive app shell"
  parameters={{ viewport: { defaultViewport: "tablet" } }}
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await waitFor(
      () => {
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        );
      },
      { timeout: 15_000 },
    );

    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    const mobileStage = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-stage"]',
    );
    const mainLane = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-main-lane"]',
    );
    const leftLane = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-lane"][data-side="left"]',
    );
    const rightLane = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-lane"][data-side="right"]',
    );
    if (!shell || !mobileStage || !mainLane || !leftLane || !rightLane) {
      throw new Error("Expected the responsive App Shell lanes");
    }

    const expectedDisplayMode =
      application.getBoundingClientRect().width < 1024 ? "mobile" : "desktop";
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-display-mode", expectedDisplayMode);
    });
    await expect(canvasElement.ownerDocument.body.scrollWidth).toBe(
      canvasElement.ownerDocument.body.clientWidth,
    );
    if (expectedDisplayMode === "desktop") return;

    await expect(shell).toHaveAttribute("data-mobile-stage", "main");
    await expect(mainLane).not.toHaveAttribute("aria-hidden", "true");
    await expect(leftLane).toHaveAttribute("aria-hidden", "true");
    await expect(rightLane).toHaveAttribute("aria-hidden", "true");
    await expect(
      canvas.queryByRole("navigation", { name: "Application navigation" }),
    ).not.toBeInTheDocument();

    const navigationToggle = canvas.getByRole("button", {
      name: "Open navigation sidebar",
    });
    const mainToolbar = navigationToggle.closest<HTMLElement>(
      '[data-ui-part="toolbar"]',
    );
    if (!mainToolbar)
      throw new Error("Expected mobile navigation in the main toolbar");
    const mainToolbarButtons = within(mainToolbar).getAllByRole("button");
    await expect(mainToolbarButtons[0]).toBe(navigationToggle);
    await expect(mainToolbarButtons[1]).toHaveAccessibleName("Back");
    await expect(mainToolbarButtons[2]).toHaveAccessibleName("Forward");
    await userEvent.click(navigationToggle);
    await expect(shell).toHaveAttribute("data-mobile-stage", "left");
    await expect(leftLane).not.toHaveAttribute("aria-hidden", "true");
    await expect(mainLane).toHaveAttribute("aria-hidden", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
      expect(navigationToggle).toHaveFocus();
    });

    await userEvent.click(navigationToggle);
    await userEvent.click(canvas.getByRole("button", { name: "general" }));
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
    });
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "#general" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();

    if (application.dataset.communityBackend === "live") return;

    const replyButton = canvas.getAllByRole("button", {
      name: "Reply in thread",
    })[0];
    if (!replyButton) throw new Error("Expected a thread reply control");
    const message = canvas.getAllByRole("article", {
      name: /^Message from /u,
    })[0];
    if (!message) throw new Error("Expected a message to open in a thread");
    await userEvent.hover(message);
    await waitFor(() => expect(replyButton).toBeVisible());
    await userEvent.click(replyButton);
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-mobile-stage", "right");
      expect(mobileStage.scrollLeft).toBe(0);
    });
    const threadSidebar = await canvas.findByLabelText("Thread sidebar");
    await expect(threadSidebar).toBeVisible();
    await expect(rightLane).not.toHaveAttribute("aria-hidden", "true");
    await expect(mainLane).toHaveAttribute("aria-hidden", "true");
    await expect(
      within(threadSidebar).getByRole("combobox", { name: "Message" }),
    ).toBeVisible();

    const closeRightLane = canvasElement.querySelector<HTMLButtonElement>(
      '[data-ui-part="mobile-stage-dismiss"][data-side="right"]',
    );
    if (!closeRightLane)
      throw new Error("Expected the mobile right-lane close");
    await userEvent.click(closeRightLane);
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
      expect(replyButton).toHaveFocus();
    });
    await expect(mainLane).not.toHaveAttribute("aria-hidden", "true");
    await expect(rightLane).toHaveAttribute("aria-hidden", "true");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness responsive />
  {/snippet}
</Story>
