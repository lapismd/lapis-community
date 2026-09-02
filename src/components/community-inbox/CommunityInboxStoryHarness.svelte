<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { untrack } from "svelte";
  import CommunityInbox from "./CommunityInbox.svelte";
  import type { CommunityInboxModel } from "./model.js";
  import { communityInboxFixture } from "./story-fixtures.js";

  let model = $state<CommunityInboxModel>(
    untrack(() => JSON.parse(JSON.stringify(communityInboxFixture))),
  );
  const controller = new AppShellController();

  function send(content: string): void {
    model = {
      ...model,
      messages: [
        ...model.messages,
        {
          id: `story-reply-${model.messages.length + 1}`,
          authorId: "steve",
          timestamp: "Now",
          content,
        },
      ],
    };
  }
</script>

<div class="community-inbox-story-harness">
  <AppShell.Root {controller} displayMode="desktop" desktopMinMainWidth={0}>
    <AppShell.Main>
      <CommunityInbox
        {model}
        onSelect={(itemId) => (model = { ...model, activeItemId: itemId })}
        onSend={send}
      />
    </AppShell.Main>
  </AppShell.Root>
</div>

<style>
  .community-inbox-story-harness {
    height: min(46rem, 100vh);
  }

  .community-inbox-story-harness :global([data-shell-root]) {
    --ui-shell-height: 100%;
  }
</style>
