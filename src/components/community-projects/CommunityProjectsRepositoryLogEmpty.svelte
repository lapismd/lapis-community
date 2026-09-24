<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";

  let {
    pane,
    branch = "",
  }: {
    pane: "log" | "oplog";
    branch?: string | undefined;
  } = $props();

  const title = $derived(
    pane === "log" && branch
      ? "No projection for this branch yet"
      : "No projection yet",
  );
  const description = $derived(
    pane === "oplog"
      ? "Op Log appears after jj-nostr publishes kind 3904 for this repository."
      : branch
        ? "This branch does not have a published jj revision in the selected Log projection yet. Pick another branch, or wait for jj-nostr to publish the projection."
        : "Repository Log appears after jj-nostr publishes kinds 3902 and 3903 for this repository. Commits still shows dest-Git history.",
  );
</script>

<Empty.Root
  class="community-projects__empty community-projects-repository-log__empty"
>
  <Empty.Header>
    <Empty.Media variant="icon">
      <GitCommitHorizontalIcon aria-hidden="true" />
    </Empty.Media>
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{description}</Empty.Description>
  </Empty.Header>
</Empty.Root>
