<script lang="ts">
  import { CommunityAgentProcessingControl } from "@lapismd/lapis-community/components";
  import type { CommunityAgentProcessingState } from "@lapismd/lapis-community/components";
  let processing: CommunityAgentProcessingState = {
    enabled: true,
    revision: 0,
    status: "applied",
    updatedAt: 0,
  };
</script>

<CommunityAgentProcessingControl
  agentPubkey="example-agent"
  onLoad={async () => processing}
  onSet={async (enabled, revision) => {
    if (revision !== processing.revision)
      throw new Error("Processing state changed");
    processing = {
      enabled,
      revision: revision + 1,
      status: "applied",
      updatedAt: Date.now(),
    };
    return processing;
  }}
/>
