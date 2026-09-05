import type { CommunityNavigationModel } from "./model.js";

export const communityNavigationFixture: CommunityNavigationModel = {
  searchPlaceholder: "Search everything",
  primaryItems: [
    {
      id: "inbox",
      label: "Inbox",
      kind: "inbox",
    },
    {
      id: "registry",
      label: "Registry",
      kind: "registry",
      icon: "package-search",
    },
  ],
  sections: [
    {
      id: "channels",
      label: "Channels",
      kind: "channels",
      primaryAction: {
        id: "create",
        label: "Create channel",
        icon: "create",
      },
      actions: [
        { id: "browse", label: "Browse channels", icon: "browse-channels" },
      ],
      sortable: true,
      items: [
        {
          id: "general",
          label: "general",
          kind: "channel",
          activityAt: "2026-09-02T11:45:00Z",
        },
        {
          id: "plugin-releases",
          label: "plugin-releases",
          kind: "channel",
          restricted: true,
          activityAt: "2026-09-02T09:20:00Z",
        },
        {
          id: "plugin-development",
          label: "plugin-development",
          kind: "channel",
          activityAt: "2026-09-01T16:10:00Z",
        },
      ],
    },
    {
      id: "forums",
      label: "Forums",
      kind: "forums",
      primaryAction: {
        id: "create",
        label: "Create forum",
        icon: "create",
      },
      actions: [
        { id: "browse", label: "Browse forums", icon: "browse-forums" },
      ],
      sortable: true,
      items: [
        {
          id: "forums",
          label: "Plugin forums",
          kind: "forum",
          activityAt: "2026-09-01T18:05:00Z",
        },
        {
          id: "support-ai",
          label: "AI support",
          kind: "forum",
          activityAt: "2026-09-02T10:30:00Z",
        },
      ],
    },
    {
      id: "direct-messages",
      label: "Direct messages",
      kind: "direct-messages",
      actions: [{ id: "new", label: "New direct message", icon: "compose" }],
      sortable: true,
      items: [],
    },
  ],
};
