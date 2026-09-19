<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { npubEncode } from "nostr-tools/nip19";
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

<Story
  name="Configured agent identity"
  args={{
    email: `${npubEncode("9".repeat(64))}@nostr.invalid`,
    name: "Historical name",
    members: [
      { id: "9".repeat(64), name: "Nyra", handle: "nyra", initials: "NY" },
    ],
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", { name: "Nyra" });
    await expect(avatar).toBeVisible();
    await expect(avatar.querySelector("img[src*='gravatar.com']")).toBeNull();
    await userEvent.hover(avatar);
    await expect(avatar).toHaveAttribute("aria-describedby");
  }}
/>
