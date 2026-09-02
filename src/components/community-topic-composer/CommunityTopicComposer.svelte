<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import type { CommunityTopicDraft } from "../../community/index.js";
  let {
    open = $bindable(false),
    forumName,
    onPublish,
  }: {
    open?: boolean;
    forumName: string;
    onPublish: (draft: CommunityTopicDraft) => Promise<void>;
  } = $props();
  let title = $state("");
  let content = $state("");
  let tags = $state("");
  let error = $state("");
  let pending = $state(false);
  async function publish(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    pending = true;
    try {
      await onPublish({
        title,
        content,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      open = false;
      title = "";
      content = "";
      tags = "";
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Topic could not be published";
    } finally {
      pending = false;
    }
  }
</script>

<Dialog.Root bind:open
  ><Dialog.Content class="community-topic-composer"
    ><form onsubmit={publish}>
      <Dialog.Header
        ><Dialog.Title>New topic in {forumName}</Dialog.Title
        ><Dialog.Description
          >Start a portable forum post. Replies are linked to this topic.</Dialog.Description
        ></Dialog.Header
      >
      <Field.Group
        ><Field.Field
          ><Field.Label for="community-topic-title">Title</Field.Label><Input
            id="community-topic-title"
            bind:value={title}
            required
          /></Field.Field
        ><Field.Field
          ><Field.Label for="community-topic-body">Message</Field.Label
          ><Textarea
            id="community-topic-body"
            bind:value={content}
            rows={7}
            required
          /></Field.Field
        ><Field.Field
          ><Field.Label for="community-topic-tags">Tags</Field.Label><Input
            id="community-topic-tags"
            bind:value={tags}
            placeholder="help, release"
          /><Field.Description>Separate tags with commas.</Field.Description
          ></Field.Field
        >{#if error}<Field.Error>{error}</Field.Error>{/if}</Field.Group
      >
      <Dialog.Footer
        ><Button type="button" variant="outline" onclick={() => (open = false)}
          >Cancel</Button
        ><Button
          type="submit"
          disabled={pending || !title.trim() || !content.trim()}
          >{pending ? "Publishing…" : "Publish topic"}</Button
        ></Dialog.Footer
      >
    </form></Dialog.Content
  ></Dialog.Root
>

<style>
  :global(.community-topic-composer) {
    width: min(calc(100vw - 2rem), 38rem);
  }
  :global(.community-topic-composer form) {
    display: grid;
    gap: 1.5rem;
  }
</style>
