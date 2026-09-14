<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import Example from "./examples/MemberSelectionExample.svelte";
  import source from "./examples/MemberSelectionExample.svelte?raw";
  const { Story } = defineMeta({
    title: "Community/Patterns/Members",
    component: CommunityMemberCommand,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source } } },
  });
</script>

<Story
  name="Contract"
  play={async ({ canvas }) => {
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
    const search = canvas.getByRole("combobox", {
      name: "Search community users",
    });
    await userEvent.type(search, "Ada");
    await expect(
      canvas.queryByRole("option", { name: /Noor/ }),
    ).not.toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      canvas.getByRole("button", { name: "Remove Ada Chen" }),
    ).toBeVisible();
    await userEvent.clear(search);
    await userEvent.click(canvas.getByRole("option", { name: /Noor/ }));
    await expect(
      canvas.getByRole("button", { name: "Remove Noor Rahman" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Ada Chen" }),
    );
    await expect(
      canvas.queryByRole("button", { name: "Remove Ada Chen" }),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Example />{/snippet}</Story
>
