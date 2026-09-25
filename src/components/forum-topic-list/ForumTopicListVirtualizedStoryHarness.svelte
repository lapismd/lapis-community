<script lang="ts">
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import type {
    CommunityMemberModel,
    CommunityTopicModel,
  } from "../community-workspace/model.js";
  import ForumTopicList from "./ForumTopicList.svelte";

  let {
    title,
    description,
    topics,
    members,
    onOpenTopic,
  }: {
    title: string;
    description?: string;
    topics: CommunityTopicModel[];
    members: CommunityMemberModel[];
    onOpenTopic?: (topicId: string) => void;
  } = $props();

  let viewport = $state<HTMLElement | null>(null);
</script>

<div class="forum-topic-list-virtualized-story-harness">
  <ScrollArea bind:viewportRef={viewport} type="hover">
    <ForumTopicList
      {title}
      {topics}
      {members}
      {...description === undefined ? {} : { description }}
      {...onOpenTopic === undefined ? {} : { onOpenTopic }}
      virtualize={viewport !== null}
      {viewport}
      embedded
      showTopicActions={false}
    />
  </ScrollArea>
</div>

<style>
  .forum-topic-list-virtualized-story-harness {
    height: 32rem;
    border: 1px solid var(--border);
  }

  .forum-topic-list-virtualized-story-harness
    :global([data-ui-component="scroll-area"][data-ui-part="scroll-area"]) {
    height: 100%;
  }
</style>
