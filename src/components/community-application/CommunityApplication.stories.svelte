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
  import {
    COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
  } from "./navigation.js";

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
    globals: { viewport: { value: "desktop", isRotated: false } },
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
        expect(
          canvasElement.querySelector('[data-ui-part="room-membership"]'),
        ).toBeNull(),
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
        expect(
          canvasElement.querySelector('[data-ui-part="room-membership"]'),
        ).toBeNull(),
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
    await userEvent.hover(message);
    const addReaction = within(message).getByRole("button", {
      name: "Add reaction",
    });
    await waitFor(() => expect(addReaction).toBeVisible());
    await userEvent.click(addReaction);
    let standardEmoji: HTMLButtonElement | null = null;
    await waitFor(() => {
      standardEmoji =
        canvasElement.ownerDocument
          .querySelector("em-emoji-picker")
          ?.shadowRoot?.querySelector<HTMLButtonElement>(
            ".category button[aria-label]",
          ) ?? null;
      expect(standardEmoji).not.toBeNull();
    });
    await userEvent.click(standardEmoji!);

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
    await expect(
      application
        .querySelector('[data-ui-part="room-title"]')
        ?.querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();
    const directMessageToolbar = canvas.getByLabelText(
      `${directMessageName} toolbar`,
    );
    await expect(
      parseFloat(getComputedStyle(directMessageToolbar).paddingBlockStart),
    ).toBeGreaterThanOrEqual(10);
    await expect(
      canvas.getByText(
        `This is the beginning of your direct message with ${directMessageName}.`,
      ),
    ).toBeVisible();
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
    await expect(application).toHaveAttribute(
      "data-last-action",
      "presence:away",
    );
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
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness namespace="profile-status" />
  {/snippet}
</Story>

<Story
  name="Plugin release messages"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    if (application.dataset.communityBackend !== "memory") return;
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
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="plugin-release-messages"
      releaseMessages
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
      ).toEqual({ version: 1, destination: "general" });
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
      ).toEqual({ version: 1, destination: "registry" });
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
    const overlay = within(canvasElement.ownerDocument.body);
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
