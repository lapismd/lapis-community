<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import { SecretKeyRegistrySigner } from "../../auth/index.js";
  import type {
    RegistryCatalogDataSource,
    RegistryCatalogSourceListener,
    RegistryReleaseInspection,
  } from "../../registry/index.js";
  import {
    createRegistryStoryDataSource,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryReleaseDisclosure from "./RegistryReleaseDisclosure.svelte";
  import RegistryReleaseDisclosureManagementStoryHarness from "./RegistryReleaseDisclosureManagementStoryHarness.svelte";

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
  const revisionListeners = new Set<RegistryCatalogSourceListener>();
  const observedInspection = fn(async () => inspection("approved"));
  const observedCapabilities = fn(async () => undefined);
  const observedSource: RegistryCatalogDataSource = {
    ...approved,
    loadReleaseInspection: observedInspection,
    loadReleaseManagementCapabilities: observedCapabilities,
    subscribe(listener) {
      revisionListeners.add(listener);
      return () => {
        revisionListeners.delete(listener);
      };
    },
  };
  const performReleaseAction = fn(async (request) => ({
    action: request.action,
    eventId: request.eventId,
    decisionEventId: "d".repeat(64),
    headEventId: "e".repeat(64),
  }));
  const managementSource: RegistryCatalogDataSource = {
    ...sourceFor(inspection("pending")),
    async loadReleaseManagementCapabilities(requestedEventId) {
      return requestedEventId === eventId
        ? {
            eventId,
            state: "pending",
            trust: "fresh",
            actions: ["approve", "reject"],
            headEventId: "a".repeat(64),
          }
        : undefined;
    },
    performReleaseAction,
  };
  const curatorSigner = new SecretKeyRegistrySigner(new Uint8Array(32).fill(7));
  async function expectFullCanvasWidth(canvasElement: HTMLElement) {
    const disclosure = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="registry-release-disclosure"]',
    );
    if (disclosure === null) {
      throw new Error("Expected the release disclosure");
    }
    const rootStyle = getComputedStyle(canvasElement);
    const availableWidth =
      canvasElement.clientWidth -
      Number.parseFloat(rootStyle.paddingLeft) -
      Number.parseFloat(rootStyle.paddingRight);
    await expect(disclosure.getBoundingClientRect().width).toBeCloseTo(
      availableWidth,
      0,
    );
  }

  async function expand({
    canvas,
    canvasElement,
  }: {
    canvas: ReturnType<typeof within>;
    canvasElement: HTMLElement;
  }) {
    await expectFullCanvasWidth(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /1\.4\.0/u }),
    );
    await expectFullCanvasWidth(canvasElement);
  }
  const { Story } = defineMeta({
    title: "Community/Registry/Release Disclosure",
    component: RegistryReleaseDisclosure,
    tags: ["visual-pending"],
    args: {
      eventId,
      source: approved,
      onOpenPlugin: fn(),
    },
    parameters: {
      layout: "padded",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryReleaseDisclosure eventId={message.id} source={registrySource} onOpenPlugin={openPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Approved collapsed"
  play={async ({ canvas, canvasElement }) => {
    await expectFullCanvasWidth(canvasElement);
    const trigger = await canvas.findByRole("button", { name: /1\.4\.0/u });
    await userEvent.hover(trigger);
    await expect(trigger).toBeVisible();
  }}
/>

<Story
  name="Status updates preserve inspection"
  args={{ source: observedSource }}
  play={async ({ canvas }) => {
    const trigger = await canvas.findByRole("button", { name: /1\.4\.0/u });
    await expect(trigger).toBeVisible();
    await expect(observedInspection).toHaveBeenCalledTimes(1);
    const status = {
      phase: "refreshing" as const,
      fresh: false,
      installReady: false,
      relays: [],
    };
    for (const listener of revisionListeners)
      listener({ type: "status", status });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(observedCapabilities).toHaveBeenCalledTimes(1));
    for (const listener of revisionListeners)
      listener({ type: "status", status });
    await waitFor(() => expect(observedCapabilities).toHaveBeenCalledTimes(2));
    await expect(observedInspection).toHaveBeenCalledTimes(1);
    for (const listener of revisionListeners)
      listener({ type: "revision", status });
    await waitFor(() => expect(observedInspection).toHaveBeenCalledTimes(2));
    await expect(trigger).toBeVisible();
  }}
/>

<Story
  name="Approved expanded"
  play={async (context) => {
    await expand(context);
    const { canvas, canvasElement } = context;
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 3 }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "AI Assistant" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "By Lapis Labs" }),
    ).toBeVisible();
    for (const label of ["Desktop", "Web"]) {
      const chip = canvas
        .getByText(label)
        .closest<HTMLElement>('[data-ui-part="community-chip"]');
      await expect(chip).not.toBeNull();
      await expect(chip).toHaveAttribute("data-ui-component", "badge");
      await expect(chip?.querySelector("svg")).not.toBeNull();
    }
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
      await page.findByRole("heading", { name: "AI Assistant media viewer" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "dark",
    );
    await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getAllByRole("option")).toHaveLength(1);
    await expect(
      page.getByRole("option", {
        name: "AI Assistant running inside Lapis Notes",
      }),
    ).toHaveAttribute("aria-selected", "true");
    await userEvent.click(
      page.getByRole("button", { name: "Close media viewer" }),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(overview);
    await expect(page.getAllByRole("option")).toHaveLength(1);
    await expect(
      page.getByRole("option", { name: "AI Assistant overview" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "preview",
    );
    await userEvent.click(
      page.getByRole("button", { name: "Close media viewer" }),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(canvas.getByRole("tab", { name: /Releases/u }));
    const signedBundles = canvas.getAllByText("Signed bundle");
    await expect(signedBundles).toHaveLength(2);
    for (const signedBundle of signedBundles) {
      await expect(signedBundle).toHaveAttribute("data-ui-component", "badge");
      await expect(signedBundle).toHaveAttribute(
        "data-ui-part",
        "community-chip",
      );
    }
    await userEvent.click(canvas.getByRole("tab", { name: "Details" }));
    await expect(canvas.getByText("Current version")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Changelog" }));
    await expect(
      await canvas.findByRole("heading", { name: /Better defaults/u }),
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
  name="Withdrawn"
  args={{ source: sourceFor(inspection("withdrawn")) }}
  play={expand}
/>

<Story
  name="Curator management"
  play={async ({ canvas, canvasElement }) => {
    await expand({ canvas, canvasElement });
    await expect(
      await canvas.findByRole("region", { name: "Release management" }),
    ).toBeVisible();
    const document = canvasElement.ownerDocument;
    const destructiveProbe = document.createElement("span");
    destructiveProbe.style.color = "var(--destructive)";
    document.body.append(destructiveProbe);
    const destructiveColor = getComputedStyle(destructiveProbe).color;
    destructiveProbe.remove();
    const reject = canvas.getByRole("button", { name: "Reject release" });
    await expect(getComputedStyle(reject).backgroundColor).toBe(
      destructiveColor,
    );
    await userEvent.click(reject);
    const page = within(document.body);
    const rejectDialog = page.getByRole("alertdialog", {
      name: "Reject release?",
    });
    await expect(
      rejectDialog.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(448);
    await expect(rejectDialog.getBoundingClientRect().width).toBeLessThan(
      document.documentElement.clientWidth,
    );
    await expect(
      getComputedStyle(
        within(rejectDialog).getByRole("button", { name: "Continue" }),
      ).backgroundColor,
    ).toBe(destructiveColor);
    await userEvent.click(
      within(rejectDialog).getByRole("button", { name: "Continue" }),
    );
    await expect(performReleaseAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reject",
        eventId,
        expectedManifestSha256: "0".repeat(64),
        expectedHeadEventId: "a".repeat(64),
      }),
      curatorSigner,
    );
  }}
>
  {#snippet template()}
    <RegistryReleaseDisclosureManagementStoryHarness
      {eventId}
      source={managementSource}
      signer={curatorSigner}
    />
  {/snippet}
</Story>

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
  globals={{ viewport: { value: "mobile1", isRotated: false } }}
  play={expand}
/>

<Story name="Dark" globals={{ colorMode: "dark" }} play={expand} />
