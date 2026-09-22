<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityEntityLinkStoryHost from "../community-entity-chip/CommunityEntityLinkStoryHost.svelte";
  import CommunityMarkdownContent from "./CommunityMarkdownContent.svelte";

  const eventId = "c".repeat(64);
  const owner = "d".repeat(64);
  const messageHref = `lapis-community://message?channel=general&id=${eventId}`;
  const projectHref = `lapis-community://project?owner=${owner}&d=community-client`;
  const repoHref = `lapis-community://repo?owner=${owner}&d=community-client`;
  const logHref = `lapis-community://repo?owner=${owner}&d=community-client&tab=log`;

  const onOpen = fn();

  const { Story } = defineMeta({
    title: "Community/Channels/Markdown Entity Links",
    component: CommunityMarkdownContent,
    tags: ["visual-pending"],
    parameters: { layout: "padded" },
  });
</script>

<Story
  name="Scheme hash and absolute URLs render chips"
  play={async ({ canvas }) => {
    const message = canvas.getByTestId("entity-message");
    const hash = canvas.getByTestId("entity-hash");
    const absolute = canvas.getByTestId("entity-absolute");
    await expect(
      message.querySelector("[data-link-kind='message']"),
    ).not.toBeNull();
    await expect(
      hash.querySelector("[data-link-kind='channel']"),
    ).not.toBeNull();
    await expect(
      absolute.querySelector("[data-link-kind='channel']"),
    ).not.toBeNull();
    await expect(
      message.querySelector(".lucide-message-circle"),
    ).not.toBeNull();
    await expect(
      canvas
        .getByTestId("entity-project")
        .querySelector("[data-link-kind='project'] .lucide-folder-kanban"),
    ).not.toBeNull();
    await expect(
      canvas
        .getByTestId("entity-repo")
        .querySelector("[data-link-kind='repository'] .lucide-folder-git-2"),
    ).not.toBeNull();
    await expect(
      canvas
        .getByTestId("entity-log")
        .querySelector("[data-link-kind='log'] .lucide-git-commit-horizontal"),
    ).not.toBeNull();
    await userEvent.click(message.querySelector("[data-link-kind='message']")!);
    await expect(onOpen).toHaveBeenCalled();
  }}
>
  {#snippet template()}
    <CommunityEntityLinkStoryHost {onOpen}>
      <div data-testid="entity-message">
        <CommunityMarkdownContent content={messageHref} />
      </div>
      <div data-testid="entity-hash">
        <CommunityMarkdownContent content="#/channels/general" />
      </div>
      <div data-testid="entity-absolute">
        <CommunityMarkdownContent
          content="https://local-community.lapis.md/#/channels/general"
        />
      </div>
      <div data-testid="entity-project">
        <CommunityMarkdownContent content={projectHref} />
      </div>
      <div data-testid="entity-repo">
        <CommunityMarkdownContent content={repoHref} />
      </div>
      <div data-testid="entity-log">
        <CommunityMarkdownContent content={logHref} />
      </div>
    </CommunityEntityLinkStoryHost>
  {/snippet}
</Story>
