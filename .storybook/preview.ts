import type { Preview } from "@storybook/svelte-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { syncCatalogStoryLayout } from "@lapismd/design-core/storybook/catalog-layout";

import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "./preview.css";

const communityRelayUrl = (
  import.meta as ImportMeta & {
    env?: {
      VITE_COMMUNITY_RELAY_BACKEND?: string;
      VITE_COMMUNITY_RELAY_URL?: string;
      VITE_COMMUNITY_LIVE_RELAY_URL?: string;
      VITE_COMMUNITY_LIVE_CHANNEL_GROUP_ID?: string;
      VITE_COMMUNITY_LIVE_FORUM_GROUP_ID?: string;
    };
  }
).env?.VITE_COMMUNITY_RELAY_URL;
const communityLiveRelayUrl =
  (
    import.meta as ImportMeta & {
      env?: { VITE_COMMUNITY_LIVE_RELAY_URL?: string };
    }
  ).env?.VITE_COMMUNITY_LIVE_RELAY_URL ?? "ws://registry.localhost:8281";
const communityLiveChannelGroupId = (
  import.meta as ImportMeta & {
    env?: { VITE_COMMUNITY_LIVE_CHANNEL_GROUP_ID?: string };
  }
).env?.VITE_COMMUNITY_LIVE_CHANNEL_GROUP_ID;
const communityLiveForumGroupId = (
  import.meta as ImportMeta & {
    env?: { VITE_COMMUNITY_LIVE_FORUM_GROUP_ID?: string };
  }
).env?.VITE_COMMUNITY_LIVE_FORUM_GROUP_ID;
const communityRelayBackend = (
  import.meta as ImportMeta & {
    env?: { VITE_COMMUNITY_RELAY_BACKEND?: string };
  }
).env?.VITE_COMMUNITY_RELAY_BACKEND;
const registryRelays = (
  import.meta as ImportMeta & { env?: { VITE_REGISTRY_RELAYS?: string } }
).env?.VITE_REGISTRY_RELAYS;
const registryCuratorPubkeys = (
  import.meta as ImportMeta & {
    env?: { VITE_REGISTRY_CURATOR_PUBKEYS?: string };
  }
).env?.VITE_REGISTRY_CURATOR_PUBKEYS;
const registryPublisherPubkeys = (
  import.meta as ImportMeta & {
    env?: { VITE_REGISTRY_PUBLISHER_PUBKEYS?: string };
  }
).env?.VITE_REGISTRY_PUBLISHER_PUBKEYS;
const registryBlossomUrl = (
  import.meta as ImportMeta & { env?: { VITE_BLOSSOM_URL?: string } }
).env?.VITE_BLOSSOM_URL;

const preview: Preview = {
  tags: ["autodocs", "test"],
  globalTypes: {
    theme: {
      description: "Brand theme",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "default", title: "Default" },
          { value: "lapis", title: "Lapis" },
        ],
        dynamicTitle: true,
      },
    },
    communityBackend: {
      description: "Community relay backend",
      toolbar: {
        icon: "database",
        items: [
          { value: "memory", title: "In-memory relay" },
          ...(communityRelayUrl === undefined || communityRelayUrl === ""
            ? []
            : [{ value: "docker", title: "Docker relay" }]),
          ...(communityLiveRelayUrl === ""
            ? []
            : [{ value: "live", title: "Live registry relay" }]),
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorMode: "light",
    communityBackend:
      communityRelayBackend === "docker" && communityRelayUrl
        ? "docker"
        : communityRelayBackend === "live" && communityLiveRelayUrl
          ? "live"
          : "memory",
    theme: "default",
  },
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i } },
    docs: { toc: true },
    a11y: { test: "error" },
    backgrounds: { disable: true },
    themes: { disable: true },
    options: {
      storySort: {
        order: [
          "Community",
          [
            "Navigation",
            ["Sidebar", "Community Switcher"],
            "Inbox",
            "Channels",
            [
              "Conversation",
              "Message",
              "Thread Panel",
              "Channel Settings",
              "Details",
            ],
            "Forums",
            "Discussion",
            "Registry",
            [
              "Landing",
              "Directory",
              "Plugin Card",
              "Media Gallery",
              "Plugin Detail",
              "Browser",
              "Header",
              "Summary",
              "Plugin Reactions",
              "Community lifecycle",
            ],
            "Examples",
            ["App Shell"],
          ],
        ],
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        default: "default",
        lapis: "lapis",
      },
      defaultTheme: "default",
      attributeName: "data-ui-theme",
    }),
    (story, context) => {
      if (typeof document !== "undefined") {
        syncCatalogStoryLayout(document, context);
        if (
          context.viewMode === "story" &&
          context.parameters.communityAppShell === true
        ) {
          document.body.setAttribute("data-ui-catalog-full-viewport", "");
        }
        document.documentElement.classList.toggle(
          "dark",
          context.globals.colorMode === "dark",
        );
        const previousCommunityBackend =
          document.documentElement.dataset.communityBackend;
        const nextCommunityBackend =
          context.globals.communityBackend === "docker"
            ? "docker"
            : context.globals.communityBackend === "live"
              ? "live"
              : "memory";
        document.documentElement.dataset.communityBackend =
          nextCommunityBackend;
        if (communityRelayUrl === undefined || communityRelayUrl === "") {
          delete document.documentElement.dataset.communityRelayUrl;
        } else {
          document.documentElement.dataset.communityRelayUrl =
            communityRelayUrl;
        }
        document.documentElement.dataset.communityLiveRelayUrl =
          communityLiveRelayUrl;
        if (communityLiveChannelGroupId) {
          document.documentElement.dataset.communityLiveChannelGroupId =
            communityLiveChannelGroupId;
        } else {
          delete document.documentElement.dataset.communityLiveChannelGroupId;
        }
        if (communityLiveForumGroupId) {
          document.documentElement.dataset.communityLiveForumGroupId =
            communityLiveForumGroupId;
        } else {
          delete document.documentElement.dataset.communityLiveForumGroupId;
        }
        for (const [key, value] of Object.entries({
          registryRelays,
          registryCuratorPubkeys,
          registryPublisherPubkeys,
          registryBlossomUrl,
        })) {
          if (value) document.documentElement.dataset[key] = value;
          else delete document.documentElement.dataset[key];
        }
        if (
          previousCommunityBackend !== undefined &&
          previousCommunityBackend !== nextCommunityBackend
        ) {
          queueMicrotask(() =>
            window.dispatchEvent(new Event("community-story-backend-change")),
          );
        }
      }
      return story();
    },
  ],
};

export default preview;
