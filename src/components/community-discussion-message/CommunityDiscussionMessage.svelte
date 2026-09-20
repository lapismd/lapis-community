<script lang="ts">
  import { untrack, type ComponentProps } from "svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import { formatCommunityEventCopy } from "../community-message/copy-event.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { discussionPermalink } from "../community-agent-conversation/message-actions.js";
  import { eventTag } from "../community-agent-conversation/model.js";
  let { message, ...props }: ComponentProps<typeof CommunityMessage> = $props();
  const conversation = useAgentConversation();
  const source = $derived(message.sourceEvent);
  $effect(() => {
    const channel = source && eventTag(source, "h");
    if (channel && conversation)
      return untrack(() => conversation.watch(channel));
  });
  const displayed = $derived(
    source ? (conversation?.message(source.id) ?? message) : message,
  );
  const own = $derived(source && source.pubkey === conversation?.memberId);
  let editing = $state(false);
  let draft = $state("");
  let busy = $state(false);
  let error = $state("");
  let status = $state("");
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      status = label;
      error = "";
    } catch {
      error = "Could not copy to the clipboard";
    }
  }
  async function save(content: string) {
    if (!source || !conversation || busy) return;
    busy = true;
    try {
      await conversation.edit(source, content);
      editing = false;
      error = "";
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Message could not be updated";
    } finally {
      busy = false;
    }
  }
</script>

{#if !source || !conversation?.isDeleted(source)}
  <CommunityMessage
    {...props}
    message={displayed}
    {...source
      ? {
          onCopyLink: () =>
            copy(discussionPermalink(source), "Message link copied"),
          onCopyMessage: () => copy(displayed.content, "Message copied"),
          onCopyEvent: () =>
            copy(
              formatCommunityEventCopy(displayed.content, source),
              "Event copied",
            ),
        }
      : {}}
    {...own && source && conversation
      ? {
          onEdit: () => {
            draft = displayed.content;
            editing = true;
          },
          onDelete: async () => {
            await conversation.delete(source);
          },
        }
      : {}}
  />
  {#if editing}
    <CommunityChatComposer
      mode="form"
      showSubmitButton
      bind:value={draft}
      disabled={busy}
      members={conversation?.members ?? []}
      rooms={conversation?.rooms ?? []}
      ariaLabel="Edit message"
      submitLabel="Save changes"
      context={{ kind: "edit", id: message.id, label: "Editing message" }}
      onCancelContext={() => {
        editing = false;
        error = "";
      }}
      onSubmit={(submission) => save(submission.content)}
    />
  {/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if status}<span class="sr-only" role="status">{status}</span>{/if}
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
