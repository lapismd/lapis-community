<script lang="ts">
  import { CommunityReactions } from "@lapismd/lapis-community/components";
  let emoji = $state("");
</script>

<div class="community-ui">
  <CommunityReactions
    reactions={[{ emoji: "👍", count: 2 }]}
    onToggle={(value) => (emoji = value)}
    onSelect={(value) => (emoji = value)}
  /><output>{emoji}</output>
</div>
