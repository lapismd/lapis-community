<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import type { CommunityCustomEmoji } from "../../community/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  let {
    recipients = [],
    communityEmojis = [],
    onChooseRecipients = () => {},
    onRemoveRecipient = () => {},
    onSend = () => {},
  }: {
    recipients?: readonly CommunityMemberModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    onChooseRecipients?: () => void;
    onRemoveRecipient?: (member: CommunityMemberModel) => void;
    onSend?: (content: string) => void | Promise<void>;
  } = $props();
  let draft = $state("");
</script>

<section
  class="community-direct-message-composer"
  aria-labelledby="new-message-title"
>
  <header>
    <h1 id="new-message-title">New message</h1>
    <p>Send an encrypted NIP-17 message to up to eight people.</p>
  </header>
  <div class="community-direct-message-composer__to">
    <strong>To:</strong>{#each recipients as member (member.id)}<Button
        type="button"
        variant="secondary"
        size="sm"
        onclick={() => onRemoveRecipient(member)}
        >{member.name}<XIcon
          data-icon="inline-end"
          aria-hidden="true"
        /></Button
      >{/each}<Button
      type="button"
      variant="ghost"
      size="sm"
      onclick={onChooseRecipients}
      ><PlusIcon data-icon="inline-start" aria-hidden="true" />Add people</Button
    >
  </div>
  <CommunityChatComposer
    bind:value={draft}
    members={recipients}
    disabled={!recipients.length}
    disabledReason="Choose at least one recipient"
    ariaLabel="Direct message composer"
    placeholder={recipients.length
      ? "Write a message"
      : "Choose at least one recipient"}
    {communityEmojis}
    onSubmit={(submission) => onSend(submission.content)}
  />
  {#if !recipients.length}<p class="community-direct-message-composer__hint">
      Choose a recipient before sending. People without an advertised NIP-17
      inbox relay will be rejected with an explanation.
    </p>{/if}
</section>

<style>
  .community-direct-message-composer {
    display: grid;
    width: 100%;
    min-width: 0;
    align-content: start;
    gap: 1rem;
    padding: clamp(1rem, 4vw, 3rem);
  }
  header {
    display: grid;
    gap: 0.25rem;
  }
  h1,
  p {
    margin: 0;
  }
  header p,
  .community-direct-message-composer__hint {
    color: var(--muted-foreground);
  }
  .community-direct-message-composer__to {
    display: flex;
    min-height: 3rem;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
</style>
