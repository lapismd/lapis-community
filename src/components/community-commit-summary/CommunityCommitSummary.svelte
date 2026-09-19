<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { FileChangeStats } from "@lapismd/design-core/diff";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import UserIcon from "@lucide/svelte/icons/user";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import type { ProjectForgeCommit } from "../../projects/model.js";
  import { commitDate } from "../community-projects/commit-author.js";
  let {
    commit,
    authorName,
    additions,
    deletions,
    onCopy,
  }: {
    commit: ProjectForgeCommit;
    authorName: string;
    additions: number;
    deletions: number;
    onClose?: (() => void) | undefined;
    onCopy?: ((sha: string) => void) | undefined;
  } = $props();
</script>

<header class="community-projects__commit-detail-header">
  <div>
    <h1>{commit.subject}</h1>
    <p>
      Committed {commitDate(commit.commit_date ?? commit.author_date)}
    </p>
  </div>
</header>

<dl class="community-projects__commit-meta">
  <div>
    <dt><GitCommitHorizontalIcon aria-hidden="true" />Commit</dt>
    <dd>
      <code>{commit.sha.slice(0, 7)}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="community-projects__copy-control"
        aria-label={`Copy commit ${commit.sha.slice(0, 7)}`}
        title="Copy commit hash"
        onclick={() => onCopy?.(commit.sha)}
      >
        <CopyIcon aria-hidden="true" />
      </Button>
    </dd>
  </div>
  <div>
    <dt><UserIcon aria-hidden="true" />Author</dt>
    <dd>{authorName}</dd>
  </div>
  <div>
    <dt><HistoryIcon aria-hidden="true" />Date</dt>
    <dd>
      {commitDate(commit.commit_date ?? commit.author_date)}
    </dd>
  </div>
  <div>
    <dt><CodeXmlIcon aria-hidden="true" />Changes</dt>
    <dd>
      <FileChangeStats {additions} {deletions} />
    </dd>
  </div>
</dl>
