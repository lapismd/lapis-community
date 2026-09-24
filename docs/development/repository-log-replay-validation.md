# Repository Log replay repair

Validated on 2026-09-24. Implementation: Community change `znlskkxo`
(`67a9ad9a`). The repair was developed separately from the ongoing transcript
work and integrated into the main checkout without conflicts.

## Cause and correction

The `jj-nostr-probe` Log stayed on its loading skeleton because Svelte raised
`each_key_duplicate` for graph lane `3`. Published checkpoint history was
available. Several native parents could map to the same retained revision
after collapsing rewrites or bypassing empty working copies.

`repository-log-collapse.ts` now deduplicates remapped parents in their original
order and visits each native commit once. The old traversal used `Set.add()`
as a boolean membership test; it always returns the set. Repeated paths could
also consume the 500-revision budget, truncating a 31-revision diamond graph to
22 revisions. Signed source events and the keyed graph renderer are unchanged.

## Verification

| Boundary                 | Command or observation                                                                                       | Result                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production projection    | `pnpm test src/projects/repository-log-replay.test.ts`                                                       | Before: 3 failed. After: 3 passed, including reversed/duplicate event replay and unchanged inputs. Also passed in the integrated main checkout.                                                     |
| Production browser       | `pnpm test:storybook src/components/community-projects/CommunityProjectsRepositoryLogReplay.stories.svelte`  | Before: 2 failed with 2 duplicate-key errors. After a fresh runner: 2 passed, with axe enabled.                                                                                                     |
| Related projection tests | `pnpm test src/projects/repository-log src/projects/repository-evolog src/projects/repository-operation-log` | 42 passed across 9 files.                                                                                                                                                                           |
| Project browser family   | `pnpm test:storybook src/components/community-projects`                                                      | 79 passed across 22 files, with axe enabled.                                                                                                                                                        |
| Full unit suite          | `pnpm test --maxWorkers=2`                                                                                   | 1,171 passed; 2 opt-in tests skipped on the final run. The first run had one 5-second `nip29-history` timeout; its exact rerun and the complete rerun passed without assertion or deadline changes. |
| Source checks            | Formatting, `pnpm spec:check`, `pnpm check:architecture`, `pnpm check:types`                                 | Passed. The Svelte autofixer reported no issues or suggestions for the new story.                                                                                                                   |
| Build                    | `pnpm build-storybook`, `pnpm build`                                                                         | Passed, including package lint. Existing custom-element and bundle-size warnings remain.                                                                                                            |
| Packaged consumer        | `pnpm test:ui:consumer`                                                                                      | Passed all six viewport/theme contracts.                                                                                                                                                            |
| Live application         | Reloaded the reported repository Log, selected the MIT-license revision, then reloaded that exact URL        | 12 revisions; commit `07663aa1a7b7f1c2724d148c3508cefb9087350d`; one changed file (`LICENSE`); 30 agent-context records; no new console errors after the cold reload.                               |

The first Storybook attempt in the fresh workspace ran before package output
existed. Dependency discovery failed with `exports is not defined`. Building
the package restored the normal test setup, which then reproduced the actual
duplicate-key failure before the fix.

## Aggregate limits and follow-up

`pnpm checks` stops at an existing Svelte type error in
`CommunityAgentTranscript.svelte:161`: the transcript supplies `"unknown"`
as a tool status that the installed Design Core `ToolCallStatus` does not
accept. `pnpm check:svelte` reproduces the same single error and zero warnings
in an untouched workspace at parent `1152a14e`, using the same dependencies.
This belongs to the transcript/Design Core integration; the overlapping
transcript work was preserved. Do not report the aggregate gate as passing.

The disposable relay lanes pass: `pnpm test:storybook:docker` ran 67 browser
scenarios; `pnpm test:storybook:projects-docker` passed the selected repository
forge scenario (56 other scenarios excluded by that lane's name filter).
Both disposable stacks were cleaned up by their runner.

The complete `pnpm test:storybook:all` rerun passed all eight groups: 588
browser tests, with one story file skipped. The first full run passed
114 tests before the browser transport closed during `Dialog.stories.svelte`.
The exact Dialog rerun and the complete rerun passed with unchanged assertions
and timeouts.

The separate jj-nostrd receive-side observation, `announced carrier is not on
the fetched first-parent spine`, remains in the controller's
`docs/development/checkout-repair.md`. The three recovered checkpoint batches
were already published; this repair only fixes their Community projection.
No provider task, public publication, or historical controller request was
replayed. The broader agent-alignment backlog remains separate. New stories
remain `visual-pending`; no visual baselines were updated.
