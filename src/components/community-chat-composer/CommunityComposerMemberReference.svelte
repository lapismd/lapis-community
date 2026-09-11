<script lang="ts">
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
</script>

<CommunityMemberHoverCard
  {member}
  trigger="mention"
  triggerLabel={label}
  {...options.onOpenMember() ? { onOpenProfile: options.onOpenMember()! } : {}}
  {...options.onMessageMember()
    ? { onMessage: options.onMessageMember()! }
    : {}}
  {...options.onWaveMember() ? { onWave: options.onWaveMember()! } : {}}
/>
