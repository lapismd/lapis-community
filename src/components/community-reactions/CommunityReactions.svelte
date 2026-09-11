<script lang="ts">
  import { ReactionBar } from "@lapismd/design-core/ai/experimental";
  import type { ComponentProps } from "svelte";
  import type { CommunityCustomEmoji } from "../../community/index.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  let {
    mode = "all",
    reactions = [],
    label = "Reactions",
    pickerLabel = "Add reaction",
    disabled = false,
    presets = [],
    presetsOnly = false,
    communityEmojis = [],
    onSelect,
    ...barProps
  }: Omit<ComponentProps<typeof ReactionBar>, "reactions"> & {
    reactions?: ComponentProps<typeof ReactionBar>["reactions"];
    mode?: "all" | "bar" | "picker";
    pickerLabel?: string;
    disabled?: boolean;
    presets?: readonly string[];
    presetsOnly?: boolean;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onSelect?: (emoji: string, custom?: CommunityCustomEmoji) => void;
  } = $props();
</script>

{#if mode !== "picker"}<ReactionBar {...barProps} {reactions} {label} />{/if}
{#if mode !== "bar" && onSelect}<CommunityEmojiPicker
    label={pickerLabel}
    {disabled}
    {presets}
    {presetsOnly}
    {communityEmojis}
    {onSelect}
  />{/if}
