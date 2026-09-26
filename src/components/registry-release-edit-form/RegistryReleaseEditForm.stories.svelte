<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryReleaseEditForm from "./RegistryReleaseEditForm.svelte";

  const pendingEntry =
    registryStoryEntries.find((entry) => entry.status === "pending") ??
    registryStoryEntries[0]!;
  const resolved = registryStoryResolvedDetail(pendingEntry);
  const saveDraft = fn();
  const cancelEdit = fn();
  const manifestSha256 = "2".repeat(64);
  const releaseEventId = "1".repeat(64);

  function lastSavedDraft(): RegistryReleaseEditDraft {
    const calls = saveDraft.mock.calls;
    const lastCall = calls.at(-1);
    if (!lastCall) throw new Error("Expected save callback to be called");
    return lastCall[0] as RegistryReleaseEditDraft;
  }

  const { Story } = defineMeta({
    title: "Community/Registry/Release Edit Form",
    component: RegistryReleaseEditForm,
    tags: ["visual-pending"],
    args: {
      resolved,
      releaseEventId,
      manifestSha256,
      publisherIdentity: "npub1publisherexample",
      onSave: saveDraft,
      onCancel: cancelEdit,
    },
    parameters: {
      layout: "padded",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryReleaseEditForm
  resolved={pendingRelease.preview}
  releaseEventId={pendingRelease.eventId}
  manifestSha256={pendingRelease.manifestSha256}
  publisherIdentity={pendingRelease.publisherNpub}
  onSave={saveDraft}
  onCancel={cancelEdit}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Pending release metadata"
  play={async ({ canvas, canvasElement }) => {
    saveDraft.mockClear();
    cancelEdit.mockClear();

    const name = await canvas.findByLabelText("Plugin name");
    await userEvent.clear(name);
    await userEvent.click(canvas.getByRole("button", { name: "Save draft" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Plugin name is required",
    );
    await expect(saveDraft).not.toHaveBeenCalled();

    await userEvent.type(name, "Bases Lab");
    await expect(
      canvas.getByRole("tablist", { name: "Release edit areas" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Media" }));
    await expect(
      await canvas.findByRole("button", { name: "Collapse Logo" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Logo reference" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add media reference" }),
    );
    await expect(
      await canvas.findByLabelText("Media reference title"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Logo" }));
    await expect(
      await canvas.findByRole("button", { name: "Collapse Logo" }),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Add screenshot" }),
    );
    await expect(await canvas.findByText("3 screenshots")).toBeVisible();
    const newAlt = canvas.getByLabelText("Screenshot 3 alt text");
    await userEvent.clear(newAlt);
    await userEvent.type(newAlt, "Command palette screenshot");
    await userEvent.click(
      canvas.getByRole("button", { name: "Move screenshot 3 left" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove screenshot 1" }),
    );
    await expect(await canvas.findByText("2 screenshots")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Evidence" }));
    const artifactHash = canvas
      .getByText("Artifact SHA-256")
      .closest<HTMLElement>('[data-ui-part="form-field"]');
    if (artifactHash === null) {
      throw new Error("Expected artifact hash read-only row");
    }
    await expect(
      within(artifactHash).queryByRole("textbox"),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    const saved = lastSavedDraft();
    await expect(saved.plugin.name).toBe("Bases Lab");
    await expect(saved.media.gallery).toHaveLength(2);
    await expect(saved.media.gallery[0]?.alt).toBe(
      "Command palette screenshot",
    );
    await expect(saved.evidence.artifactSha256).toBe("0".repeat(64));

    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelEdit).toHaveBeenCalledTimes(1));
    await expect(canvasElement).toBeVisible();
  }}
/>
