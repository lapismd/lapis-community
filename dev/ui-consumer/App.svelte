<script lang="ts">
  import DialogExample from "../../src/components/community-patterns/examples/DialogExample.svelte";
  import ConfirmationExample from "../../src/components/community-patterns/examples/ConfirmationExample.svelte";
  import AvatarExample from "../../src/components/community-patterns/examples/AvatarExample.svelte";
  import IdentityExample from "../../src/components/community-patterns/examples/IdentityExample.svelte";
  import Agents from "../../src/components/community-agents/CommunityAgentsStoryHarness.svelte";
  const pattern = new URLSearchParams(location.search).get("pattern");
</script>

<div class="community-ui">
  {#if pattern === "confirmation"}<ConfirmationExample
    />{:else if pattern === "avatar"}<AvatarExample
    />{:else if pattern === "identity"}<IdentityExample
    />{:else if pattern === "agents"}<Agents
      variant="gallery"
    />{:else}<DialogExample />{/if}
</div>
