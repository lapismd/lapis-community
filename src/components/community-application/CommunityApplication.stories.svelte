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
  import { createHttpRegistryCatalogDataSource } from "@lapismd/lapis-community/registry";
  import {
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
    createCommunityController,
    createNip29CommunitySource,
  } from "@lapismd/lapis-community/community";
  import { createWebSocketCommunityRelayFactory } from "@lapismd/lapis-community/nostr";

  const community = createCommunityController({
    scopes,
    identity,
    stateStore,
    source: createNip29CommunitySource({
      relayFactory: createWebSocketCommunityRelayFactory(),
    }),
    configurationStore: createBrowserCommunityConfigurationStore(),
    runtime: createBrowserCommunityEventRuntime(),
  });
  const registrySource = createHttpRegistryCatalogDataSource({
    baseUrl: "/registry/",
  });

  onMount(() => {
    community.initialize();
    return () => community.dispose();
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
  name="Full community app"
  play={async ({ canvas }) => {
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
    await userEvent.click(canvas.getByRole("button", { name: "general" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "View steve's profile" }),
    );
    await expect(await canvas.findByLabelText("Profile sidebar")).toBeVisible();
    await fireEvent.click(
      canvas.getAllByRole("button", { name: "Reply in thread" })[0]!,
    );
    const threadSidebar = await canvas.findByLabelText("Thread sidebar");
    await expect(threadSidebar).toBeVisible();
    await expect(
      within(threadSidebar).getByLabelText("Thread from steve"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness />
  {/snippet}
</Story>
