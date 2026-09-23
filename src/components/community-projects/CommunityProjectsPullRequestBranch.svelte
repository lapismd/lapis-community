<script lang="ts">
  import type { PullRequestState } from "../../projects/index.js";
  import {
    pullRequestSourceLabel,
    pullRequestTargetLabel,
  } from "../../projects/pull-request-branch-label.js";

  let { pullRequest }: { pullRequest: PullRequestState } = $props();
</script>

<span>{pullRequestSourceLabel(pullRequest)}</span>
<span aria-hidden="true">→</span>
<span>{pullRequestTargetLabel(pullRequest)}</span>
