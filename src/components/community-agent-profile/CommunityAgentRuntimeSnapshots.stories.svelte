<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentProfile from "./CommunityAgentProfile.svelte";
  import Harness from "./RuntimeSnapshotStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Runtime snapshots",
    component: CommunityAgentProfile,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: [
            "<script>",
            'import { CommunityAgentProfile } from "@lapismd/lapis-community/components";',
            "<" + "/script>",
            "<CommunityAgentProfile {agent} {runtime} {runtimeRefresh} onRefreshRuntime={refreshRuntime} {...profileActions} />",
          ].join("\n"),
        },
      },
    },
  });
</script>

<Story
  name="Cached while refreshing"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Runtime" }));
    await expect(
      canvas.getByText("local-workspace", { exact: true }),
    ).toBeVisible();
    await expect(canvas.getByText("Refreshing runtime details…")).toBeVisible();
    await expect(canvas.getByText(/Last updated/)).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Refresh runtime details" }),
    ).toBeDisabled();
  }}>{#snippet template()}<Harness />{/snippet}</Story
>
<Story
  name="Timeout retains cached values"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Runtime" }));
    await expect(
      canvas.getByText("local-workspace", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Simulate timeout" }),
    );
    await expect(
      canvas.getByText(/No response within thirty seconds/),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Refresh runtime details" }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh runtime details" }),
    );
    await expect(canvas.getByText("Refreshing runtime details…")).toBeVisible();
  }}>{#snippet template()}<Harness scenario="timeout" />{/snippet}</Story
>
<Story
  name="Incoming snapshot updates profile"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Runtime" }));
    await expect(
      canvas.getByText("local-workspace", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Receive new snapshot" }),
    );
    await expect(
      canvas.getByText("updated-workspace", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Refresh runtime details" }),
    ).toBeEnabled();
  }}>{#snippet template()}<Harness scenario="incoming" />{/snippet}</Story
>
