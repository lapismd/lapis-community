<script lang="ts">
  import { FileDiff } from "@lapismd/design-core/diff";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import type { RichTranscriptToolDetail } from "./transcript-tool-rich.js";

  let { detail }: { detail: RichTranscriptToolDetail } = $props();

  function shellCode(
    value: Extract<RichTranscriptToolDetail, { kind: "shell" }>,
  ) {
    return [
      `$ ${value.command}`,
      value.output,
      value.error ? `stderr:\n${value.error}` : undefined,
    ]
      .filter((part) => part && part.length > 0)
      .join("\n");
  }
</script>

{#if detail.kind === "file-edit"}
  <div class="transcript-tool-rich" data-kind="file-edit">
    {#each detail.files as file (file.path)}
      <section
        class="transcript-tool-rich__file"
        aria-label={`Diff for ${file.path}`}
      >
        {#if file.patch}
          <FileDiff
            path={file.path}
            patch={file.patch}
            viewMode="unified"
            wrap
          />
        {:else}
          <FileDiff
            path={file.path}
            oldText={file.oldText ?? null}
            newText={file.newText ?? ""}
            viewMode="unified"
            wrap
          />
        {/if}
      </section>
    {/each}
  </div>
{:else if detail.kind === "shell"}
  <div class="transcript-tool-rich" data-kind="shell">
    <CodeBlock
      code={shellCode(detail)}
      language="bash"
      title="Shell"
      size="sm"
      width="full"
      isWrapped
      maxHeight="20rem"
    />
  </div>
{:else if detail.kind === "search"}
  <section
    class="transcript-tool-rich transcript-tool-rich__search"
    data-kind="search"
    aria-label="Search results"
  >
    <header class="transcript-tool-rich__search-header">
      <span>Search</span>
      {#if detail.query}<code>{detail.query}</code>{/if}
    </header>
    {#if detail.command}
      <p class="transcript-tool-rich__command">$ {detail.command}</p>
    {/if}
    <ol class="transcript-tool-rich__matches">
      {#each detail.matches as match, index (`${match.path}:${match.line ?? index}:${match.column ?? 0}`)}
        <li>
          <span class="transcript-tool-rich__match-location">
            {match.path}{#if match.line !== undefined}:{match.line}{/if}{#if match.column !== undefined}:{match.column}{/if}
          </span>
          <code>{match.text}</code>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .transcript-tool-rich {
    min-width: 0;
  }

  .transcript-tool-rich__file {
    min-width: 0;
  }

  .transcript-tool-rich__file :global([data-ui-component="file-diff"]) {
    max-height: 20rem;
    overflow: auto;
    border-radius: var(--radius);
  }

  .transcript-tool-rich__search {
    display: grid;
    gap: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    background: var(--muted);
  }

  .transcript-tool-rich__search-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .transcript-tool-rich__search-header code,
  .transcript-tool-rich__command,
  .transcript-tool-rich__matches code {
    font-family: var(--font-mono, ui-monospace, monospace);
  }

  .transcript-tool-rich__command {
    margin: 0;
    color: var(--muted-foreground);
    white-space: pre-wrap;
  }

  .transcript-tool-rich__matches {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .transcript-tool-rich__matches li {
    display: grid;
    grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr);
    gap: 0.75rem;
    align-items: baseline;
    min-width: 0;
  }

  .transcript-tool-rich__match-location {
    min-width: 0;
    overflow: hidden;
    color: var(--muted-foreground);
    font-family: var(--font-mono, ui-monospace, monospace);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .transcript-tool-rich__matches code {
    min-width: 0;
    white-space: pre-wrap;
  }

  @media (max-width: 42rem) {
    .transcript-tool-rich__matches li {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }
</style>
