<script lang="ts">
  import { contentMentionLabel } from "../../community/content-mentions.js";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { CommunityComposerExtensionOptions } from "./composer-extension.js";
  let {
    member,
    label,
    options,
  }: {
    member: CommunityMemberModel;
    label: string;
    options: CommunityComposerExtensionOptions;
  } = $props();
  const triggerLabel = $derived(
    contentMentionLabel(member.id, label, [member]),
  );
</script>

<CommunityMemberHoverCard
  {member}
  trigger="mention"
  {triggerLabel}
  {...options.onOpenMember() ? { onOpenProfile: options.onOpenMember()! } : {}}
  {...options.onMessageMember()
    ? { onMessage: options.onMessageMember()! }
    : {}}
  {...options.onWaveMember() ? { onWave: options.onWaveMember()! } : {}}
/>
