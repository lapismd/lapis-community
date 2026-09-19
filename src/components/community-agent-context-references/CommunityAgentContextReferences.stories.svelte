<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import CommunityAgentContextReferences from "./CommunityAgentContextReferences.svelte";
  import { buildRepositoryAgentContexts } from "../../projects/repository-agent-context.js";
  import {
    repositoryContextEvents,
    contextFixture as f,
  } from "../../testing/repository-context-fixture.js";
  const checkpoints = buildRepositoryAgentContexts(repositoryContextEvents());
  checkpoints[0]!.records[0]!.sourceEventId = "e".repeat(64);
  checkpoints[0]!.commitIds.push("c".repeat(40));
  const { Story } = defineMeta({
    title: "Community/Projects/Agent Context References",
    component: CommunityAgentContextReferences,
    tags: ["visual-pending"],
    args: { checkpoints: [...checkpoints, ...checkpoints] },
  });
</script>

<Story
  name="Linked code and unavailable channel"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Agent context references" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const menu = await body.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    await expect(items).toHaveLength(5);
    await expect(within(menu).queryByText("References")).toBeNull();
    await expect(
      within(menu).getByRole("menuitem", { name: "Open channel room" }),
    ).toHaveTextContent(/^room$/);
    await expect(
      within(menu).getByRole("menuitem", {
        name: `Open repository ${f.repository}`,
      }),
    ).toHaveAttribute("href", expect.stringContaining("/repository/"));
    await expect(
      within(menu).getByRole("menuitem", { name: "Open channel room" }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      within(menu).getByRole("menuitem", {
        name: `Open request ${"e".repeat(64)}`,
      }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      within(menu).getByRole("menuitem", {
        name: `Open request ${"e".repeat(64)}`,
      }),
    ).toHaveTextContent(/^Request$/);
    for (const item of items)
      await expect(
        item.querySelector('svg[data-icon="inline-start"]'),
      ).not.toBeNull();
    await userEvent.hover(
      within(menu).getByRole("menuitem", { name: "Commits" }),
    );
    const commits = within(
      await body.findByRole("menu", { name: "Linked commits" }),
    );
    await expect(commits.getAllByRole("menuitem")).toHaveLength(2);
    await expect(
      commits.getByRole("menuitem", { name: `Open commit ${f.commit}` }),
    ).toHaveAttribute("href", expect.stringContaining(`/commits/${f.commit}`));
    await expect(
      commits.getByRole("menuitem", { name: `Open commit ${"c".repeat(40)}` }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining(`/commits/${"c".repeat(40)}`),
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("button", { name: "Agent context references" }),
    ).toHaveFocus();
  }}
/>

<Story
  name="Read only context"
  args={{ checkpoints: [{ ...checkpoints[0]!, commitIds: [], targets: [] }] }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Agent context references" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const menu = within(await body.findByRole("menu"));
    await expect(
      menu.queryByRole("menuitem", { name: /^Open commit/ }),
    ).toBeNull();
    await expect(menu.queryByRole("menuitem", { name: "Commits" })).toBeNull();
    await expect(
      menu.queryByRole("menuitem", { name: /^Open change/ }),
    ).toBeNull();
    await expect(menu.getAllByRole("menuitem")).toHaveLength(3);
    await userEvent.keyboard("{Escape}");
  }}
/>
