# Agent activity presentation acceptance

The repository context and owner activity views share Design Core chat
presentation. Checkpoints use `Chat.SystemMessage` dividers, and the repository
Agent context column can collapse independently of revision selection. Owner
activity places pagination inside the chat header and shows request progress at
the end, using the same non-interactive `Reasoning` treatment as agent cards and
profiles. Cancel and Reset use `CommunityProfileActions`; permission prompts and
awaited reset confirmation remain scoped to the original conversation.

The transcript reducer now handles terminal updates even when a turn already
exists. It completes the corresponding reasoning, resolves tools with results,
keeps terminal tool states through metadata updates, ignores repeated signed
frames, and distinguishes unfinished tools from successful tools when a turn
ends. Ending one request does not finish another request's reasoning.

## Reproduce the focused checks

- `pnpm test src/components/community-agent-activity`
- `pnpm test:storybook src/components/community-agent-activity src/components/community-profile-actions src/components/community-agent-profile/CommunityAgentProfile.stories.svelte src/components/community-agents/CommunityAgentWorking.stories.svelte src/components/community-projects/CommunityProjectsRepositoryLog.stories.svelte src/components/community-commit-agent-context`
- Open `Community/Agents/Activity lifecycle/Live working` to advance a synthetic
  request through thinking, a pending tool, a tool result, and completion at
  sidebar width. It renders the production activity component.
- Open `Community/Patterns/Profile actions/Contract` and
  `Community/Projects/Repository Log/Projected Jujutsu DAG` for action geometry,
  checkpoint dividers and column collapse.

## Shared package staging

Design Core makes `Reasoning.children` optional so a progress-only status does
not expose an empty disclosure. Local acceptance uses a private packed Design
Core tarball installed through pnpm. Community's publishable manifest and lock
file retain their normal version range; no dependency source is edited.
Release the Design Core patch and update Community's normal dependency range
before publishing these Community changes. Local staging is not release
verification, and visual stories remain pending human baseline review.

## Validation boundaries

Verified on 19 September 2026:

| Surface                                             | Result                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Community activity reducer                          | 11 tests passed, including replay, result-only tools, terminal updates and request isolation |
| Community unit suite                                | 818 passed, 2 skipped                                                                        |
| Affected Community browser stories                  | 40 passed across 7 files, from a fresh Vitest/Chromium process                               |
| Community specification, UI policy and architecture | Passed                                                                                       |
| Community Svelte checks                             | No errors or warnings                                                                        |
| Community package and static Storybook builds       | Passed, including publint                                                                    |
| Packaged UI consumer                                | Six viewport/theme contracts passed with the staged Design Core package                      |
| Design Core unit and Storybook suites               | 709 unit tests and 633 stories passed                                                        |
| Design Core specification and type checks           | Passed                                                                                       |
| Live local Community                                | Checkpoint divider, collapse/expand and older-history ordering verified                      |

Synthetic stories were also visually reviewed at sidebar width. Live owner
activity verification used DOM state only; no private transcript was copied into
test logs. No new provider request was sent for this presentation change.

The broad Community type lane still fails in unchanged fixture declarations:
`project-repository-groups.test.ts` (two incomplete project casts) and
`repository-source-reads.test.ts` (an incomplete address). The aggregate
`pnpm checks` stops on formatting drift in 57 files. Changed files pass the
focused formatter check; the verification table retains unrelated existing row
formatting so only LC-UI-049 changes.

The full Community browser run passed 464 stories and failed 5. The missing-page
story's ambiguous status query was corrected and passes in the 40-story rerun.
An isolated rerun recovered the app's Reply in thread and project-settings
scenarios. Linked-account layout (4px against a 1px tolerance) and
repository-maintainer selection (missing `dev` option) still fail. These
unmodified screens remain unresolved; the full suite is not green.

Design Core's aggregate check passes the suites above and the static build, then
fails three workspace pointer scenarios: bottom-panel resizing, centre-drop
overlay and stacked-tab reordering. These are outside the changed Reasoning
surface; their failures remain unresolved. Later aggregate lanes did not run.

The isolated Design Core visual comparison selected the two existing Reasoning
stories and built successfully, then failed with `EACCES` while copying
`storybook-static` into its canonical build cache. Screenshot comparison did
not complete; this is not a passing visual regression result.

The cold relay-to-site smoke was attempted but stopped during fresh Docker image
builds when the local volume had about 3 GiB free; it did not reach acceptance.
Only the smoke's temporary stack was cleaned up. No visual baselines were updated.
