<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";

  import type {
    RegistryCatalogDataSource,
    RegistryReleaseInspection,
  } from "../../registry/index.js";
  import {
    createRegistryStoryDataSource,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryReleaseDisclosure from "./RegistryReleaseDisclosure.svelte";

  const eventId = "release-event";
  const resolved = registryStoryResolvedDetail();

  function inspection(
    state: RegistryReleaseInspection["state"],
    diagnostics: RegistryReleaseInspection["diagnostics"] = [],
  ): RegistryReleaseInspection {
    return {
      eventId,
      pluginId: resolved.entry.id,
      version: resolved.entry.latestVersion,
      manifestSha256: "0".repeat(64),
      state,
      ...(state === "invalid" ||
      state === "untrusted" ||
      state === "unavailable"
        ? {}
        : { preview: { entry: resolved.entry, detail: resolved.detail } }),
      diagnostics,
    };
  }

  function sourceFor(
    value: RegistryReleaseInspection,
  ): RegistryCatalogDataSource {
    const base = createRegistryStoryDataSource();
    return {
      ...base,
      async loadReleaseInspection(requestedEventId) {
        return requestedEventId === eventId ? value : undefined;
      },
    };
  }

  const approved = sourceFor(inspection("approved"));
  async function expand({ canvas }: { canvas: ReturnType<typeof within> }) {
    await userEvent.click(
      await canvas.findByRole("button", { name: /1\.4\.0/u }),
    );
  }
  const { Story } = defineMeta({
    title: "Community/Registry/Release Disclosure",
    component: RegistryReleaseDisclosure,
    tags: ["visual-pending"],
    args: {
      eventId,
      source: approved,
      onOpenPlugin: () => {},
    },
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryReleaseDisclosure eventId={message.id} source={registrySource} onOpenPlugin={openPlugin} />`,
        },
      },
    },
  });
</script>

<Story name="Approved collapsed" />

<Story
  name="Approved expanded"
  play={async (context) => {
    await expand(context);
    const { canvas } = context;
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 3 }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "AI Assistant" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "By Lapis Labs" }),
    ).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: /Open screenshot/u }),
    ).toHaveLength(2);
    const banner = canvas.getByRole("button", {
      name: /AI Assistant running inside Lapis Notes/u,
    });
    const overview = canvas.getByRole("button", {
      name: /AI Assistant overview/u,
    });
    await expect(overview).toBeVisible();
    await userEvent.click(banner);
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant media viewer" }),
    ).toBeVisible();
    await expect(canvas.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "dark",
    );
    await expect(canvas.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getAllByRole("option")).toHaveLength(1);
    await expect(
      canvas.getByRole("option", {
        name: "AI Assistant running inside Lapis Notes",
      }),
    ).toHaveAttribute("aria-selected", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Close media viewer" }),
    );
    await userEvent.click(overview);
    await expect(canvas.getAllByRole("option")).toHaveLength(1);
    await expect(
      canvas.getByRole("option", { name: "AI Assistant overview" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "preview",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Close media viewer" }),
    );
    await userEvent.click(canvas.getByRole("tab", { name: /Releases/u }));
    await expect(canvas.getAllByText("Signed bundle")).toHaveLength(2);
    await userEvent.click(canvas.getByRole("tab", { name: "Details" }));
    await expect(canvas.getByText("Current version")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Changelog" }));
    await expect(
      await canvas.findByRole("heading", { name: "Changelog" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Pending"
  args={{ source: sourceFor(inspection("pending")) }}
  play={expand}
/>

<Story
  name="Rejected"
  args={{ source: sourceFor(inspection("rejected")) }}
  play={expand}
/>

<Story
  name="Revoked"
  args={{ source: sourceFor(inspection("revoked")) }}
  play={expand}
/>

<Story
  name="Untrusted"
  args={{
    source: sourceFor(
      inspection("untrusted", [
        {
          stage: "authority",
          code: "untrusted-publisher",
          path: "event.pubkey",
          message: "Release signer is not a configured publisher.",
        },
      ]),
    ),
  }}
  play={expand}
/>

<Story
  name="Invalid schema"
  args={{
    source: sourceFor(
      inspection("invalid", [
        {
          stage: "schema",
          code: "invalid_type",
          path: "release.version",
          message: "Expected string, received number.",
        },
      ]),
    ),
  }}
  play={async (context) => {
    await expand(context);
    const { canvas } = context;
    await expect(await canvas.findByText("release.version")).toBeVisible();
    await expect(
      canvas.queryByRole("link", { name: "AI Assistant" }),
    ).not.toBeInTheDocument();
  }}
/>

<Story
  name="Unavailable manifest"
  args={{
    source: sourceFor(
      inspection("unavailable", [
        {
          stage: "attachment",
          code: "manifest-unavailable",
          path: "manifest",
          message: "Release manifest is currently unavailable.",
        },
      ]),
    ),
  }}
  play={expand}
/>

<Story
  name="Responsive"
  parameters={{ viewport: { defaultViewport: "mobile1" } }}
  play={expand}
/>

<Story name="Dark" globals={{ colorMode: "dark" }} play={expand} />
