<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  import type {
    CommunityOperationState,
    CommunitySettingsState,
  } from "../../community/index.js";
  import {
    COMMUNITY_AVATAR_IMAGE_ACCEPT,
    resolveCommunityAvatarImage,
  } from "../community-avatar-picker/image-files.js";
  import "../community-settings/CommunitySettings.css";

  let {
    model,
    operation,
    onUploadImage,
    onAdd,
    onRemove,
  }: {
    model: CommunitySettingsState;
    operation?: CommunityOperationState | undefined;
    onUploadImage?: ((file: File) => Promise<string>) | undefined;
    onAdd: (shortcode: string, url: string) => Promise<void>;
    onRemove: (shortcode: string) => Promise<void>;
  } = $props();

  let shortcode = $state("");
  let emojiUrl = $state("");
  let fileName = $state("");
  let uploading = $state(false);
  let localError = $state("");
  let message = $state("");

  const ownedEmojis = $derived(
    model.customEmojis.filter((emoji) => emoji.owned),
  );
  const disabledReason = $derived(
    model.identityConnected
      ? ""
      : "Connect a NIP-07 identity to save personal settings.",
  );

  async function addEmoji(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    message = "";
    try {
      await onAdd(shortcode, emojiUrl);
      shortcode = "";
      emojiUrl = "";
      fileName = "";
      message = "Custom emoji saved to the relay.";
    } catch (cause) {
      localError = cause instanceof Error ? cause.message : "Emoji save failed";
    }
  }

  async function removeEmoji(value: string): Promise<void> {
    localError = "";
    message = "";
    try {
      await onRemove(value);
      message = `:${value}: removed from your emoji set.`;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Emoji removal failed";
    }
  }

  async function uploadEmojiImage(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file || uploading) return;
    localError = "";
    message = "";
    uploading = true;
    try {
      emojiUrl = await resolveCommunityAvatarImage(file, {
        upload: onUploadImage,
      });
      fileName = file.name;
      shortcode ||= file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      message = "Emoji image uploaded. Save emoji to publish it.";
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "The image could not be read.";
    } finally {
      uploading = false;
    }
  }
</script>

<header class="community-settings__heading">
  <h1 id="settings-title">Custom emoji</h1>
  <p>
    Add your own custom emoji for everyone on this relay to use. Type
    <code>:name:</code> in messages and reactions.
  </p>
</header>

<form class="community-settings__custom-emoji" onsubmit={addEmoji}>
  <section class="community-settings__option-section">
    <header><h2>Add emoji</h2></header>
    <div class="community-settings__emoji-builder">
      <div
        class="community-settings__emoji-row"
        data-ui-part="custom-emoji-row"
      >
        <div class="community-settings__emoji-copy">
          <h3>Upload an image</h3>
          <p>
            Square images work best. GIF, PNG, JPEG, and WebP files are
            supported.
          </p>
        </div>
        <label class="community-settings__emoji-upload">
          <span class="community-settings__emoji-preview" aria-hidden="true">
            {#if emojiUrl}<img src={emojiUrl} alt="" />{:else}<ImageIcon />{/if}
          </span>
          <span>{uploading ? "Uploading…" : fileName || "Upload image"}</span>
          <input
            type="file"
            accept={COMMUNITY_AVATAR_IMAGE_ACCEPT}
            aria-label="Upload custom emoji image"
            disabled={uploading}
            onchange={(event) => void uploadEmojiImage(event)}
          />
        </label>
      </div>
      <div
        class="community-settings__emoji-row"
        data-ui-part="custom-emoji-row"
      >
        <div class="community-settings__emoji-copy">
          <h3>Give it a name</h3>
          <p>
            This is what you’ll type to add this emoji to messages and
            reactions.
          </p>
        </div>
        <Field.Group class="community-settings__emoji-name">
          <Field.Field>
            <Field.Label for="community-emoji-shortcode">Name</Field.Label>
            <div class="community-settings__emoji-name-input">
              <span aria-hidden="true">:</span>
              <Input
                id="community-emoji-shortcode"
                bind:value={shortcode}
                placeholder="party-parrot"
                autocapitalize="none"
                autocomplete="off"
                spellcheck={false}
              />
              <span aria-hidden="true">:</span>
            </div>
            <Field.Description>
              Choose an image first; Lapis will suggest a name from the
              filename.
            </Field.Description>
          </Field.Field>
        </Field.Group>
      </div>
      <div class="community-settings__emoji-actions">
        <Button
          type="button"
          variant="ghost"
          disabled={!emojiUrl && !shortcode}
          onclick={() => {
            emojiUrl = "";
            shortcode = "";
            fileName = "";
          }}>Clear</Button
        >
        <Button
          type="submit"
          disabled={!model.identityConnected ||
            !emojiUrl ||
            !shortcode ||
            uploading ||
            operation?.status === "pending"}
          title={disabledReason || undefined}>Save emoji</Button
        >
      </div>
    </div>
  </section>

  <section
    class="community-settings__option-section community-settings__emoji-list"
    aria-label="Your custom emoji"
  >
    <header>
      <h2>My emoji</h2>
      <p>{ownedEmojis.length} in your signed set</p>
    </header>
    {#if ownedEmojis.length === 0}
      <p class="community-settings__empty">
        You haven't added any emoji yet. Add one above.
      </p>
    {:else}
      <ul>
        {#each ownedEmojis as emoji (emoji.shortcode)}
          <li>
            <img src={emoji.url} alt="" />
            <span>
              <strong>:{emoji.shortcode}:</strong>
              <small>{emoji.url}</small>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove :${emoji.shortcode}:`}
              title={`Remove :${emoji.shortcode}:`}
              disabled={!model.identityConnected}
              onclick={() => void removeEmoji(emoji.shortcode)}
              ><Trash2Icon aria-hidden="true" /></Button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="community-settings__status" role="status">
    {localError || operation?.message || message || disabledReason}
  </p>
</form>
