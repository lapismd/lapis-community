<script lang="ts">
  import { tick, untrack } from "svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type { AgentConversation } from "../community-agent-conversation/context.svelte.js";
  import type { TranscriptReplyTarget } from "../community-agent-conversation/transcript-reply-target.js";
  import { focusTranscriptComposer } from "./focus-transcript-composer.js";
  let {
    target,
    conversation,
    disabled = false,
  }: {
    target: TranscriptReplyTarget;
    conversation: AgentConversation;
    disabled?: boolean;
  } = $props();
  let value = $state(untrack(() => conversation.replies.content(target)));
  let ref = $state<HTMLDivElement | null>(null);
  let submitted = false;
  let busy = $state(false);
  const durable = $derived(conversation.replies.durable(target));
  $effect(() => {
    if (durable) untrack(() => conversation.replies.bind(target));
  });
  const authorId = $derived(
    target.kind === "transcript"
      ? target.source.agentPubkey
      : target.event.pubkey,
  );
  const authorName = $derived(
    conversation.members.find((member) => member.id === authorId)?.name ??
      "Agent",
  );
  const content = $derived(
    target.kind === "transcript"
      ? target.excerpt
      : (conversation.message(target.event.id)?.content ??
          target.event.content),
  );
  $effect(() => {
    const node = ref;
    if (node) return focusTranscriptComposer(node);
  });
  async function send(content: string) {
    if (busy) return;
    busy = true;
    try {
      await conversation.replies.send(target, content);
      submitted = true;
      await tick();
    } finally {
      busy = false;
    }
  }
</script>

<CommunityChatComposer
  bind:ref
  bind:value={
    () => value,
    (next) => {
      value = next;
      if (!submitted) conversation.replies.save(target, next);
    }
  }
  {disabled}
  {busy}
  members={conversation.members}
  rooms={conversation.rooms}
  {...conversation.memberId ? { currentMemberId: conversation.memberId } : {}}
  context={{ kind: "transcript-reply", target: { authorName, content } }}
  onCancelContext={() => conversation.replies.clear(target.key)}
  ariaLabel="Thread reply composer"
  submitLabel="Send reply"
  placeholder={`Reply to ${authorName}`}
  {...durable
    ? { onSubmit: (submission) => send(submission.content) }
    : {
        composerStatus: {
          type: "warning",
          message:
            "Waiting for this record to be saved. You can keep drafting.",
        },
      }}
/>
