<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";

  import CommunityProjectsGitAuthorAvatar from "./CommunityProjectsGitAuthorAvatar.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Git Author Avatar",
    component: CommunityProjectsGitAuthorAvatar,
    tags: ["visual-pending"],
    args: {
      name: "Noor Patel",
      email: "noor@example.test",
      size: "small",
    },
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityProjectsGitAuthorAvatar name={commit.author} email={commit.author_email} />`,
        },
      },
    },
  });
</script>

<Story
  name="Email tooltip"
  play={async ({ canvas }) => {
    await expect(canvas.queryByText("Noor Patel")).toBeNull();
    await expect(canvas.queryByText("noor@example.test")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "View Noor Patel's profile" }),
    ).toBeNull();
    const author = canvas.getByRole("img", { name: "noor@example.test" });
    await expect(
      author.querySelector("img[src*='gravatar.com/avatar/']"),
    ).not.toBeNull();
    await userEvent.hover(author);
    await expect(author).toHaveAttribute("data-state", "instant-open");
    await expect(author).toHaveAttribute("aria-describedby");
    await userEvent.unhover(author);
  }}
/>
