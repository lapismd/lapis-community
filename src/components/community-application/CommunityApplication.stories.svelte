<script module lang="ts">
  import { linkedSignerNavigation } from "../../testing/application-signin-story.js";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { toast } from "svelte-sonner";
  import { tick } from "svelte";
  import {
    expect,
    fireEvent,
    fn,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import CommunityApplicationCacheStoryHarness from "./CommunityApplicationCacheStoryHarness.svelte";
  import {
    COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
    COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
    projectDestinationFromCoordinate,
    projectRouteToHash,
  } from "./navigation.js";
  import {
    projectStoryProjectCoordinate,
    projectStoryRepositoryCoordinate,
  } from "../community-projects/story-fixtures.js";

  let navigationPresentationReads = 0;
  let inboxPresentationReads = 0;

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
            "The near-final application composition: one controller-backed shell for Inbox, Pulse, Registry, independently scrolling channels, forums, direct messages, settings, profile identity, history, fixed composers, reaction summaries, threads, and detail panels.",
        },
      },
    },
  });
</script>

<Story
  name="Inbox shell paints before conversation work"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId("full-community-application");
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend === "live") return;
    await canvas.findByRole("textbox", { name: "Markdown editor" });
    const storyWindow = canvasElement.ownerDocument.defaultView!;
    const actions: { name: string; shellHadFrame: boolean }[] = [];
    let shellHadFrame = false;
    let shellHadSkeleton = false;
    let tracking = false;
    let frame = 0;
    const observeFrame = () => {
      if (canvas.queryByRole("region", { name: "Selected inbox thread" })) {
        shellHadFrame = true;
        shellHadSkeleton ||=
          canvas.queryByRole("status", { name: "Loading Inbox messages" }) !==
          null;
      }
      frame = storyWindow.requestAnimationFrame(observeFrame);
    };
    const observeAction = (event: Event) => {
      if (tracking)
        actions.push({
          name: (event as CustomEvent<string>).detail,
          shellHadFrame,
        });
    };
    storyWindow.addEventListener(
      "community-story-navigation-action",
      observeAction,
    );
    frame = storyWindow.requestAnimationFrame(observeFrame);
    try {
      inboxPresentationReads = 0;
      tracking = true;
      await userEvent.click(
        canvas.getByRole("button", { name: "Inbox", exact: true }),
      );
      await waitFor(() =>
        expect(
          actions.some((action) => action.name === "selectInboxItem"),
        ).toBe(true),
      );
      await expect(actions.every((action) => action.shellHadFrame)).toBe(true);
      await expect(shellHadSkeleton).toBe(true);
      await expect(
        actions.filter((action) => action.name === "selectRoom"),
      ).toHaveLength(0);
      await expect(
        actions.filter((action) => action.name === "selectInboxItem"),
      ).toHaveLength(1);
      const editor = await canvas.findByRole("textbox", {
        name: "Markdown editor",
      });
      await expect(inboxPresentationReads).toBeGreaterThan(0);
      await expect(inboxPresentationReads).toBeLessThan(500);
      await userEvent.type(editor, "Keep this Inbox draft");
      tracking = false;
      await userEvent.click(
        canvas.getByRole("button", { name: "Registry", exact: true }),
      );
      shellHadFrame = false;
      shellHadSkeleton = false;
      actions.length = 0;
      inboxPresentationReads = 0;
      tracking = true;
      await userEvent.click(
        canvas.getByRole("button", { name: "Inbox", exact: true }),
      );
      await waitFor(() =>
        expect(
          actions.some((action) => action.name === "selectInboxItem"),
        ).toBe(true),
      );
      await expect(actions.every((action) => action.shellHadFrame)).toBe(true);
      await waitFor(() =>
        expect(
          canvas.getByRole("textbox", { name: "Markdown editor" }),
        ).toHaveTextContent("Keep this Inbox draft"),
      );
      await expect(inboxPresentationReads).toBeLessThan(500);
      tracking = false;
      await userEvent.click(
        canvas.getByRole("button", { name: "Registry", exact: true }),
      );
      actions.length = 0;
      tracking = true;
      // Navigate away before the first frame; the abandoned activation must cancel.
      canvas.getByRole("button", { name: "Inbox", exact: true }).click();
      await tick();
      canvas.getByRole("button", { name: "Registry", exact: true }).click();
      await tick();
      await new Promise<void>((resolve) =>
        storyWindow.requestAnimationFrame(() =>
          storyWindow.requestAnimationFrame(() => resolve()),
        ),
      );
      await expect(
        actions.filter((action) => action.name === "selectInboxItem"),
      ).toHaveLength(0);
      await expect(
        canvas.queryByRole("region", { name: "Selected inbox thread" }),
      ).not.toBeInTheDocument();
    } finally {
      storyWindow.cancelAnimationFrame(frame);
      storyWindow.removeEventListener(
        "community-story-navigation-action",
        observeAction,
      );
    }
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="inbox-first-paint"
      initialDestination="general"
      onPresentationRead={(field) => {
        if (field === "inboxPresentation") inboxPresentationReads += 1;
      }}
      onNavigationAction={(action) =>
        window.dispatchEvent(
          new CustomEvent("community-story-navigation-action", {
            detail: action,
          }),
        )}
    />
  {/snippet}
</Story>

<Story
  name="Sidebar sections restore and reveal destinations"
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
    const section = (label: string) =>
      within(
        canvas.getByRole("navigation", { name: "Community navigation" }),
      ).getByRole("button", { name: label, expanded: true });
    await canvas.findByRole(
      "heading",
      { name: "Projects", level: 2 },
      { timeout: 15_000 },
    );
    const labels = ["Direct messages", "Projects", "Channels", "Forums"];
    await expect(
      section("Direct messages").compareDocumentPosition(section("Projects")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const label of labels) await userEvent.click(section(label));
    const sectionTrigger = (label: string) =>
      within(canvas.getByRole("heading", { name: label, level: 2 })).getByRole(
        "button",
        { name: label },
      );
    for (const label of labels)
      await expect(sectionTrigger(label)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    const storyWindow = canvasElement.ownerDocument.defaultView!;
    storyWindow.dispatchEvent(
      new storyWindow.Event("community-story-remount-application"),
    );
    await waitFor(() =>
      expect(canvas.getByTestId("full-community-application")).toHaveAttribute(
        "data-application-generation",
        "1",
      ),
    );
    for (const label of labels)
      await waitFor(() =>
        expect(sectionTrigger(label)).toHaveAttribute("aria-expanded", "false"),
      );

    await userEvent.click(
      canvas.getByRole("button", { name: "Registry", exact: true }),
    );
    const openSearch = async (query: string) => {
      await userEvent.click(
        canvas.getByRole("button", { name: "Search community" }),
      );
      const dialog = await within(canvasElement.ownerDocument.body).findByRole(
        "dialog",
        { name: "Search community" },
      );
      await userEvent.type(
        within(dialog).getByLabelText("Search community"),
        query,
      );
      await userEvent.click(
        await within(dialog).findByRole("option", {
          name: new RegExp(`^${query}\\b`, "u"),
        }),
      );
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      await waitFor(() =>
        expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
          "none",
        ),
      );
    };
    await openSearch("general");
    await waitFor(() =>
      expect(sectionTrigger("Channels")).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    await expect(sectionTrigger("Forums")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(sectionTrigger("Direct messages")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Collapsing an active destination remains possible; unrelated UI updates
    // must not force it open again. History navigation intentionally does.
    await userEvent.click(sectionTrigger("Channels"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Search community" }),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await expect(sectionTrigger("Channels")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await openSearch("general");
    await waitFor(() =>
      expect(sectionTrigger("Channels")).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    await userEvent.click(sectionTrigger("Channels"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Back", exact: true }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Forward", exact: true }),
    );
    await waitFor(() =>
      expect(sectionTrigger("Channels")).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    await openSearch("support");
    await waitFor(() =>
      expect(sectionTrigger("Forums")).toHaveAttribute("aria-expanded", "true"),
    );

    const projectTrigger = sectionTrigger("Projects");
    if (projectTrigger.getAttribute("aria-expanded") === "true")
      await userEvent.click(projectTrigger);
    const projectsPage = canvas
      .getAllByRole("button", { name: "Projects", exact: true })
      .find((button) => !button.hasAttribute("aria-expanded"))!;
    await userEvent.click(projectsPage);
    await waitFor(() =>
      expect(sectionTrigger("Projects")).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
    // Leave the shared fixture browser with the ordinary expanded defaults.
    for (const label of labels)
      if (sectionTrigger(label).getAttribute("aria-expanded") === "false")
        await userEvent.click(sectionTrigger(label));
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="sidebar-sections"
      initialDestination="general"
      projects
      persistenceScenario
    />
  {/snippet}
</Story>

<Story
  name="Warm channel navigation bounds state reads"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend !== "memory") return;
    const expand = canvas.queryByRole("button", {
      name: "Expand left sidebar",
    });
    if (expand) await userEvent.click(expand);
    const nav = within(canvas.getByLabelText("Community navigation"));
    for (const name of [
      "plugin-releases",
      "general",
      "plugin-releases",
      "general",
    ]) {
      navigationPresentationReads = 0;
      await userEvent.click(
        await nav.findByRole("button", { name, exact: true }),
      );
      const conversation = within(
        await canvas.findByLabelText(`${name} conversation`),
      );
      await expect(
        await conversation.findByText(
          name === "general"
            ? "Welcome to Lapis Community"
            : "AI Assistant 1.4.0 is ready for curator review.",
          { exact: true },
        ),
      ).toBeVisible();
      // Data already resolved by the parent must not be recomputed per child prop lookup.
      await expect(navigationPresentationReads).toBeGreaterThan(0);
      await expect(navigationPresentationReads).toBeLessThan(500);
    }
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="warm-navigation-state-reads"
      releaseMessages
      initialDestination="general"
      onPresentationRead={() => {
        navigationPresentationReads += 1;
      }}
    />
  {/snippet}
</Story>

<Story
  name="Viewed rooms clear sidebar unread counts"
  play={async ({ canvas }) => {
    const app = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (app.dataset.communityBackend === "live") return;
    const navigation = within(canvas.getByLabelText("Community navigation"));
    for (const name of ["general", "support"]) {
      const room = await navigation.findByRole("button", { name, exact: true });
      await waitFor(() =>
        expect(within(room).getByLabelText(/unread/u)).toBeVisible(),
      );
      const chip = within(room).getByLabelText(/unread/u);
      await expect(chip).toHaveAttribute("data-chip-variant", "subtle");
      await expect(getComputedStyle(chip).borderWidth).toBe("0px");
      await expect(getComputedStyle(chip).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
      await expect(getComputedStyle(chip).backgroundColor).not.toBe(
        getComputedStyle(room).backgroundColor,
      );
      await userEvent.click(room);
      await waitFor(() =>
        expect(canvas.getByLabelText(`${name} content`)).toBeVisible(),
      );
      if (name === "support") {
        // The forum index does not acknowledge replies that have not been viewed.
        await userEvent.click(
          await canvas.findByRole("button", {
            name: "Open topic Portable forums",
          }),
        );
        await canvas.findByText(
          "Portable forum URLs should retain relay and group identity.",
        );
      }
      const content = canvas.getByLabelText(`${name} content`);
      const boundary = await waitFor(
        () => {
          const boundary = content.querySelector<HTMLElement>(
            '[data-ui-part="read-boundary"]',
          );
          expect(boundary).not.toBeNull();
          return boundary!;
        },
        { timeout: 15_000 },
      );
      await expect(app.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        app.ownerDocument.defaultView!.innerHeight,
      );
      boundary.scrollIntoView({ block: "end" });
      await waitFor(() =>
        expect(within(room).queryByLabelText(/unread/u)).toBeNull(),
      );
    }
    await userEvent.click(
      navigation.getByRole("button", { name: "general", exact: true }),
    );
    await waitFor(() =>
      expect(canvas.getByLabelText("general content")).toBeVisible(),
    );
    await expect(
      within(
        navigation.getByRole("button", { name: "general", exact: true }),
      ).queryByLabelText(/unread/u),
    ).toBeNull();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness namespace="viewed-room-unread" />
  {/snippet}
</Story>

<Story
  name="Legacy cached history offline"
  play={async ({ canvas, canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-cache-scenario="legacy-history-offline"]',
        ),
      ).not.toBeNull(),
    );
    const application = canvasElement.querySelector(
      '[data-cache-scenario="legacy-history-offline"]',
    )!;
    await waitFor(() =>
      expect(application).toHaveAttribute("data-cache-message-count", "50"),
    );
    await expect(await canvas.findByText("Cached history 125")).toBeVisible();
    const conversation = canvas.getByLabelText("general conversation");
    const viewport = conversation.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    )!;
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(1000));
    expect(
      conversation.querySelectorAll('[data-ui-part="virtual-row"]').length,
    ).toBeLessThan(45);
    viewport.dispatchEvent(new Event("scroll"));
    await expect(
      canvas.getByRole("button", { name: "Load older messages" }),
    ).toBeEnabled();
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -viewport.scrollHeight }),
    );
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(application).toHaveAttribute("data-cache-message-count", "100"),
    );
    await expect(await canvas.findByText("Cached history 076")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /New messages/ }),
    ).not.toBeInTheDocument();
    expect(
      conversation.querySelectorAll('[data-ui-part="virtual-row"]').length,
    ).toBeLessThan(45);
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness
      scenario="legacy-history-offline"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story name="Cached startup offline">
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness scenario="cached-offline" />
  {/snippet}
</Story>

<Story
  name="Created private channel becomes active"
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

    await userEvent.click(
      await canvas.findByRole("button", { name: "Create channel" }),
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "New channel" },
    );
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "release-planning",
    );
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Private" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Create channel" }),
    );

    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 15_000,
    });
    await expect(
      await canvas.findByRole("button", { name: "release-planning" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      await canvas.findByRole("heading", { name: "#release-planning" }),
    ).toBeVisible();
    await expect(
      await canvas.findByText("This is the beginning of the private channel."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="created-channel-navigation"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Project workspace with overview rail"
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
    const overlay = within(canvasElement.ownerDocument.body);
    const createChannel = await canvas.findByRole("button", {
      name: "Create channel",
    });
    const createProject = await canvas.findByRole("button", {
      name: "Create project",
    });
    await expect(createChannel).toBeVisible();
    await expect(createProject).toBeVisible();

    await userEvent.click(createChannel);
    const channelDialog = await overlay.findByRole("dialog", {
      name: "New channel",
    });
    await userEvent.click(
      within(channelDialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(channelDialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    await userEvent.click(createProject);
    const projectDialog = await overlay.findByRole("dialog", {
      name: "Create a new project",
    });
    await userEvent.click(
      within(projectDialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(projectDialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await expect(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("tab", { name: "Activity" }, { timeout: 15_000 }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("heading", { name: "Projects" }),
    ).toBeVisible();
    await expect(
      (
        await canvas.findAllByRole("button", {
          name: "general",
          exact: true,
        })
      )[0],
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Review" }));
    await waitFor(() =>
      expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
        projectRouteToHash({
          kind: "project",
          coordinate: projectStoryProjectCoordinate,
          surface: "reviews",
        }),
      ),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Reviews", level: 2 }),
    ).toBeVisible();
    await expect(
      await canvas.findByText(
        "Add project file and diff views",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Tasks" }));
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Polish the project overview rail/u,
      }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Assign" }),
    );
    const assignmentDialog = await within(
      canvasElement.ownerDocument.body,
    ).findByRole("dialog", {
      name: "Assign Polish the project overview rail",
    });
    await expect(
      within(assignmentDialog).getByRole("combobox", {
        name: "Search members",
      }),
    ).toBeVisible();
    await expect(
      within(assignmentDialog).getByRole("button", {
        name: "Update assignees",
      }),
    ).toBeVisible();
    await userEvent.click(
      within(
        overlay.getByRole("dialog", {
          name: "Assign Polish the project overview rail",
        }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() =>
      expect(
        overlay.queryByRole("dialog", {
          name: "Assign Polish the project overview rail",
        }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    const navigationSidebar = canvas.getByRole("complementary", {
      name: "Community navigation sidebar",
    });
    const projectToggle = within(navigationSidebar).getByRole("button", {
      name: "Collapse Community Client",
    });
    const projectTree = projectToggle.closest(
      ".lc-community-navigation__item-tree",
    );
    if (!projectTree) throw new Error("Expected the Community Client tree");
    const projectChannel = within(projectTree as HTMLElement).getByRole(
      "button",
      { name: "general", exact: true },
    );
    await expect(projectChannel).toBeVisible();
    await userEvent.click(projectChannel);
    await expect(
      await canvas.findByRole("button", { name: "Hide project overview" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByRole("complementary", { name: "Project overview sidebar" }),
    ).toBeVisible();
    const addFiles = await canvas.findByRole("button", {
      name: "Add files Add a repo.",
    });
    const browseChannels = canvas.getByRole("button", {
      name: "Browse channels",
    });
    const createChannelCard = canvas.getByRole("button", {
      name: "Create a channel",
    });
    await expect(addFiles).toBeVisible();
    await expect(addFiles.getBoundingClientRect().width).toBeCloseTo(
      browseChannels.getBoundingClientRect().width,
      0,
    );
    await expect(addFiles.getBoundingClientRect().width).toBeCloseTo(
      createChannelCard.getBoundingClientRect().width,
      0,
    );
    await expect(addFiles.getBoundingClientRect().top).toBeCloseTo(
      browseChannels.getBoundingClientRect().top,
      0,
    );
    const actionRow = addFiles.closest(".community-workspace-surface__actions");
    if (!actionRow) throw new Error("Expected the channel action row");
    const cardWidth = addFiles.getBoundingClientRect().width;
    const rowWidth = actionRow.getBoundingClientRect().width;
    const gap = Number.parseFloat(getComputedStyle(actionRow).columnGap);
    if (rowWidth >= cardWidth * 3 + gap * 2) {
      await expect(addFiles.getBoundingClientRect().top).toBeCloseTo(
        createChannelCard.getBoundingClientRect().top,
        0,
      );
    } else {
      await expect(
        createChannelCard.getBoundingClientRect().top,
      ).toBeGreaterThan(addFiles.getBoundingClientRect().top);
    }
    await expect(
      addFiles.compareDocumentPosition(browseChannels) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const activeProjectToggle = within(navigationSidebar).getByRole("button", {
      name: "Collapse Community Client",
    });
    const activeProjectTree = activeProjectToggle.closest(
      ".lc-community-navigation__item-tree",
    );
    const activeProjectRow = activeProjectToggle.closest(
      ".lc-community-navigation__item-row",
    );
    if (!activeProjectTree || !activeProjectRow)
      throw new Error("Expected the active Community Client tree");
    await userEvent.hover(activeProjectRow);
    await userEvent.click(
      within(activeProjectTree as HTMLElement).getByRole("button", {
        name: "Open Community Client menu",
      }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Settings" }),
    );
    const settingsDialog = await overlay.findByRole("dialog", {
      name: "Project settings",
    });
    await expect(
      within(settingsDialog).getByRole("textbox", { name: "Name" }),
    ).toHaveValue("Community Client");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="projects"
      projects
      initialDestination={projectDestinationFromCoordinate(
        projectStoryProjectCoordinate,
      )}
    />
  {/snippet}
</Story>

<Story
  name="Project channel overview opens inline sheet"
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
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-project-work-item-read-count",
          "2",
        ),
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-project-session-open-count",
          "1",
        ),
      { timeout: 15_000 },
    );
    const projectOverview = within(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
        "#/channels/general",
      ),
    );

    const tasksButton = projectOverview.getByRole("button", {
      name: /^Tasks\b/u,
    });
    await waitFor(() =>
      expect(getComputedStyle(tasksButton).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(tasksButton);

    await waitFor(() =>
      expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
        "#/channels/general",
      ),
    );
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Tasks", level: 1 },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("tab", { name: "Tasks" }),
    ).not.toBeInTheDocument();
    const task = await canvas.findByRole("button", {
      name: /Polish the project overview rail/u,
    });
    await expect(task).toBeVisible();
    await userEvent.click(task);
    await expect(
      await canvas.findByRole("heading", {
        name: /Polish the project overview rail/u,
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Back to tasks" }),
    ).toBeVisible();
    await expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/channels/general",
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "Close project surface" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("heading", { name: "Tasks", level: 1 }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    ).toBeVisible();
    await expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/channels/general",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="project-channel-inline-sheet"
      projects
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Project channel overview opens inline sheet on mobile"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
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
    await waitFor(() =>
      expect(application.querySelector("[data-shell-root]")).toHaveAttribute(
        "data-display-mode",
        "mobile",
      ),
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-project-work-item-read-count",
          "2",
        ),
      { timeout: 15_000 },
    );
    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    if (!shell) throw new Error("Expected the responsive App Shell root");

    await userEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    await waitFor(() =>
      expect(shell).toHaveAttribute("data-mobile-stage", "right"),
    );
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>(
        '[data-ui-part="mobile-stage-dismiss"][data-side="right"]',
      )!,
    );
    await waitFor(() =>
      expect(shell).toHaveAttribute("data-mobile-stage", "main"),
    );

    await userEvent.click(
      canvas.getByRole("button", {
        name: "Open project overview sidebar",
      }),
    );
    await waitFor(() =>
      expect(shell).toHaveAttribute("data-mobile-stage", "right"),
    );
    const projectOverview = within(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    );
    const tasksRow = projectOverview
      .getByText("Tasks", { exact: true })
      .closest<HTMLButtonElement>("button");
    if (!tasksRow) throw new Error("Expected the mobile project Tasks row");
    await userEvent.click(tasksRow);

    await waitFor(() =>
      expect(shell).toHaveAttribute("data-mobile-stage", "right"),
    );
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Tasks", level: 1 },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    const layer = application.querySelector<HTMLElement>(
      '.community-application__project-sheet-layer[data-ui-part="surface-layer"]',
    );
    const surface = layer?.querySelector<HTMLElement>(
      '[data-ui-part="surface-layer-surface"]',
    );
    const mainLane = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-main-lane"]',
    );
    if (!layer || !surface || !mainLane) {
      throw new Error("Expected a root-hosted mobile project sheet");
    }
    await expect(layer).toHaveAttribute("data-mobile-placement", "root");
    expect(layer.parentElement).toBe(shell);
    const rootRect = shell.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const topGutter = surfaceRect.top - rootRect.top;
    const leftGutter = surfaceRect.left - rootRect.left;
    const rightGutter = rootRect.right - surfaceRect.right;
    const bottomGutter = rootRect.bottom - surfaceRect.bottom;
    expect(topGutter).toBeGreaterThanOrEqual(6);
    expect(topGutter).toBeLessThanOrEqual(16);
    expect(leftGutter).toBeGreaterThanOrEqual(6);
    expect(leftGutter).toBeLessThanOrEqual(16);
    expect(rightGutter).toBeGreaterThanOrEqual(6);
    expect(rightGutter).toBeLessThanOrEqual(16);
    expect(bottomGutter).toBeGreaterThanOrEqual(6);
    expect(bottomGutter).toBeLessThanOrEqual(16);
    expect(surfaceRect.width).toBeGreaterThan(rootRect.width * 0.95);
    await expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/channels/general",
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "Close project surface" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("heading", { name: "Tasks", level: 1 }),
      ).not.toBeInTheDocument(),
    );
    await expect(shell).toHaveAttribute("data-mobile-stage", "right");
    await expect(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    ).toBeVisible();
    await expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/channels/general",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="project-channel-inline-sheet-mobile"
      projects
      responsive
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Registry breadcrumb replaces project chrome"
  play={async ({ canvas }) => {
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

    await userEvent.click(
      await canvas.findByRole("button", { name: "general", exact: true }),
    );
    const headerCenter = application.querySelector<HTMLElement>(
      ".community-app-shell__header-center",
    );
    if (!headerCenter)
      throw new Error("Expected the app header breadcrumb slot");
    await waitFor(() => expect(headerCenter).toHaveTextContent("Projects"));
    await expect(headerCenter).toHaveTextContent("#general");
    await userEvent.click(canvas.getByRole("button", { name: "Registry" }));
    await userEvent.click(
      (await canvas.findAllByRole("link", { name: /Plugins/u }))[0]!,
    );
    await userEvent.click(
      await canvas.findByRole("link", { name: "Open AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();

    const breadcrumb = within(headerCenter).getByRole("navigation", {
      name: "breadcrumb",
    });
    const registryTrail = within(breadcrumb);
    await expect(
      registryTrail.getByRole("link", { name: "Registry" }),
    ).toBeVisible();
    await expect(
      registryTrail.getByRole("link", { name: "Plugins" }),
    ).toBeVisible();
    await expect(registryTrail.getByText("AI Assistant")).toBeVisible();
    await expect(
      breadcrumb.querySelector(".lucide-package-search"),
    ).not.toBeNull();
    await expect(
      breadcrumb.closest(".community-app-shell__header-center"),
    ).not.toBeNull();
    await expect(breadcrumb.closest(".registry-browser__toolbar")).toBeNull();
    await expect(headerCenter).not.toHaveTextContent("Projects");
    await expect(headerCenter).not.toHaveTextContent("#general");
    await expect(
      canvas.queryByRole("complementary", {
        name: "Project overview sidebar",
      }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="registry-breadcrumb"
      initialDestination="registry"
      projects
    />
  {/snippet}
</Story>

<Story
  name="Warm project channel navigation reuses observations"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend !== "memory") return;
    const expand = canvas.queryByRole("button", {
      name: "Expand left sidebar",
    });
    if (expand) await userEvent.click(expand);
    const nav = within(
      canvas
        .getByRole("navigation", { name: "Community navigation" })
        .querySelector<HTMLElement>(
          '[data-navigation-section-kind="channels"]',
        )!,
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-project-work-item-read-count",
          "2",
        ),
      { timeout: 15_000 },
    );
    for (const name of [
      "plugin-releases",
      "general",
      "plugin-releases",
      "general",
    ]) {
      await userEvent.click(
        await nav.findByRole("button", { name, exact: true }),
      );
      const conversation = within(
        await canvas.findByLabelText(`${name} conversation`),
      );
      await expect(
        await conversation.findByText(
          name === "general"
            ? "Welcome to Lapis Community"
            : "AI Assistant 1.4.0 is ready for curator review.",
          { exact: true },
        ),
      ).toBeVisible();
      const headerIcon = canvas
        .getByLabelText(`${name} toolbar`)
        .querySelector('[data-ui-part="project-channel-icon"]');
      const navigationIcon = nav
        .getByRole("button", { name, exact: true })
        .querySelector('[data-ui-part="project-channel-icon"]');
      if (name === "general") {
        await expect(headerIcon).toBeVisible();
        await expect(navigationIcon).toBeVisible();
      } else {
        await expect(headerIcon).toBeNull();
        await expect(navigationIcon).toBeNull();
        await expect(
          canvas
            .getByLabelText(`${name} toolbar`)
            .querySelector(".lucide-hash"),
        ).toBeVisible();
      }
      await expect(application).toHaveAttribute(
        "data-project-work-item-read-count",
        "2",
      );
      await expect(application).toHaveAttribute(
        "data-project-work-item-subscribe-count",
        "2",
      );
      await expect(application).toHaveAttribute(
        "data-project-session-open-count",
        "1",
      );
    }
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="warm-project-observations"
      projects
      releaseMessages
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Projects mobile toolbar opens project overview"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
  play={async ({ canvas }) => {
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
    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    if (!shell) throw new Error("Expected the responsive App Shell root");
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-display-mode", "mobile");
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
    });
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Open project overview sidebar",
      }),
    );
    await waitFor(() =>
      expect(shell).toHaveAttribute("data-mobile-stage", "right"),
    );
    await expect(
      await canvas.findByRole("navigation", { name: "Project overview" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="projects-mobile-toolbar-right-sidebar"
      projects
      responsive
      initialDestination="projects"
      initialHash={projectRouteToHash({
        kind: "repository",
        coordinate: projectStoryRepositoryCoordinate,
        surface: "files",
      })}
    />
  {/snippet}
</Story>

<Story
  name="Projects activity workspace"
  play={async ({ canvas }) => {
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
    await expect(
      await canvas.findByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      canvas.getByRole("navigation", { name: "Project overview" }),
    ).toBeVisible();
    const projectNavigation = canvas.getByRole("navigation", {
      name: "Community navigation",
    });
    await expect(
      await within(projectNavigation).findByRole("button", {
        name: "Community Client",
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-project-session-open-count",
        "1",
      ),
    );
    const repositoriesTab = canvas.getByRole("tab", { name: "Repositories" });
    await waitFor(
      () =>
        expect(getComputedStyle(repositoriesTab).pointerEvents).not.toBe(
          "none",
        ),
      { timeout: 15_000 },
    );
    await userEvent.click(repositoriesTab);
    await expect(
      await canvas.findByRole("button", {
        name: /^(Mine|Other repositories)$/u,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      await canvas.findByRole("img", { name: "1 commit" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Activity" }));
    await expect(
      await canvas.findByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(application).toHaveAttribute(
      "data-project-session-open-count",
      "1",
    );
    const reviewsTab = canvas.getByRole("tab", { name: "Reviews" });
    await waitFor(
      () => expect(getComputedStyle(reviewsTab).pointerEvents).not.toBe("none"),
      { timeout: 15_000 },
    );
    await userEvent.click(reviewsTab);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Add project file and diff views",
      }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Files changed" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "project.conf" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Commits" }));
    await userEvent.click(
      canvas.getByRole("button", {
        name: /Add project file and diff views d{7}/u,
      }),
    );
    await expect(
      await canvas.findByRole("heading", { name: /Add project file/u }),
    ).toBeVisible();
    await expect(application).toHaveAttribute(
      "data-project-session-open-count",
      "1",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="projects-activity"
      projects
      initialDestination="projects"
    />
  {/snippet}
</Story>

<Story
  name="GitHub repository overview action"
  play={async ({ canvas }) => {
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
    if (application.dataset.communityBackend !== "memory") return;

    await userEvent.click(canvas.getByRole("tab", { name: "Repositories" }));
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /community-client Hosted browser and desktop client/u,
      }),
    );
    const action = await canvas.findByRole("button", {
      name: "Manage GitHub App",
    });
    await expect(action.querySelector("svg")).not.toBeNull();
    const restingBackground = getComputedStyle(action).backgroundColor;
    action.focus();
    await waitFor(() =>
      expect(getComputedStyle(action).backgroundColor).not.toBe(
        restingBackground,
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="github-project-action"
      projects
      projectBackend="github"
      initialDestination="projects"
    />
  {/snippet}
</Story>

<Story
  name="Empty project catalog remains responsive"
  play={async ({ canvas }) => {
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
    await expect(
      await canvas.findByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    await userEvent.click(canvas.getByRole("tab", { name: "Repositories" }));
    await expect(
      await canvas.findByText("No repositories are attached."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="empty-projects"
      projects
      emptyProjects
      initialDestination="projects"
    />
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

<Story
  name="Channel startup skeleton"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByRole(
        "status",
        { name: "Loading channel messages" },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Connect to a community relay" }),
    ).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="channel-startup-skeleton"
      initialDestination="general"
      bootstrapDelayMs={2_500}
    />
  {/snippet}
</Story>

<Story
  name="Forum startup skeleton"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByRole(
        "status",
        { name: "Loading forum topics" },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Connect to a community relay" }),
    ).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="forum-startup-skeleton"
      initialDestination="support"
      bootstrapDelayMs={2_500}
    />
  {/snippet}
</Story>

<Story
  name="Failed room startup"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole(
        "status",
        { name: "Loading channel messages" },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    await expect(
      await canvas.findByText(
        "Connect to a community relay",
        {},
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("status", { name: "Loading channel messages" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="failed-room-startup"
      initialDestination="general"
      bootstrapDelayMs={500}
      bootstrapFailure
    />
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
  name="Cached channel during refresh"
  play={async ({ canvas, canvasElement }) => {
    let application: Element | null = null;
    await waitFor(() => {
      application = canvasElement.querySelector(
        '[data-cache-scenario="cached-refresh"]',
      );
      expect(application).not.toBeNull();
    });
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-community-status",
        "synchronizing",
      ),
    );
    await expect(application).toHaveAttribute("data-cache-message-count", "3");
    await expect(
      await canvas.findByLabelText("general conversation"),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("status", { name: "Loading channel messages" }),
    ).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness
      scenario="cached-refresh"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Cached forum during refresh"
  play={async ({ canvas, canvasElement }) => {
    let application: Element | null = null;
    await waitFor(() => {
      application = canvasElement.querySelector(
        '[data-cache-scenario="cached-refresh"]',
      );
      expect(application).not.toBeNull();
    });
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-community-status",
        "synchronizing",
      ),
    );
    await waitFor(() =>
      expect(application).toHaveAttribute("data-cache-topic-count", "1"),
    );
    await expect(
      await canvas.findByRole("region", { name: "support topics" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("status", { name: "Loading forum topics" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness
      scenario="cached-refresh"
      initialDestination="support"
    />
  {/snippet}
</Story>

<Story
  name="Progressive history bootstrap"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 20_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 20_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "background",
        ),
      { timeout: 20_000 },
    );
    await expect(application).toHaveAttribute(
      "data-community-cache-freshness",
      "synchronizing",
    );
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "complete",
        ),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="progressive-bootstrap"
      progressiveDelayMs={150}
    />
  {/snippet}
</Story>

<Story
  name="Background history failure and resume"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 20_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "partial-error",
        ),
      { timeout: 20_000 },
    );
    await expect(application).toHaveAttribute(
      "data-community-status",
      "connected",
    );
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "complete",
        ),
      { timeout: 30_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="progressive-recovery"
      progressiveFailure
    />
  {/snippet}
</Story>

<Story
  name="Progressive history mobile"
  globals={{ viewport: { value: "mobile1", isRotated: false } }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="progressive-mobile"
      progressiveDelayMs={150}
      responsive
    />
  {/snippet}
</Story>

<Story
  name="Progressive history constrained height"
  parameters={{
    viewport: {
      options: {
        constrainedHeight: {
          name: "Constrained height",
          styles: { width: "1100px", height: "600px" },
        },
      },
    },
  }}
  globals={{ viewport: { value: "constrainedHeight", isRotated: false } }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="progressive-constrained-height"
      progressiveDelayMs={150}
    />
  {/snippet}
</Story>

<Story name="Progressive history dark" globals={{ colorMode: "dark" }}>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="progressive-dark"
      progressiveDelayMs={150}
    />
  {/snippet}
</Story>

<Story
  name="Pulse"
  play={async ({ canvas }) => {
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
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "complete",
        ),
      { timeout: 30_000 },
    );
    await expect(
      await canvas.findByRole("button", { name: "Pulse" }),
    ).toBeVisible();
    await expect(
      await canvas.findByText(
        "Building a calmer place for communities to work in public.",
      ),
    ).toBeVisible();
    const [memberNote] = await canvas.findAllByRole("article", {
      name: /^(?:Member|Community member|Noor Automations)$/u,
    });
    await expect(memberNote).toBeDefined();
    await userEvent.click(
      within(memberNote!).getByRole("button", {
        name: /^(?:Member|Community member|Noor Automations)$/u,
      }),
    );
    await expect(await canvas.findByLabelText("Profile sidebar")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: /^Agents/u }));
    await expect(await canvas.findByText("Noor Automations")).toBeVisible();
    await expect(
      canvas.queryByRole("group", { name: "Pulse composer" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="pulse"
      initialDestination="pulse"
      pulseFixtures
    />
  {/snippet}
</Story>

<Story
  name="Pulse dark"
  globals={{ colorMode: "dark" }}
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole("region", { name: "Pulse feed" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="pulse-dark"
      initialDestination="pulse"
      pulseFixtures
    />
  {/snippet}
</Story>

<Story
  name="Pulse authentication resume"
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
    await expect(
      await canvas.findByRole("button", { name: "Pulse" }, { timeout: 15_000 }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Inbox" }),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "Liked" }));
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    const login = within(dialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await expect(canvas.getByRole("tab", { name: "Liked" })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(
      await canvas.findByRole("button", { name: "Inbox" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="pulse-authentication-resume"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
    />
  {/snippet}
</Story>

<Story
  name="Relay account identity while restoring"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByRole(
        "button",
        { name: "Open profile menu for Steve Storybook" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(application).not.toHaveAttribute(
      "data-story-controller-auth-status",
      "connected",
    );
    await expect(
      canvas.queryByRole("button", { name: "Open profile menu for Guest" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="managed-relay-auth-restoring"
      signedIn={false}
      relayAuthMode="managed"
      relayAuthIdentityDelayMs={5_000}
    />
  {/snippet}
</Story>

<Story
  name="Relay profile sign out is single flight"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    const profile = await canvas.findByRole(
      "button",
      { name: "Open profile menu for Steve Storybook" },
      { timeout: 15_000 },
    );
    await expect(application).not.toHaveAttribute(
      "data-story-controller-auth-status",
      "connected",
    );
    await userEvent.click(profile);
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(overlay.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-story-relay-auth-sign-out-count",
        "1",
      ),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(profile);
    const signingOut = overlay.getByRole("menuitem", {
      name: "Signing out…",
    });
    await expect(signingOut).toHaveAttribute("aria-disabled", "true");
    await expect(application).toHaveAttribute(
      "data-story-relay-auth-sign-out-count",
      "1",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await expect(
      await canvas.findByRole(
        "button",
        { name: "Open profile menu for Guest" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(application).toHaveAttribute(
      "data-story-controller-auth-status",
      "anonymous",
    );
    await expect(application).toHaveAttribute(
      "data-story-relay-auth-sign-out-count",
      "1",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="managed-relay-auth-single-sign-out"
      signedIn={false}
      relayAuthMode="managed"
      relayAuthIdentityDelayMs={3_000}
      relayAuthSignOutDelayMs={500}
    />
  {/snippet}
</Story>

<Story
  name="Relay managed account restoration and sign out"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Account" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Account" }),
    ).toBeVisible();
    await expect(canvas.getByText("Managed by Lapis")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Connect GitHub" }),
    ).toBeVisible();
    const signOut = canvas.getByRole("button", { name: "Sign out" });
    await waitFor(() => expect(signOut).toBeEnabled(), { timeout: 15_000 });
    await userEvent.click(signOut);
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-story-relay-auth-sign-out-count",
        "1",
      ),
    );
    await expect(application).toHaveAttribute(
      "data-story-relay-auth-sign-out-controller-status",
      "connected",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="managed-relay-auth"
      initialDestination="settings"
      signedIn={false}
      relayAuthMode="managed"
    />
  {/snippet}
</Story>

<Story
  name="Relay external signer account details"
  globals={{ colorMode: "dark", viewport: { value: "mobile1" } }}
  play={async ({ canvas }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Open navigation sidebar" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Account" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Close left sidebar" }),
    );
    await expect(canvas.getByText("Browser/device signer")).toBeVisible();
    await expect(
      canvas.getByText(
        "Reconnect the Nostr signer before an action needs a signature.",
      ),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Reconnect GitHub" }),
    );
    await expect(
      await canvas.findByTestId("full-community-application"),
    ).toHaveAttribute("data-story-relay-auth-github-connect-count", "1");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="external-relay-auth-account"
      initialDestination="settings"
      signedIn={false}
      relayAuthMode="external"
      responsive
    />
  {/snippet}
</Story>

<Story
  name="Linked GitHub account awaiting signer"
  globals={{ colorMode: "dark", viewport: { value: "mobile1" } }}
  play={linkedSignerNavigation}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="github-external-awaiting"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
      relayAuthMode="external-github"
      responsive
    />
  {/snippet}
</Story>

<Story
  name="Dismissed signer toast stays dismissed during navigation"
  play={async ({ canvas, canvasElement }) => {
    await waitFor(() =>
      expect(canvas.getByText("Reconnect your Nostr signer")).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Close toast" }));
    await waitFor(() =>
      expect(
        canvas.queryByText("Reconnect your Nostr signer"),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(canvas.getByRole("tab", { name: /^Agents/u }));
    await userEvent.click(canvas.getByRole("tab", { name: "Everyone" }));
    await expect(
      canvas.queryByText("Reconnect your Nostr signer"),
    ).not.toBeInTheDocument();
    const profile = canvas.getByRole("button", {
      name: "Open profile menu for GitHub Member",
    });
    await expect(profile).toHaveTextContent("Sign in");
    await userEvent.click(profile);
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Sign in", exact: true }),
    );
    const dialog = await overlay.findByRole("dialog", {
      name: "Sign in to Community",
    });
    await expect(
      within(dialog).getByRole("button", { name: /Browser extension/u }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="github-external-dismissed"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
      relayAuthMode="external-github"
    />
  {/snippet}
</Story>

<Story
  name="Linked GitHub external signer reconnect and disconnect"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId("full-community-application");
    await waitFor(() =>
      expect(canvas.getByText("Reconnect your Nostr signer")).toBeVisible(),
    );
    await expect(
      await canvas.findByRole("button", {
        name: "Open profile menu for GitHub Member",
      }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Reconnect signer" }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    const login = await overlay.findByRole("dialog", {
      name: "Sign in to Community",
    });
    await expect(
      within(login).queryByRole("button", { name: /Continue with GitHub/u }),
    ).not.toBeInTheDocument();
    await expect(
      within(login).getByText(/GitHub access does not unlock it/u),
    ).toBeVisible();
    await userEvent.click(
      within(login).getByRole("button", { name: /Browser extension/u }),
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-story-controller-auth-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    await waitFor(() =>
      expect(
        canvas.queryByText("Reconnect your Nostr signer"),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /Open profile menu/u }),
    );
    await userEvent.click(
      overlay.getByRole("menuitem", { name: /^Settings/u }),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Account" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Disconnect GitHub access" }),
    );
    const confirmation = await overlay.findByRole("alertdialog", {
      name: "Disconnect GitHub access?",
    });
    await userEvent.click(
      within(confirmation).getByRole("button", { name: "Disconnect access" }),
    );
    await expect(
      await within(confirmation).findByRole("alert"),
    ).not.toHaveTextContent("RelayAuthClient");
    await expect(confirmation).toBeVisible();
    await userEvent.click(
      within(confirmation).getByRole("button", { name: "Disconnect access" }),
    );
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
    await expect(
      canvas.getByText(
        "GitHub access disconnected. Your linked account identity is retained.",
      ),
    ).toBeVisible();
    await expect(canvas.getAllByText("@github-member")[0]!).toBeVisible();
    await expect(application).toHaveAttribute(
      "data-story-controller-auth-status",
      "connected",
    );
    await waitFor(() =>
      expect(
        canvas.queryByText("Reconnect your Nostr signer"),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to Lapis" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Pulse" }));
    await userEvent.click(await canvas.findByRole("tab", { name: "Everyone" }));
    const reaction = (
      await canvas.findAllByRole(
        "button",
        { name: /^(?:Like|Unlike) .+'s note$/u },
        { timeout: 15_000 },
      )
    )[0]!;
    const note = within(reaction.closest("article")!);
    const reactionName = reaction.getAttribute("aria-label")!;
    const toggledName = reactionName.startsWith("Like ")
      ? reactionName.replace(/^Like /u, "Unlike ")
      : reactionName.replace(/^Unlike /u, "Like ");
    await userEvent.click(reaction);
    await expect(
      await note.findByRole(
        "button",
        { name: toggledName },
        { timeout: 8_000 },
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /Open profile menu/u }),
    );
    await userEvent.click(overlay.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() =>
      expect(application).toHaveAttribute(
        "data-story-controller-auth-status",
        "anonymous",
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="github-external-auth"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
      relayAuthMode="external-github"
    />
  {/snippet}
</Story>

<Story
  name="Relay signer reconnection resumes protected action"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("tab", { name: "Liked" }, { timeout: 15_000 }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Sign in to Community",
    });
    const login = within(dialog);
    await expect(
      login.queryByRole("button", { name: /Continue with GitHub/u }),
    ).not.toBeInTheDocument();
    await expect(
      login.queryByRole("button", { name: /Continue with Google/u }),
    ).not.toBeInTheDocument();
    await expect(
      login.queryByRole("button", { name: /Create a new account/u }),
    ).not.toBeInTheDocument();
    const application = await canvas.findByTestId("full-community-application");
    await expect(application).toHaveAttribute(
      "data-story-relay-auth-connect-count",
      "0",
    );
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await expect(application).toHaveAttribute(
      "data-story-relay-auth-connect-count",
      "0",
    );
    await expect(application).toHaveAttribute(
      "data-story-identity-connect-count",
      "1",
    );
    const liked = canvas.getByRole("tab", { name: "Liked" });
    await waitFor(() => expect(liked).toHaveAttribute("data-state", "active"), {
      timeout: 15_000,
    });
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="external-relay-auth-resume"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
      relayAuthMode="external"
      bootstrapDelayMs={2_000}
    />
  {/snippet}
</Story>

<Story
  name="Expired relay signer resumes protected action"
  play={async ({ canvas, canvasElement }) => {
    const reaction = (
      await canvas.findAllByRole(
        "button",
        { name: /^(?:Like|Unlike) .+'s note$/u },
        { timeout: 15_000 },
      )
    )[0]!;
    const reactionName = reaction.getAttribute("aria-label")!;
    await userEvent.click(reaction);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Sign in to Community" },
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Your session has expired. Sign in again.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Browser extension/u }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    const resumedName = reactionName.startsWith("Like ")
      ? reactionName.replace(/^Like /u, "Unlike ")
      : reactionName.replace(/^Unlike /u, "Like ");
    await expect(
      await canvas.findByRole(
        "button",
        { name: resumedName },
        { timeout: 8_000 },
      ),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="expired-relay-auth-resume"
      initialDestination="pulse"
      pulseFixtures
      signedIn={false}
      relayAuthMode="expiring"
    />
  {/snippet}
</Story>

<Story
  name="Contextual channel and forum members"
  play={async ({ canvas, canvasElement }) => {
    const outsideMemberPubkey =
      "29ce758bb2d21def214cea069addbd16896ec77924bf0ec9219e00dcf077605e";
    const outsideMemberName = outsideMemberPubkey.slice(0, 12);
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

    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: /View channel members/u }),
    );
    const channelDialog = await overlay.findByRole("dialog", {
      name: "Channel members",
    });
    const channelMembers = within(channelDialog);
    await expect(
      channelMembers.getByRole("option", { name: "You, administrator" }),
    ).toBeVisible();
    const managedMember = await channelMembers.findByRole(
      "option",
      { name: /^Manage /u },
      { timeout: 15_000 },
    );
    await expect(managedMember).toBeVisible();
    await userEvent.click(managedMember);
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Manage roles" }),
    );
    const rolesDialog = await overlay.findByRole("dialog", {
      name: "Manage roles",
    });
    await expect(within(rolesDialog).getByText("Member")).toBeVisible();
    await userEvent.click(
      within(rolesDialog).getByRole("checkbox", { name: "Writer" }),
    );
    await userEvent.click(
      within(rolesDialog).getByRole("button", { name: "Save roles" }),
    );
    await waitFor(() => expect(rolesDialog).not.toBeInTheDocument(), {
      timeout: 15_000,
    });
    await expect(await channelMembers.findByText("writer")).toBeVisible();
    await expect(
      channelMembers.queryByText(outsideMemberName),
    ).not.toBeInTheDocument();

    const channelSearch = channelMembers.getByRole("combobox", {
      name: "Search members",
    });
    await userEvent.type(channelSearch, outsideMemberPubkey);
    await expect(
      await channelMembers.findByText("In this channel"),
    ).toBeVisible();
    await expect(channelMembers.getByText("Not in this channel")).toBeVisible();
    const addChannelMember = await channelMembers.findByRole("option", {
      name: /^Add .+ to channel$/u,
    });
    const outsideMemberDisplayName = addChannelMember
      .getAttribute("aria-label")!
      .replace(/^Add /u, "")
      .replace(/ to channel$/u, "");
    await userEvent.click(addChannelMember);
    await expect(
      await overlay.findByText(
        `${outsideMemberDisplayName} added`,
        {},
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument();

    const outsideMemberManager = await channelMembers.findByRole(
      "option",
      // Joining fetches the selected member's profile; its resolved name replaces the cached key preview.
      { name: "Manage Noor" },
      { timeout: 8_000 },
    );
    await userEvent.click(outsideMemberManager);
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Remove from channel" }),
    );
    await expect(
      await channelMembers.findByRole(
        "option",
        {
          name: /^Add .+ to channel$/u,
        },
        { timeout: 8_000 },
      ),
    ).toBeVisible();

    await userEvent.click(
      channelMembers.getByRole("button", { name: "Close members" }),
    );
    await waitFor(() => expect(channelDialog).not.toBeInTheDocument());
    await userEvent.click(
      await canvas.findByRole("button", { name: "support" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: /View forum members/u }),
    );
    const forumDialog = await overlay.findByRole("dialog", {
      name: "Forum members",
    });
    const forumMembers = within(forumDialog);
    await expect(
      forumMembers.getByRole("option", { name: "You, administrator" }),
    ).toBeVisible();
    await expect(
      forumMembers.queryByText(/Community Member|^Member$/u),
    ).not.toBeInTheDocument();
    await userEvent.type(
      forumMembers.getByRole("combobox", { name: "Search members" }),
      outsideMemberPubkey,
    );
    await expect(await forumMembers.findByText("In this forum")).toBeVisible();
    await expect(forumMembers.getByText("Not in this forum")).toBeVisible();
    await expect(
      await forumMembers.findByRole("option", {
        name: /^Add .+ to forum$/u,
      }),
    ).toBeVisible();
    await userEvent.click(
      forumMembers.getByRole("button", { name: "Close members" }),
    );
    await waitFor(() => expect(forumDialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="contextual-members"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Posting policy and private invites"
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
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Manage channel" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: /Posting permissions/ }),
    );
    const editor = await overlay.findByRole("dialog", {
      name: "Edit channel",
    });
    await userEvent.click(
      within(editor).getByRole("radio", { name: "Private" }),
    );
    await userEvent.click(
      within(editor).getByRole("radio", {
        name: /Writers and administrators/,
      }),
    );
    await userEvent.click(
      within(editor).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() => expect(editor).not.toBeInTheDocument(), {
      timeout: 15_000,
    });
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "Manage channel" }),
    );
    await expect(
      await canvas.findByText(
        "Writers and administrators",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Create invite link/ }),
    );
    const inviteDialog = await overlay.findByRole("dialog", {
      name: "Create invite link",
    });
    const storyWindow = canvasElement.ownerDocument.defaultView;
    if (!storyWindow) throw new Error("Expected the Storybook window");
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      storyWindow.navigator,
      "clipboard",
    );
    const writeText =
      fn<(value: string) => Promise<void>>().mockResolvedValue();
    Object.defineProperty(storyWindow.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      await userEvent.click(
        within(inviteDialog).getByRole("button", { name: "Create invite" }),
      );
      const inviteInput = await within(inviteDialog).findByLabelText(
        "Invite link",
        {},
        { timeout: 15_000 },
      );
      const inviteUri = (inviteInput as HTMLInputElement).value;
      await expect(inviteUri).toMatch(/^nostr:naddr.+\?invite=/u);
      await expect(
        within(inviteDialog).getByText(/Invite created\. Copy it/),
      ).toBeVisible();
      await userEvent.click(
        within(inviteDialog).getByRole("button", { name: "Copy" }),
      );
      await expect(writeText).toHaveBeenCalledWith(inviteUri);
      await expect(
        within(inviteDialog).getByText(
          "Invite created and copied to the clipboard.",
        ),
      ).toBeVisible();
      await userEvent.click(
        within(inviteDialog).getByRole("button", { name: "Done" }),
      );
      await waitFor(() => expect(inviteDialog).not.toBeInTheDocument());
      await waitFor(() =>
        expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
          "none",
        ),
      );

      await userEvent.click(
        canvas.getByRole("button", { name: "Open Forums menu" }),
      );
      await expect(
        await overlay.findByRole("menuitem", { name: "Join with invite" }),
      ).toBeVisible();
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
          "none",
        ),
      );
      await userEvent.click(
        canvas.getByRole("button", { name: "Open Channels menu" }),
      );
      await userEvent.click(
        await overlay.findByRole("menuitem", { name: "Join with invite" }),
      );
      const joinDialog = await overlay.findByRole("dialog", {
        name: "Join with invite",
      });
      await userEvent.type(
        within(joinDialog).getByLabelText("Invite link"),
        inviteUri,
      );
      await userEvent.click(
        within(joinDialog).getByRole("button", { name: "Join group" }),
      );
      await waitFor(() => expect(joinDialog).not.toBeInTheDocument(), {
        timeout: 15_000,
      });
      await expect(
        canvas.getByRole("button", { name: "general" }),
      ).toBeVisible();
    } finally {
      toast.dismiss();
      if (clipboardDescriptor) {
        Object.defineProperty(
          storyWindow.navigator,
          "clipboard",
          clipboardDescriptor,
        );
      } else {
        Reflect.deleteProperty(storyWindow.navigator, "clipboard");
      }
    }
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="posting-policy-and-invites"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Invite authentication resume"
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
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Channels menu" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitem", { name: "Join with invite" }),
    );
    const joinDialog = await overlay.findByRole("dialog", {
      name: "Join with invite",
    });
    await waitFor(() =>
      expect(application.dataset.storyInviteUri).toMatch(
        /^nostr:naddr.+\?invite=/u,
      ),
    );
    const inviteUri = application.dataset.storyInviteUri!;
    const inviteInput = within(joinDialog).getByLabelText("Invite link");
    await userEvent.type(inviteInput, inviteUri);
    await userEvent.click(
      within(joinDialog).getByRole("button", { name: "Join group" }),
    );

    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    await expect(inviteInput).toHaveValue(inviteUri);
    const login = within(loginDialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await waitFor(() => expect(joinDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await expect(
      await canvas.findByRole("button", { name: "Inbox" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="invite-authentication-resume"
      initialDestination="general"
      signedIn={false}
    />
  {/snippet}
</Story>

<Story
  name="Member view without management permission"
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
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-content-sync",
          "complete",
        ),
      { timeout: 30_000 },
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: /View channel members/u }),
    );
    const dialog = await overlay.findByRole("dialog", {
      name: "Channel members",
    });
    const members = within(dialog);
    await expect(dialog.querySelector('[aria-haspopup="menu"]')).toBeNull();
    await expect(members.getAllByRole("option")[0]).toBeVisible();
    await userEvent.type(
      members.getByRole("combobox", { name: "Search members" }),
      "noor",
    );
    await expect(await members.findByText("In this channel")).toBeVisible();
    await expect(members.getByText("Not in this channel")).toBeVisible();
    await expect(
      members.queryByRole("option", { name: /Add .* to channel/u }),
    ).not.toBeInTheDocument();
    await expect(dialog.querySelector('[aria-haspopup="menu"]')).toBeNull();
    await userEvent.click(
      members.getByRole("button", { name: "Close members" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="contextual-member-view"
      initialDestination="general"
      loginIdentity="participant"
    />
  {/snippet}
</Story>

<Story
  name="Community without registry"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.queryByRole("button", { name: "Registry" }),
    ).not.toBeInTheDocument();
    await expect(
      canvasElement.querySelector('[data-cache-scenario="cold-offline"]'),
    ).not.toBeNull();
  }}
>
  {#snippet template()}
    <CommunityApplicationCacheStoryHarness
      scenario="cold-offline"
      registryConfigured={false}
    />
  {/snippet}
</Story>

<Story
  name="Logged out"
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
    await expect(
      await canvas.findByRole("button", { name: "Registry" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Inbox" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    await expect(
      canvas.queryByText("Select a message"),
    ).not.toBeInTheDocument();
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
    await expect(
      overlay.queryByRole("menuitem", { name: "Update your status" }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("menuitem", { name: /^Settings$/u }),
    ).not.toBeInTheDocument();
    await userEvent.click(overlay.getByRole("menuitem", { name: "Sign in" }));
    const profileLoginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    await expect(profileLoginDialog).toBeVisible();
    await userEvent.click(
      within(profileLoginDialog).getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(profileLoginDialog).not.toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for Guest" }),
    );
    await expect(
      overlay.getByRole("menuitem", {
        name: "Lapis Community community actions",
      }),
    ).toBeVisible();
    await userEvent.hover(
      overlay.getByRole("menuitem", {
        name: "Lapis Community community actions",
      }),
    );
    await expect(
      await overlay.findByRole("menuitem", { name: "Community settings" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );
    const membership = canvasElement.querySelector(
      '[data-ui-part="room-membership"]',
    );
    await expect(canvas.getByRole("button", { name: "Join" })).toBeVisible();
    await expect(membership).not.toBeNull();
    await expect(membership).toHaveTextContent("Viewing #general");
    await expect(
      canvas.queryByRole("textbox", { name: "Markdown editor" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Join to participate" }),
    );
    const dialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    await expect(dialog).toBeVisible();
    const login = within(dialog);
    await expect(login.getAllByText("Connect to Nostr")).toHaveLength(1);
    await expect(
      login.queryByText("Choose your login method"),
    ).not.toBeInTheDocument();
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
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await expect(login.getByLabelText("Private key")).toHaveAttribute(
      "type",
      "password",
    );
    await expect(login.queryByText("Private key")).not.toBeInTheDocument();
    await userEvent.click(login.getByRole("button", { name: "Back" }));
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
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Join to participate" }),
    );
    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    const login = within(loginDialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-story-active-membership",
          "joined",
        ),
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend === "docker") {
      await waitFor(
        () =>
          expect(application).toHaveAttribute(
            "data-last-action",
            "join-requested:general",
          ),
        { timeout: 15_000 },
      );
    } else {
      const composer = await canvas.findByRole("textbox", {
        name: "Markdown editor",
      });
      await waitFor(
        () => expect(composer).toHaveAttribute("contenteditable", "true"),
        { timeout: 15_000 },
      );
    }
    await expect(
      await canvas.findByRole("button", { name: "Inbox" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: /Open profile menu for /u }),
    );
    await userEvent.click(overlay.getByRole("menuitem", { name: "Sign out" }));
    await expect(
      await canvas.findByRole(
        "button",
        { name: "Open profile menu for Guest" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Inbox" }),
      ).not.toBeInTheDocument(),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      signedIn={false}
      loginIdentity="participant"
      namespace="login-then-join"
    />
  {/snippet}
</Story>

<Story
  name="Registry discussion login transition"
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
    if (application.dataset.communityBackend !== "memory") return;
    await userEvent.click(
      (
        await canvas.findAllByRole("link", {
          name: "Open AI Assistant",
        })
      )[0]!,
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: /Reviews/u }),
    );
    const discussion = await canvas.findByRole(
      "region",
      { name: "Registry Demo community discussion" },
      { timeout: 15_000 },
    );
    const scoped = within(discussion);
    await expect(
      scoped.queryByText(/NIP-07|signer is required/iu),
    ).not.toBeInTheDocument();
    await userEvent.click(
      scoped.getByRole("button", {
        name: "Start a discussion about Registry Demo",
      }),
    );
    const composer = scoped.getByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.type(composer, "@ste");
    const people = await scoped.findByRole("listbox", {
      name: "People suggestions",
    });
    await expect(
      within(people).getByRole("option", { name: /steve/u }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.clear(composer);
    await userEvent.type(composer, "#gen");
    const rooms = await scoped.findByRole("listbox", {
      name: "Channels suggestions",
    });
    await expect(
      within(rooms).getByRole("option", { name: /general/iu }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.clear(composer);
    await userEvent.type(composer, ":lap");
    const emoji = await scoped.findByRole("listbox", {
      name: "Emoji suggestions",
    });
    await expect(
      within(emoji).getByRole("option", { name: /lapis/iu }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.clear(composer);
    await userEvent.type(
      composer,
      "Published after the host-provided login completed.",
    );
    await userEvent.click(
      scoped.getByRole("button", { name: "Publish comment" }),
    );

    const overlay = within(canvasElement.ownerDocument.body);
    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    const login = within(loginDialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 15_000,
    });
    await expect(
      await scoped.findByText(
        "Published after the host-provided login completed.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="registry-discussion-login"
      signedIn={false}
    />
  {/snippet}
</Story>

<Story
  name="Nonmember joins before posting"
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
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "Join to participate" },
        { timeout: 15_000 },
      ),
    );

    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    const login = within(loginDialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });

    if (application.dataset.communityBackend === "docker") {
      await waitFor(
        () =>
          expect(application).toHaveAttribute(
            "data-last-action",
            "join-requested:general",
          ),
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
      return;
    }

    const composer = await canvas.findByRole(
      "textbox",
      { name: "Markdown editor" },
      { timeout: 15_000 },
    );
    await waitFor(
      () => expect(composer).toHaveAttribute("contenteditable", "true"),
      { timeout: 15_000 },
    );
    await userEvent.type(composer, "Send this after signing in");
    await userEvent.keyboard("{Enter}");

    await expect(
      overlay.queryByRole("alertdialog", {
        name: "Join general to continue?",
      }),
    ).not.toBeInTheDocument();
    await expect(
      await canvas.findByText(
        "Send this after signing in",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(application).toHaveAttribute("data-last-action", "sent-message"),
      { timeout: 15_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      signedIn={false}
      loginIdentity="participant"
      namespace="post-membership"
    />
  {/snippet}
</Story>

<Story
  name="Nonmember joins before reacting"
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
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "support" }),
    );
    if (application.dataset.communityBackend === "docker") {
      const relayRewriteSecond = Math.floor(Date.now() / 1_000);
      await waitFor(
        () =>
          expect(Math.floor(Date.now() / 1_000)).toBeGreaterThan(
            relayRewriteSecond,
          ),
        { timeout: 2_000, interval: 50 },
      );
    }
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "Join to participate" },
        { timeout: 15_000 },
      ),
    );

    const loginDialog = await overlay.findByRole("dialog", {
      name: "Connect to Nostr",
    });
    const login = within(loginDialog);
    await userEvent.click(
      login.getByRole("button", { name: /Paste a private key/u }),
    );
    await userEvent.type(
      login.getByLabelText("Private key"),
      "nsec1storybookexample",
    );
    await userEvent.click(
      login.getByRole("button", { name: "Sign in with private key" }),
    );
    await waitFor(() => expect(loginDialog).not.toBeInTheDocument(), {
      timeout: 8_000,
    });
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-story-active-membership",
          "joined",
        ),
      { timeout: 15_000 },
    );

    await userEvent.click(
      await canvas.findByRole("button", { name: "Open topic Portable forums" }),
    );
    await canvas.findByRole("button", { name: "Back to posts" });
    const message = canvas
      .getAllByLabelText(/^Message from /u)
      .find((candidate) =>
        candidate.textContent?.includes("How should portable forums work?"),
      );
    if (!message) throw new Error("Expected the forum root message");
    const messages = canvas.getByLabelText("support messages");
    await waitFor(
      () => expect(messages).toHaveAttribute("aria-busy", "false"),
      {
        timeout: 15_000,
      },
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await userEvent.hover(message);
    const addReaction = within(message).getByRole("button", {
      name: "Add reaction",
    });
    await waitFor(() => expect(addReaction).toBeVisible());
    await userEvent.click(addReaction);
    const picker = await waitFor(() => {
      const element =
        canvasElement.ownerDocument.querySelector<HTMLElement>(
          "em-emoji-picker",
        );
      expect(element?.shadowRoot).not.toBeNull();
      return element!;
    });
    const standardEmoji = await waitFor(() => {
      const button = picker.shadowRoot?.querySelector<HTMLButtonElement>(
        'button[aria-label="🤣"]',
      );
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.click(standardEmoji);

    await expect(
      overlay.queryByRole("alertdialog", {
        name: "Join support to continue?",
      }),
    ).not.toBeInTheDocument();
    await waitFor(
      () => {
        const failure = canvasElement.ownerDocument.querySelector(
          '[data-sonner-toast][data-type="error"]',
        );
        if (failure !== null) {
          throw new Error(`Reaction failed: ${failure.textContent?.trim()}`);
        }
        expect(application).toHaveAttribute(
          "data-last-action",
          expect.stringMatching(/^reaction:/u),
        );
      },
      { timeout: 30_000 },
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      signedIn={false}
      loginIdentity="participant"
      namespace="reaction-membership"
    />
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
    const searchScrim = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="dialog-overlay"]',
    );
    await expect(searchScrim).not.toBeNull();
    await expect(getComputedStyle(searchScrim!).backdropFilter).toContain(
      "blur(5px)",
    );
    await expect(getComputedStyle(searchScrim!).backgroundColor).toBe(
      "rgba(0, 0, 0, 0.1)",
    );
    await expect(
      searchDialog.querySelector(
        '[data-ui-component="command-view"][data-ui-part="root"]',
      ),
    ).not.toBeNull();
    await expect(
      within(searchDialog).queryByText(
        "Search rooms, loaded messages, and known members. The relay is queried when it supports NIP-50.",
      ),
    ).not.toBeInTheDocument();
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
      name: "New channel",
    });
    await userEvent.click(
      within(roomEditor).getByRole("button", { name: "Close" }),
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
      (
        await within(searchDialog).findAllByRole("option", {
          name: /How should portable forums work/u,
        })
      )[0]!,
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
      (
        await within(searchDialog).findAllByRole("option", {
          name: /Portable forum URLs should retain relay and group identity/u,
        })
      )[0]!,
    );
    await waitFor(() => expect(searchDialog).not.toBeInTheDocument());
    await expect(
      canvas.getByText("How should portable forums work?"),
    ).toBeVisible();
    await expect(
      await canvas.findByText(
        "Agreed. The reply and activity columns should stay aligned.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    const forumComposer = canvas.getByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.type(forumComposer, "A visible top-level forum reply");
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await expect(
      await canvas.findByText(
        "A visible top-level forum reply",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await waitFor(
      () =>
        expect(application).toHaveAttribute("data-last-action", "sent-message"),
      { timeout: 15_000 },
    );
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
      canvas.getByRole("textbox", { name: "Markdown editor" }),
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
    let directMessageName = "Member";
    if (application.dataset.communityBackend === "docker") {
      await userEvent.click(
        await within(searchDialog).findByRole("option", {
          name: /Hello from a member/u,
        }),
      );
      await waitFor(() => expect(searchDialog).not.toBeInTheDocument());
      await waitFor(() =>
        expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
          "none",
        ),
      );
      const memberMessage = (
        await canvas.findAllByLabelText(/^Message from /u)
      ).find((message) => message.textContent?.includes("Hello from a member"));
      if (!memberMessage) throw new Error("Expected the member's message");
      directMessageName =
        memberMessage
          .getAttribute("aria-label")
          ?.replace("Message from ", "") ?? "member";
      await userEvent.click(
        within(memberMessage).getByRole("button", {
          name: `View ${directMessageName}'s profile`,
        }),
      );
      const profileSidebar = await canvas.findByLabelText("Profile sidebar");
      await userEvent.click(
        within(profileSidebar).getByRole("button", { name: "Message" }),
      );
    } else {
      const memberResults = await within(searchDialog).findAllByRole("option", {
        name: /Member/u,
      });
      const directMessageResult = memberResults.find((result) =>
        result.textContent?.includes("Direct message"),
      );
      if (!directMessageResult)
        throw new Error("Expected the direct-message search result");
      await userEvent.click(directMessageResult);
    }
    await waitFor(() => {
      expect(
        application.querySelector('[data-ui-part="room-title"]'),
      ).toHaveTextContent(directMessageName);
    });
    await expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();
    const directMessageNavigation = canvas.getByRole("button", {
      name: directMessageName,
    });
    await expect(
      directMessageNavigation.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).not.toBeNull();
    await expect(
      directMessageNavigation.querySelector('[data-ui-part="presence"]'),
    ).not.toBeNull();
    const directMessageToolbar = canvas.getByLabelText(
      `${directMessageName} toolbar`,
    );
    const toolbarProfileAction = within(directMessageToolbar).getByRole(
      "button",
      {
        name: `View ${directMessageName}'s profile`,
      },
    );
    await expect(
      toolbarProfileAction.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).not.toBeNull();
    await expect(
      parseFloat(getComputedStyle(directMessageToolbar).paddingBlockStart),
    ).toBeGreaterThanOrEqual(10);
    const directMessageContent = canvas.getByLabelText(
      `${directMessageName} content`,
    );
    await expect(
      within(directMessageContent).queryByRole("heading", {
        name: `#${directMessageName}`,
      }),
    ).not.toBeInTheDocument();
    await expect(
      within(directMessageContent).getByText(
        `This is the beginning of your direct message with ${directMessageName}.`,
      ),
    ).toBeVisible();
    await expect(
      within(directMessageContent).queryByRole("button", {
        name: "Browse channels",
      }),
    ).not.toBeInTheDocument();
    const directIntroProfileAction =
      directMessageContent.querySelector<HTMLElement>(
        '[data-ui-part="direct-message-profile-action"]',
      );
    if (directIntroProfileAction === null)
      throw new Error("Expected direct-message intro profile action");
    await expect(directIntroProfileAction).toHaveAccessibleName(
      `View ${directMessageName}'s profile`,
    );
    await userEvent.click(directIntroProfileAction);
    await expect(await canvas.findByLabelText("Profile sidebar")).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness />
  {/snippet}
</Story>

<Story
  name="Profile presence and status"
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
    let profileTrigger = canvas.getByRole("button", {
      name: /Open profile menu for /u,
    });
    await waitFor(() =>
      expect(getComputedStyle(profileTrigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(profileTrigger);
    let statusAction = overlay
      .getByRole("menu", { name: "Profile menu" })
      .querySelector<HTMLElement>(".community-profile-menu__status-action")!;
    await expect(statusAction).toBeVisible();
    if (application.dataset.communityBackend === "memory") {
      await expect(statusAction).toHaveTextContent("🏠 Working remotely");
    }
    await userEvent.hover(
      overlay.getByRole("menuitem", { name: "Presence: Online" }),
    );
    await userEvent.click(
      await overlay.findByRole("menuitemradio", { name: "Away" }),
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-last-action",
          "presence:away",
        ),
      { timeout: 15_000 },
    );
    await expect(
      profileTrigger.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "away");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    profileTrigger = canvas.getByRole("button", {
      name: /Open profile menu for /u,
    });
    await waitFor(() =>
      expect(getComputedStyle(profileTrigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(profileTrigger);
    statusAction = overlay
      .getByRole("menu", { name: "Profile menu" })
      .querySelector<HTMLElement>(".community-profile-menu__status-action")!;
    await userEvent.click(statusAction);
    const dialog = await overlay.findByRole("dialog", { name: "Set a status" });
    if (application.dataset.communityBackend === "memory") {
      await expect(
        within(dialog).getByLabelText("What's your status?"),
      ).toHaveValue("Working remotely");
    }
    await userEvent.click(
      within(dialog).getByRole("button", { name: "In a meeting" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument(), {
      timeout: 15_000,
    });

    profileTrigger = canvas.getByRole("button", {
      name: /Open profile menu for /u,
    });
    await waitFor(() =>
      expect(getComputedStyle(profileTrigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(profileTrigger);
    await expect(
      overlay.getByRole("menuitem", { name: "🗣️ In a meeting" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    const currentMemberAvatar = (
      await canvas.findAllByRole(
        "button",
        { name: "View steve's profile" },
        { timeout: 15_000 },
      )
    )[0]!;
    await userEvent.hover(currentMemberAvatar);
    const currentMemberPreview = await overlay.findByRole("group", {
      name: "steve contact preview",
    });
    await expect(
      currentMemberPreview.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "away");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="profile-status"
      initialDestination="general"
    />
  {/snippet}
</Story>

<Story
  name="Plugin release messages"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend !== "memory") return;
    const expandNavigation = canvas.queryByRole("button", {
      name: "Expand left sidebar",
    });
    if (expandNavigation) await userEvent.click(expandNavigation);
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "plugin-releases" },
        { timeout: 15_000 },
      ),
    );
    const release = await canvas.findByText(
      "AI Assistant 1.4.0 is ready for curator review.",
      {},
      { timeout: 15_000 },
    );
    await expect(release).toBeVisible();
    await expect(canvas.getByText(/1 reply/u)).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: /AI Assistant.*Approved/u }),
    ).toHaveLength(1);
    const overview = await canvas.findByRole("navigation", {
      name: "Plugin release overview",
    });
    await expect(overview).toBeVisible();
    const reviewsButton = within(overview).getByRole("button", {
      name: /^Reviews/u,
    });
    const reviewsLabel = within(reviewsButton).getByText("Reviews");
    const reviewsCount =
      within(reviewsButton).getByLabelText(/pending reviews/u);
    await expect(getComputedStyle(reviewsButton).fontSize).toBe("14px");
    await expect(
      reviewsButton.getBoundingClientRect().height,
    ).toBeLessThanOrEqual(29);
    await expect(getComputedStyle(reviewsLabel).color).toBe(
      getComputedStyle(reviewsCount).color,
    );
    const overviewItemBackground =
      getComputedStyle(reviewsButton).backgroundColor;
    reviewsButton.focus();
    await waitFor(() => {
      expect(getComputedStyle(reviewsButton).backgroundColor).not.toBe(
        overviewItemBackground,
      );
    });
    reviewsButton.blur();
    const applicationNavigation = canvas.getByRole("navigation", {
      name: "Application navigation",
    });
    const overviewToggle = within(applicationNavigation).getByRole("button", {
      name: "Hide plugin release overview",
    });
    const applicationBounds = application.getBoundingClientRect();
    const toggleBounds = overviewToggle.getBoundingClientRect();
    await expect(
      applicationBounds.right - toggleBounds.right,
    ).toBeLessThanOrEqual(16);
    const overviewSidebar = canvas.getByLabelText(
      "Plugin release overview sidebar",
    );
    const resize = canvas.getByRole("slider", {
      name: "Resize plugin release overview sidebar",
    });
    const widthBefore = overviewSidebar.getBoundingClientRect().width;
    resize.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(overviewSidebar.getBoundingClientRect().width).toBe(
      widthBefore + 16,
    );
    await waitFor(() => {
      const stored = JSON.parse(
        canvasElement.ownerDocument.defaultView?.localStorage.getItem(
          COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
        ) ?? "null",
      ) as { panels?: Record<string, { width?: number }> } | null;
      expect(
        stored?.panels?.[COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID]
          ?.width,
      ).toBe(widthBefore + 16);
    });

    await userEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    const channelSettings = await canvas.findByLabelText(
      "Channel settings sidebar",
    );
    await expect(channelSettings).toBeVisible();
    await expect(overview).toBeVisible();
    const mainSurface = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="main"]',
    );
    await expect(mainSurface).not.toBeNull();
    const mainBounds = mainSurface!.getBoundingClientRect();
    const settingsBounds = channelSettings.getBoundingClientRect();
    const overviewBounds = overviewSidebar.getBoundingClientRect();
    await expect(mainBounds.right).toBeLessThanOrEqual(settingsBounds.left + 1);
    await expect(settingsBounds.right).toBeLessThan(overviewBounds.left);

    await userEvent.click(
      within(overview).getByRole("button", { name: /Reviews/u }),
    );
    const reviewsHeading = await canvas.findByRole("heading", {
      name: "Reviews",
      level: 1,
    });
    await expect(reviewsHeading).toBeVisible();
    const reviewsSheet = reviewsHeading.closest<HTMLElement>(
      '[data-ui-part="surface-layer-surface"]',
    );
    await expect(reviewsSheet).not.toBeNull();
    const reviewsHeader = reviewsHeading.closest("header");
    await expect(reviewsHeader).not.toBeNull();
    await expect(getComputedStyle(reviewsHeader!).borderBottomWidth).toBe(
      "0px",
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("navigation", { name: "Plugin release overview" }),
      ).not.toBeInTheDocument(),
    );
    await expect(mainSurface).toHaveAttribute("aria-hidden", "true");
    await expect(channelSettings).toHaveAttribute("aria-hidden", "true");
    const releaseSheetScrim = canvas.getByRole("button", {
      name: "Back to plugin-releases",
    });
    const sheetBounds = reviewsSheet!.getBoundingClientRect();
    const scrimBounds = releaseSheetScrim.getBoundingClientRect();
    const openApplicationBounds = application.getBoundingClientRect();
    const coveredSettingsBounds = channelSettings.getBoundingClientRect();
    await expect(sheetBounds.left).toBeGreaterThan(mainBounds.left);
    await expect(sheetBounds.left - mainBounds.left).toBeLessThanOrEqual(120);
    await expect(
      openApplicationBounds.right - sheetBounds.right,
    ).toBeGreaterThanOrEqual(7);
    await expect(
      openApplicationBounds.right - sheetBounds.right,
    ).toBeLessThanOrEqual(9);
    await expect(
      Math.abs(sheetBounds.top - mainBounds.top),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(sheetBounds.bottom - coveredSettingsBounds.bottom),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(scrimBounds.left - mainBounds.left),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(scrimBounds.top - mainBounds.top),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(scrimBounds.bottom - coveredSettingsBounds.bottom),
    ).toBeLessThanOrEqual(1);
    await expect(getComputedStyle(releaseSheetScrim).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(
      canvas.getByRole("button", { name: /Reviewed/u }),
    ).toHaveAttribute("data-state", "on");
    const reviewedEntry = canvas.getAllByRole("article", {
      name: /Approved$/u,
    })[0]!;
    const approvedBadges = within(reviewedEntry).getAllByText("Approved");
    await expect(approvedBadges.length).toBeGreaterThanOrEqual(2);
    const reviewStateBadge = approvedBadges[0]!;
    const pluginStateBadge = approvedBadges[1]!;
    await expect(reviewStateBadge).toHaveAttribute(
      "data-ui-component",
      "badge",
    );
    await expect(reviewStateBadge).toHaveAttribute(
      "data-ui-part",
      "community-chip",
    );
    await expect(reviewStateBadge).toHaveAttribute("data-chip-tone", "success");
    const reviewStateStyle = getComputedStyle(reviewStateBadge);
    const pluginStateStyle = getComputedStyle(pluginStateBadge);
    await expect(reviewStateStyle.fontSize).toBe(pluginStateStyle.fontSize);
    await expect(reviewStateStyle.lineHeight).toBe(pluginStateStyle.lineHeight);
    await expect(reviewStateStyle.fontWeight).toBe(pluginStateStyle.fontWeight);

    await userEvent.click(releaseSheetScrim);
    const reopenedOverview = await canvas.findByRole("navigation", {
      name: "Plugin release overview",
    });
    await expect(reopenedOverview).toBeVisible();
    await expect(channelSettings).toBeVisible();
    await expect(channelSettings).not.toHaveAttribute("aria-hidden", "true");
    await userEvent.click(
      within(reopenedOverview).getByRole("button", { name: /People/u }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "People", level: 1 }),
    ).toBeVisible();
    const profileAction = canvas.getAllByRole("button", {
      name: /Open .*'s profile/u,
    })[0]!;
    await userEvent.click(profileAction);
    await expect(canvas.getByLabelText("Profile sidebar")).toBeVisible();
    await expect(
      await canvas.findByRole("navigation", {
        name: "Plugin release overview",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "People", level: 1 }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close right sidebar" }),
    );
    await userEvent.click(
      within(
        canvas.getByRole("navigation", {
          name: "Plugin release overview",
        }),
      ).getByRole("button", { name: /People/u }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Close People" }));
    await expect(mainSurface).not.toHaveAttribute("aria-hidden", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByRole("heading", { name: "People", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Forward" }));
    await waitFor(() =>
      expect(
        canvas.queryByRole("heading", { name: "People", level: 1 }),
      ).not.toBeInTheDocument(),
    );

    await userEvent.click(
      canvas.getByRole("button", { name: /AI Assistant.*Approved/u }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 3 }),
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole("link", { name: "AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByText(
        "AI Assistant 1.4.0 is ready for curator review.",
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "general" }));
    await expect(
      canvas.queryByRole("button", { name: /AI Assistant.*Approved/u }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", {
          name: /plugin release overview/u,
        }),
      ).not.toBeInTheDocument(),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="plugin-release-messages"
      releaseMessages
      useDefaultShell
    />
  {/snippet}
</Story>

<Story
  name="Plugin release constrained sidebars"
  parameters={{
    viewport: {
      options: {
        pluginReleaseConstrained: {
          name: "Plugin release constrained desktop",
          styles: { width: "1375px", height: "998px" },
        },
      },
    },
  }}
  globals={{
    viewport: { value: "pluginReleaseConstrained", isRotated: false },
  }}
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend !== "memory") return;

    const expandNavigation = canvas.queryByRole("button", {
      name: "Expand left sidebar",
    });
    if (expandNavigation) await userEvent.click(expandNavigation);
    await userEvent.click(
      await canvas.findByRole(
        "button",
        { name: "plugin-releases" },
        { timeout: 15_000 },
      ),
    );
    const overview = await canvas.findByRole("navigation", {
      name: "Plugin release overview",
    });
    const mainSurface = application.querySelector<HTMLElement>(
      '[data-ui-part="main"]',
    );
    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    if (!mainSurface || !shell) {
      throw new Error("Expected the plugin release App Shell surfaces");
    }

    await expect(overview).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    const channelSettings = await canvas.findByLabelText(
      "Channel settings sidebar",
    );
    const constrainedOverviewSidebar = await canvas.findByLabelText(
      "Plugin release overview sidebar",
    );

    await waitFor(() => {
      expect(shell).toHaveAttribute("data-display-mode", "desktop");
      expect(
        shell.getAttribute("data-desktop-overlay-panels")?.split(/\s+/),
      ).toContain("right");
      expect(
        shell.getAttribute("data-desktop-overlay-panels")?.split(/\s+/),
      ).not.toContain(COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID);
      expect(getComputedStyle(channelSettings).position).toBe("absolute");
    });
    await expect(channelSettings).toBeVisible();
    await expect(constrainedOverviewSidebar).toBeVisible();
    await expect(mainSurface).toHaveAttribute("inert");
    await expect(mainSurface).toHaveAttribute("aria-hidden", "true");
    await expect(
      getComputedStyle(channelSettings).borderTopRightRadius,
    ).not.toBe("0px");
    await expect(getComputedStyle(channelSettings).boxShadow).toBe("none");
    await expect(getComputedStyle(mainSurface).borderTopRightRadius).not.toBe(
      "0px",
    );

    const mainBounds = mainSurface.getBoundingClientRect();
    const settingsBounds = channelSettings.getBoundingClientRect();
    const overviewBounds = constrainedOverviewSidebar.getBoundingClientRect();
    await expect(
      Math.abs(settingsBounds.left - mainBounds.left),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(settingsBounds.right - mainBounds.right),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(settingsBounds.top - mainBounds.top),
    ).toBeLessThanOrEqual(1);
    await expect(
      Math.abs(settingsBounds.bottom - mainBounds.bottom),
    ).toBeLessThanOrEqual(1);
    await expect(settingsBounds.right).toBeLessThanOrEqual(overviewBounds.left);

    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
    await waitFor(() => {
      expect(
        shell.getAttribute("data-desktop-overlay-panels")?.split(/\s+/) ?? [],
      ).not.toContain("right");
      expect(getComputedStyle(channelSettings).position).toBe("relative");
      expect(mainSurface).not.toHaveAttribute("inert");
      expect(mainSurface).not.toHaveAttribute("aria-hidden", "true");
    });
    const inlineMainBounds = mainSurface.getBoundingClientRect();
    const inlineSettingsBounds = channelSettings.getBoundingClientRect();
    await expect(inlineMainBounds.right).toBeLessThanOrEqual(
      inlineSettingsBounds.left + 1,
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    );
    await waitFor(() => {
      expect(
        shell.getAttribute("data-desktop-overlay-panels")?.split(/\s+/),
      ).toContain("right");
      expect(getComputedStyle(channelSettings).position).toBe("absolute");
      expect(mainSurface).toHaveAttribute("inert");
      expect(mainSurface).toHaveAttribute("aria-hidden", "true");
    });
    await waitFor(() => {
      const restoredMainBounds = mainSurface.getBoundingClientRect();
      const restoredSettingsBounds = channelSettings.getBoundingClientRect();
      expect(
        Math.abs(restoredSettingsBounds.left - restoredMainBounds.left),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(restoredSettingsBounds.right - restoredMainBounds.right),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(restoredSettingsBounds.top - restoredMainBounds.top),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(restoredSettingsBounds.bottom - restoredMainBounds.bottom),
      ).toBeLessThanOrEqual(1);
    });

    await userEvent.click(
      within(channelSettings).getByRole("button", {
        name: "Close channel settings",
      }),
    );
    await waitFor(() => {
      expect(mainSurface).not.toHaveAttribute("inert");
      expect(mainSurface).not.toHaveAttribute("aria-hidden", "true");
      expect(
        shell.getAttribute("data-desktop-overlay-panels")?.split(/\s+/) ?? [],
      ).not.toContain("right");
      expect(
        canvas.getAllByLabelText("Plugin release overview sidebar"),
      ).toHaveLength(1);
      expect(
        application.querySelectorAll(
          ".community-application__standard-right-sidebar",
        ),
      ).toHaveLength(1);
      expect(
        application.querySelector<HTMLElement>(
          ".community-application__standard-right-sidebar",
        ),
      ).not.toBeVisible();
    });
    await expect(
      canvas.getByLabelText("Plugin release overview sidebar"),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    const reopenedSettings = await canvas.findByLabelText(
      "Channel settings sidebar",
    );
    await waitFor(() => {
      expect(getComputedStyle(reopenedSettings).position).toBe("absolute");
      expect(
        canvas.getAllByLabelText("Plugin release overview sidebar"),
      ).toHaveLength(1);
      expect(
        application.querySelectorAll(
          ".community-application__standard-right-sidebar",
        ),
      ).toHaveLength(1);
    });
    await userEvent.click(
      within(reopenedSettings).getByRole("button", {
        name: "Close channel settings",
      }),
    );
    await waitFor(() => {
      expect(reopenedSettings).not.toBeVisible();
      expect(
        canvas.getAllByLabelText("Plugin release overview sidebar"),
      ).toHaveLength(1);
      expect(
        application.querySelectorAll(
          ".community-application__standard-right-sidebar",
        ),
      ).toHaveLength(1);
    });

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await userEvent.click(
        canvas.getByRole("button", { name: "Hide plugin release overview" }),
      );
      await waitFor(() => {
        expect(
          canvas.queryByRole("navigation", {
            name: "Plugin release overview",
          }),
        ).not.toBeInTheDocument();
        expect(
          application.querySelectorAll(
            ".community-application__release-overview-sidebar",
          ).length,
        ).toBeLessThanOrEqual(1);
        expect(
          canvas.getByRole("button", { name: "Show plugin release overview" }),
        ).toBeVisible();
      });
      await userEvent.click(
        canvas.getByRole("button", { name: "Show plugin release overview" }),
      );
      await waitFor(() => {
        expect(
          canvas.getAllByLabelText("Plugin release overview sidebar"),
        ).toHaveLength(1);
        expect(
          canvas.getByLabelText("Plugin release overview sidebar"),
        ).toBeVisible();
      });
    }
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="plugin-release-constrained-sidebars"
      releaseMessages
      responsive
    />
  {/snippet}
</Story>

<Story
  name="Persistent page and sidebar state"
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
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "general" }),
    );
    await waitFor(() => {
      const storage = canvasElement.ownerDocument.defaultView?.localStorage;
      expect(
        JSON.parse(
          storage?.getItem(COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY) ??
            "null",
        ),
      ).toEqual({ version: 2, destination: "general" });
      expect(
        JSON.parse(
          storage?.getItem(COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY) ??
            "null",
        ).panels.left.collapsed,
      ).toBe(false);
    });

    const storyWindow = canvasElement.ownerDocument.defaultView;
    if (!storyWindow) throw new Error("Expected a Storybook window");
    storyWindow.dispatchEvent(
      new storyWindow.Event("community-story-remount-application"),
    );
    await waitFor(() =>
      expect(canvas.getByTestId("full-community-application")).toHaveAttribute(
        "data-application-generation",
        "1",
      ),
    );
    await expect(
      await canvas.findByRole("button", { name: "Collapse left sidebar" }),
    ).toBeVisible();
    const restoredExpandedSidebar = await canvas.findByLabelText(
      "Community navigation sidebar",
    );
    await expect(restoredExpandedSidebar).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(
      within(restoredExpandedSidebar).getByRole("navigation", {
        name: "Community navigation",
      }),
    ).not.toHaveAttribute("data-compact");
    await expect(
      canvas.getByRole("button", { name: "general" }),
    ).toHaveAttribute("aria-current", "page");

    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Registry" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await waitFor(() => {
      const storage = canvasElement.ownerDocument.defaultView?.localStorage;
      expect(
        JSON.parse(
          storage?.getItem(COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY) ??
            "null",
        ),
      ).toEqual({ version: 2, destination: "registry" });
      expect(
        JSON.parse(
          storage?.getItem(COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY) ??
            "null",
        ).panels.left.collapsed,
      ).toBe(true);
    });

    storyWindow.dispatchEvent(
      new storyWindow.Event("community-story-remount-application"),
    );
    await waitFor(() =>
      expect(canvas.getByTestId("full-community-application")).toHaveAttribute(
        "data-application-generation",
        "2",
      ),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand left sidebar" }),
    ).toBeVisible();
    const restoredCollapsedSidebar = await canvas.findByLabelText(
      "Community navigation sidebar",
    );
    await expect(restoredCollapsedSidebar).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(
      within(restoredCollapsedSidebar).getByRole("navigation", {
        name: "Community navigation",
      }),
    ).toHaveAttribute("data-compact", "true");
    await expect(
      canvas.getByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="persistent-application-state"
      useDefaultShell
      persistenceScenario
    />
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
      canvas.getAllByRole("link", { name: /Plugins/u })[0]!,
    );
    await expect(await canvas.findByText("8 results")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("link", { name: "Open AI Assistant" }),
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
    const overlay = within(canvasElement.ownerDocument.body);
    const shell = application.querySelector<HTMLElement>(
      "[data-right-sidebar-state]",
    );
    if (!shell) throw new Error("Expected the application shell state element");
    const rightSidebars = (): NodeListOf<HTMLElement> =>
      canvasElement.querySelectorAll<HTMLElement>(
        'aside[data-side="right"]:not([hidden])',
      );
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

    const leaveChannel = canvas.getByRole("button", {
      name: "Leave channel",
    });
    const destructiveColor = getComputedStyle(leaveChannel).color;
    await userEvent.click(leaveChannel);
    const leaveDialog = await overlay.findByRole("alertdialog", {
      name: "Leave general?",
    });
    await expect(leaveDialog).toBeVisible();
    await expect(leaveDialog.getBoundingClientRect().width).toBeLessThanOrEqual(
      448,
    );
    await expect(leaveDialog.getBoundingClientRect().width).toBeLessThan(
      canvasElement.ownerDocument.documentElement.clientWidth,
    );
    await expect(
      getComputedStyle(
        within(leaveDialog).getByRole("button", { name: "Leave" }),
      ).backgroundColor,
    ).toBe(destructiveColor);
    await userEvent.click(
      within(leaveDialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => expect(leaveDialog).not.toBeInTheDocument());

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
    const openedProfileSidebar = await expectRightPanel("Profile sidebar");
    await expect(
      within(openedProfileSidebar).getByRole("button", { name: "Wave" }),
    ).toBeVisible();
    const storyWindow = canvasElement.ownerDocument.defaultView;
    if (!storyWindow) throw new Error("Expected the Storybook window");
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      storyWindow.navigator,
      "clipboard",
    );
    const writeText =
      fn<(value: string) => Promise<void>>().mockResolvedValue();
    Object.defineProperty(storyWindow.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      const copyPublicKey = within(openedProfileSidebar).getByRole("button", {
        name: /^Copy .+'s public key$/u,
      });
      await waitFor(() =>
        expect(getComputedStyle(copyPublicKey).pointerEvents).toBe("auto"),
      );
      await userEvent.click(copyPublicKey);
      await expect(writeText).toHaveBeenCalledOnce();
      await expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f]{64}$/u),
      );
      await expect(
        await overlay.findByText("Public key copied"),
      ).toBeInTheDocument();

      writeText.mockRejectedValueOnce(new Error("Clipboard unavailable"));
      await userEvent.click(copyPublicKey);
      await expect(
        await overlay.findByText("Could not copy to the clipboard"),
      ).toBeInTheDocument();
    } finally {
      toast.dismiss();
      await waitFor(() =>
        expect(
          canvasElement.ownerDocument.querySelectorAll("[data-sonner-toast]"),
        ).toHaveLength(0),
      );
      if (clipboardDescriptor) {
        Object.defineProperty(
          storyWindow.navigator,
          "clipboard",
          clipboardDescriptor,
        );
      } else {
        Reflect.deleteProperty(storyWindow.navigator, "clipboard");
      }
    }
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
      (await canvas.findAllByRole("button", { name: "Reply in thread" }))[0]!,
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
  globals={{ viewport: { value: "tablet", isRotated: false } }}
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
    const message = replyButton.closest<HTMLElement>("article");
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
      within(threadSidebar).getByRole("textbox", {
        name: "Markdown editor",
      }),
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

<Story
  name="Attach channel from project overview"
  play={async ({ canvas, canvasElement }) => {
    const app = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (app.dataset.communityBackend !== "memory") return;
    const expand = canvas.queryByRole("button", {
      name: "Expand left sidebar",
    });
    if (expand) await userEvent.click(expand);
    const channelsTab = await canvas.findByRole("tab", { name: "Channels" });
    await waitFor(() =>
      expect(getComputedStyle(channelsTab).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(channelsTab);
    const overview = await canvas.findByRole("navigation", {
      name: "Project overview",
    });
    await userEvent.click(
      within(overview).getByRole("button", { name: "Add channel" }),
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Add channel to Community Client" },
    );
    await userEvent.click(
      within(dialog).getByRole("option", { name: /^#plugin-releases\b/u }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const projects = canvasElement.querySelector<HTMLElement>(
      '.community-projects[data-view="channels"]',
    )!;
    await expect(
      await within(projects).findByRole("button", {
        name: /^#plugin-releases\b/u,
      }),
    ).toBeVisible();
    const channels = canvasElement.querySelector<HTMLElement>(
      '[data-navigation-section-kind="channels"]',
    )!;
    await expect(
      within(channels)
        .getByRole("button", { name: "plugin-releases", exact: true })
        .querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeVisible();

    await userEvent.click(
      within(channels).getByRole("button", {
        name: "plugin-releases",
        exact: true,
      }),
    );
    const projectOverview = await canvas.findByRole("navigation", {
      name: "Project overview",
    });
    const plugins = within(projectOverview).getByRole("group", {
      name: "Plugins",
    });
    await expect(plugins).toBeVisible();
    await expect(projectOverview.firstElementChild).toBe(plugins);
    await expect(
      canvas.queryByLabelText("Plugin release overview sidebar"),
    ).not.toBeInTheDocument();
    await expect(
      within(projectOverview).getByText("Community Client", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      within(plugins).getByRole("button", { name: /^Reviews/u }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Reviews", level: 1 }),
    ).toBeVisible();
    await expect(projectOverview).not.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close Reviews" }),
    );
    await expect(plugins).toBeVisible();
    await userEvent.click(
      within(plugins).getByRole("button", { name: /^People/u }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "People", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close People" }));
    await expect(plugins).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back", exact: true }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "People", level: 1 }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Forward", exact: true }),
    );
    await expect(plugins).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Search community" }),
    );
    const searchDialog = await within(
      canvasElement.ownerDocument.body,
    ).findByRole("dialog", { name: "Search community" });
    await userEvent.type(
      within(searchDialog).getByLabelText("Search community"),
      "plugin-releases",
    );
    const releaseResult = await within(searchDialog).findByRole("option", {
      name: /^plugin-releases\b/u,
    });
    await expect(
      releaseResult.querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeVisible();
    await userEvent.click(releaseResult);
    await waitFor(() => expect(searchDialog).not.toBeInTheDocument());
    await expect(plugins).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="attach-project-channel"
      projects
      releaseMessages
      initialDestination="projects"
    />
  {/snippet}
</Story>
