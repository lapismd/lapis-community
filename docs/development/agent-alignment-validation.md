# Agent alignment validation

The approved alignment plan spans Community, Nostr Agent Controller, AI Controller
and AI Host. Source verification does not replace installed-build acceptance.
Installation, service restart, publication and visual baselines remain separate.

The current stopping point and resume checklist are in
[Pause checkpoint, 2026-09-24](#pause-checkpoint-2026-09-24). Earlier sections
record the results at each slice, including gates completed by later slices.

## Preserved Activity layout

Commit `3bd20210` preserves the previously pending Activity alignment changes.
Focused Activity and chip stories: 26 passed. Activity unit tests: 23 passed.
`pnpm check`, `pnpm spec:check`, `pnpm build` and publint passed.

## Typed lifecycle and permission settlement

Production regressions before the change:

- `pnpm test src/community/activity-frame-state.test.ts src/community/permission-expiry.test.ts src/components/community-agent-activity/activity-run-label.test.ts`: 15 failed, 4 passed.
- `pnpm test src/community/activity-sync-permissions.test.ts`: 4 failed, 4 passed; adding the terminal replay case then reproduced 1 failure among 9 tests.

The shared state vocabulary preserves completed, failed, cancelled, interrupted
and uncertain outcomes. Only running work animates. Expiry drops the approval
card and waits for controller status; settlement does not imply that execution
resumed. Session/turn correlation and retained terminal identities prevent
cross-session cleanup and stale permission resurrection.

The controller delegates scope projection and permission settlement to bounded
owners. Transcript progress and composer/Turns labels consume the same states.
Future owner controls and transcript comments must preserve this projection.

Focused verification commands:

```sh
pnpm test src/community/agent-controller.test.ts src/community/activity-frame-state.test.ts src/community/activity-scope-projection.test.ts src/community/activity-sync-permissions.test.ts src/community/permission-expiry.test.ts src/components/community-agent-activity
pnpm test src/components/community-agent-composer-activity src/community/activity-sync-permissions.test.ts
pnpm test:storybook src/components/community-agent-activity
```

The cold Activity interaction/accessibility run passed 26 tests. Svelte autofixer
reported no issues in the changed transcript and state stories. The full unit
suite passed 1,096 tests with two skips. Static checks and both package and
Storybook builds passed. The complete eight-group browser lane passed 568 interaction/accessibility tests
(150 story files passed, one Docker-only file skipped). Packaged-UI consumer
acceptance passed all six viewport/theme combinations. ResizeObserver warnings
were observed in application stories without assertion failures; visual review
remains pending.

## Explicit approval policy

The Community editor always exposes Allow all and Ask, independently of the
provider's native mode catalog. Missing legacy values save as explicit Allow all;
an explicit Ask choice survives harness/model changes. Profiles distinguish an
unreported setting, and runtime saves reject missing or mismatched controller
acknowledgements. Turns retain requested/effective policy and native mode status
without reviving terminal execution.

Before implementation, approval-policy unit regressions failed five times,
selector interaction regressions twice, execution-policy propagation once and
late policy on a terminal turn once. Their exact reruns passed. The focused
controller/policy unit set passed 48 tests and the focused Activity/editor/profile,
Chip and Dialog browser set passed 56 tests. Svelte autofixer reported no issues.

The complete unit lane passed 1,110 tests with two skips. All eight cold browser
groups passed 572 interaction/accessibility tests, with one Docker-only file
excluded from that lane. Two aggregate attempts exposed intermittent failures:
`CommunityProfileMenu/SignedInMember` could not find its Presence submenu, and
`CommunityAgents/DeleteSavedSetupWithCancellationAndRetry` could not find the
retry confirmation. Both exact cold story reruns passed, followed by their
complete cold groups (111 and 98 tests). No assertions or product code were
changed for those retries. This is completed lane evidence across retries, not
a claim that either original `pnpm checks` invocation passed uninterrupted.

The disposable relay browser lane passed 67 tests. The separate project-relay
lane passed its one selected integration test (56 non-selected cases skipped).
Packaged-UI consumer validation passed all six viewport/theme combinations.
Static checks, specification validation, Storybook build, package build and
publint passed. Visual review remains pending.

Disposable public-package provider probes remain separate from browser evidence.
Native Codex completed Ask and Allow all with a verified file write; Ask paused
before the write, while Allow all recorded an automatic approval. Cursor also
completed both modes with owner/automatic decisions. OpenCode exercised both
decision paths, but exact requested file formatting did not pass. Codex ACP
performed an in-workspace write without exposing an approval, so that run does
not prove its permission-request path. Additional boundary probes did not
produce the requested outside-workspace file and are not acceptance passes.
These probes used disposable directories and the rebuilt packaged controller
and host; no installed service was replaced.

## Remaining acceptance after the approval-policy slice

At this point transcript comments still needed Community integration. Catch-up
freshness, provider acceptance, disposable controller/relay/browser acceptance and
affected Lapis consumers were separate gates; later sections record their
progress. No live controller has been replaced by these source checks.

## Correlated Continue and exact turn selection

`pnpm test src/community/agent-continue-turn.test.ts` initially failed all ten
production-controller cases. The Continue story initially failed its action case
while the uncertain-state case passed. After implementation both exact targets
passed. A subsequent late-outcome case reproduced one additional failure and
passed after receipt reconciliation was corrected.

Continue now sends its own version-2 control, keeps the exact displayed request,
session and turn, and waits for the controller's correlated acknowledgement.
Timeout retries and page reloads reuse the command identity; repeated clicks
coalesce. A late response cannot acknowledge another target or invocation, and
a stale queued receipt cannot replace a failed outcome. Pending and failed
controls remain visible across Activity tabs. Uncertain work is not dispatched.
Cancellation retains its own command and the application forwarding layer no
longer drops the displayed identity or selects the latest unrelated conversation.

The focused continuation/forwarding lane passed 15 tests, including an idle-session reset regression that initially failed with several historical turns; the wider controller,
session and Activity lane passed 100 tests before the last two continuation
cases were added. The cold Activity and Confirmation interaction/accessibility
lane passed 31 tests. Static checks passed. The complete unit lane passed 1,125 tests with two skips. All eight cold browser
groups passed 575 interaction/accessibility tests across fresh runs. The initial
aggregate attempt found three Projects story failures: `ProjectSettings` observed
an unnamed closing select, `ReviewDiff` missed a highlight change, and
`MergedReviewTimeline` encountered a pointer-blocked author action. All three
exact cold reruns and the full 95-test group passed without changing assertions
or product code. These results establish successful lanes across retries, not an
uninterrupted aggregate pass. Visual review remains pending.

The disposable relay browser lane passed 67 tests. The project-relay lane passed
one integration test with 56 non-selected cases skipped. The UI consumer passed
all six viewport/theme cases against packaged Design Core and Community source.
The initial reset-selection regression (one failure) now passes with several
historical turns in an idle session.

Storybook build, package build and publint passed. Svelte autofixer reported no
issues in the changed components. Exactly LC-UI-044 changed in the verification
matrix for this slice.

Separate affected-consumer checks used disposable package installations. The
Lapis AI adapter's four focused SDK tests and all 365 package tests passed,
along with Svelte/type checks, package build and publint. The Lapis Notes desktop
host's five focused tests passed, including the ACP/MCP app-tool round trip
against a freshly compiled controller. Full Lapis browser/packaged-host acceptance
and the complete provider matrix remain separate pending gates.

## Application permission notifications

The initial production-controller notification target failed two cases and passed
two. Replay is now identified at the relay EOSE boundary, and only first-seen live
requests are eligible for an application toast. A separate newly discovered-agent
regression failed once before preserving origin across directory verification.
The five-case cold browser target initially had three failures: two assertions
raced Sonner entrance animation, and the replay fixture published an ephemeral
event without a subscriber. Assertions now wait for visibility, and replay is
supplied as signed telemetry before EOSE in this fixture. All five pass, covering
Activity closed, exact thread/turn navigation, remount deduplication, settlement,
expiry and historical replay silence. Svelte autofixer reports no issues.

The final focused controller/session/permission lane passed 72 tests. The complete
`pnpm checks` aggregate passed: 1,131 unit tests (two skipped), 580 cold browser
interaction/accessibility tests across eight groups, 67 disposable-relay tests,
and one project-relay integration test (56 non-selected cases skipped). The
packaged UI consumer passed all six viewport/theme combinations. Static,
specification and type checks, Storybook build, package build and publint passed.
Visual review and installed-controller acceptance remain separate.

## Catch-up freshness

Three controller regressions and four transcript presentation regressions failed
before implementation. Their exact targets now pass. An additional regression
for reused record IDs across simultaneous threads failed once and now passes.
Review reproduced two more failures: canonical fragment tools kept their running state,
and one agent's failed catch-up invalidated a previously caught-up agent. Both
now pass. The final focused freshness set passes twelve tests. A wider controller/permission/
transcript lane passed 55 tests before the last two cases were added.

Unavailable catch-up now projects only the requested agent/conversation's
nonterminal state as unknown. Signed history remains unchanged. A fresh signed
snapshot can restore an equal sequence; duplicate or newer replay cannot make
unavailable execution current, and an older snapshot cannot replace live state.
Thinking, progress and tools consume the same execution projection, including
terminal snapshots whose events are absent from the local transcript.

The cold recovery story passes. Its first two attempts exposed test query errors
(an unavailable Testing Library method and an incorrect label query); the final
story asserts the visible status text, stopped animations and restored activity.
No product assertions were removed. Svelte autofixer reports no issues; its
subscription-effect suggestions are intentional lifecycle ownership.

Temporary validation installs use
`/tmp/community-agent-alignment/freshness.pnpmfile.cjs` with
`pnpm --config.pnpmfile=/tmp/community-agent-alignment/freshness.pnpmfile.cjs install --lockfile=false`.
That hook selects the rebuilt Design Core tarball containing `ToolCallStatus`
`unknown`. Canonical manifests and lockfiles are unchanged. The final complete
`pnpm checks` aggregate passed: 1,143 unit tests (two skipped), 581 cold browser
interaction/accessibility tests, 67 disposable-relay tests, one project-relay
integration test (56 non-selected skipped), and all six packaged-consumer
viewport/theme cases. Specification, format, architecture, UI and type checks,
Storybook build, package build and publint passed. Visual review remains pending.

Design Core's corresponding `unknown` tool status is committed as `5192bdbb`.
Its focused tool, complete Storybook and packaged Lapis AI checks passed; shell
browser readiness retries are recorded separately in its verification record.
Lapis Notes desktop acceptance passed 201 tests, type checks and production
build against the rebuilt controller and Community package. The corrected ready
schema fixture is committed as `24d5ef89`. Full Lapis browser acceptance and the
real-provider/disposable controller workflow remain separate gates.

## Durable transcript comments

The signed checkpoint-thread regression initially failed one of two cases because
it accepted a forged checkpoint author. Transcript comment controls initially
failed both new interaction cases because the controls were absent. All now pass.
A later selected-quote story failed once because original-thread comments lacked
their target reference; the thread now shows the verified record label and quote.
A reused-record regression failed once because matching text could move a draft
to another canonical turn; canonical thread, turn and record kind now remain part
of the durable draft identity.

The focused signature, checkpoint-thread, selection, immutable-index and draft
lane passes 16 tests. The comment/Continue/native-discussion/reference browser
lane passes ten cases. A second cold comment/reference/Dialog/Composer/Chip
contract lane passes eight cases. Tests operate production controls and cover
thinking, plan steps, tool input/output, assistant text, delayed persistence,
failed publishing, remount draft retention and original-thread placement.
The immutable event index rejects mutated caller-owned signed events and keeps
reordered or duplicate replay stable. No owner controls become public records.

Svelte autofixer reports no issues. Its lifecycle-effect suggestions correspond
to owned asynchronous subscriptions and descriptions; watcher reference counts
are nonreactive bookkeeping, and the excerpt reference supports DOM selection.
The architecture budgets for extracted owners only decrease. Exactly LC-UI-044
changes semantically in the verification matrix. Temporary package validation
uses the previously documented freshness hook; canonical dependency files remain
unchanged. The isolated workspace also uses local sibling links for the Nostr
controller and relay specification references; the first aggregate attempt stopped
at those missing links before product validation.

The uninterrupted final `pnpm checks` passed: 1,159 unit tests (two skipped),
585 cold browser interaction/accessibility tests across eight groups, 67 disposable
relay tests, one project-relay test (56 non-selected cases skipped), and all six
packaged UI consumer viewport/theme cases. Format, specifications, architecture,
UI, Svelte and TypeScript checks, Storybook build, package build and publint passed.
Visual review remains pending; no visual baselines were changed.

## Native checkpoint parity and message chronology

The cold native checkpoint workflow exposed a production projection difference:
version-2 native plan, permission and usage records were filtered out of original
threads even though canonical envelopes retained them. The exact native projection
regression failed once before the fix and now passes. The cold native-plan comment
story and the full affected comment/reference story family pass (six cases).
An earlier fixture attempt incorrectly placed multiple native records in one v2
page; the corrected signed fixture follows the native one-record-per-page format.

Signed assistant messages created in the same second could sort by event hash
instead of their durable logical sequence. The materializer regression failed
once before the ordering fix. Conversation ordering now retains same-second
causal parents and numeric assistant record sequence within an author, agent and
request. The ten-case focused lane passes, including reversed/duplicate replay,
independent batches, malformed identities, cycles and a 20,000-record thread.
Different timestamps retain chronological priority. Native non-message records
remain available beside the original conversation and for durable comments.

Svelte autofixer reports no issues in the changed harness and story; the existing
subscription effect suggestion is intentional lifecycle ownership. The chronology
regression has its own test file to preserve the existing architecture budget.
Exactly LC-UI-044 changes semantically in the verification matrix. The latest
aggregate and cold controller/browser results are recorded in the pause checkpoint
below.

Focused commands for this follow-up:

```sh
pnpm exec vitest run --project unit src/community/conversation-event-order.test.ts src/community/agent-message-chronology.test.ts src/community/thread-projection.test.ts src/components/community-agent-thread-context/native-projection.test.ts
pnpm exec vitest run --project storybook src/components/community-transcript-comments/CommunityTranscriptComments.stories.svelte -t Native
VITEST_MAX_WORKERS=1 pnpm checks
```

The signed chronology regression is
`orders same-second agent messages by durable record sequence after their triggering reply`.
It moved from the existing thread projection test into its own file after the
architecture checker correctly rejected growth of the old file. The original
regression passed before extraction, and the extracted target passes unchanged.

Consumer refresh uses the built follow-up tarball at
`/tmp/community-agent-alignment/native-transcript/lapismd-lapis-community-0.1.0.tgz`.
The Community plugin passes all 17 unit tests, Svelte checks with zero errors or
warnings, TypeScript, and both cold production host-composition browser stories.
Its temporary hook is
`/tmp/community-agent-alignment/plugin-community-validation.pnpmfile.cjs`.
The initial unlocked install rejected the consumer's unused `bits-ui@2.19.0` patch;
the temporary workspace root retains that exact patched version alongside 2.18.1,
as in the consumer's existing lockfile. Neither patch was disabled or modified.
Consumer source, manifests and lockfiles remain unchanged.

## Pause checkpoint, 2026-09-24

The user requested committing the current work and consolidating its temporary
workspaces, with remaining work deferred. This is a saved implementation checkpoint,
not a claim that all acceptance gates passed or that the installed app was updated.
Resume from the default Community checkout. The `agent-comments` workspace is being
integrated and retired; it is not needed to continue the implementation.

### Latest evidence

| Lane                                      | Result                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Focused native projection and chronology  | 10 passed; both production regressions failed once before their fixes.                                              |
| Affected comment/reference browser family | 6 passed in a cold process.                                                                                         |
| Community static checks                   | Format, specification, architecture, UI, Svelte and TypeScript passed.                                              |
| Community unit suite                      | 1,168 passed, 2 skipped.                                                                                            |
| Community standard browser suite          | 586 interaction/accessibility tests passed across eight fresh groups.                                               |
| Community Docker browser suite            | 60 passed, 7 failed; aggregate exited 1.                                                                            |
| Cold controller/native/browser workflow   | Passed with zero browser page errors; deterministic provider and signature-verifying WebSocket fixture relay.       |
| Refreshed Lapis consumer                  | 18 check tasks and 10 uncached build tasks passed; 20 shell/editor browser cases passed on the fresh-process retry. |
| Refreshed Community plugin                | 17 unit tests, check, build, publint and 2 cold browser cases passed.                                               |

The Docker failures were `PulseDark`, `RelayExternalSignerAccountDetails`,
`LinkedGitHubAccountAwaitingSigner`,
`DismissedSignerToastStaysDismissedDuringNavigation`,
`LinkedGitHubExternalSignerReconnectAndDisconnect` and `FullCommunityApp` in
`src/components/community-application/CommunityApplication.stories.svelte`, plus
`LoadedDiscussionAndPublish` in
`src/components/registry-community/RegistryCommunity.stories.svelte`.
Observed failures include a synchronizing application, missing signer/navigation
controls, and a missing published discussion message. Relay logs contain
serialization retry errors. The cause is unresolved; passing standard stories
does not establish that these Docker failures are unrelated.

The cold workflow covers the original repository-link/no-`a` request, an
announcement with only `buzz-channel`, native capture and daemon publication,
independent ordered replies below the original message, comments on thinking,
plan step 2 and tool activity, restart recovery without repeating the repository
link, and feedback delivered on exactly the next invocation. It uses the real
controller service/runtime adapter and production Community UI. It is not real
provider or Go-relay acceptance. See the sibling controller's
`docs/development/local-context-validation.md` for the detailed receipt.

Earlier real-provider results remain in the AI Controller and Lapis Notes
acceptance records. Eight Ask/Allow all provider turns passed across Native Codex
and Codex/Cursor/OpenCode ACP. Cursor's explicit `composer-2.5` choice is still
rejected despite being advertised, and Native Codex structured input is unavailable
in Default mode. These limitations were not retested for this rendering follow-up.

### Work to resume

1. Reproduce the seven exact Docker failures, fix their owning boundary, then run
   the complete 67-case Docker suite. The relay wrapper does not forward story
   filters; use a disposable relay instance with the Docker backend environment
   for focused Vitest targets and clean up that exact instance afterward.
2. Finish the lanes that the failed aggregate never reached:
   `pnpm test:storybook:projects-docker`, `pnpm test:ui:consumer`,
   `pnpm build-storybook` and `pnpm build`. A standalone source build and package
   pack succeeded for consumer refresh; that does not make the aggregate pass.
3. Complete `pnpm smoke:local` against the actual disposable relay/site stack.
   The first attempt failed on a pre-existing local Design Core archive integrity
   mismatch. A disposable source copy with only its copied lockfile integrity
   refreshed was prepared, but its Docker build was interrupted before acceptance.
   Preserve canonical dependency files when recreating that setup.
4. Resolve the Lapis default-plugin discrepancy: source enables Community as a
   fifth plugin, while LN-PLUG-006, LN-DENO-006, LN-WEB-004 and LN-ED-019 expect
   four. The desired profile remains undecided; do not silently rewrite tests or
   the specification. See `lapis-notes/spec/records/agent-policy-consumer-acceptance.md`.
5. Complete packaged desktop startup. The unpublished
   `@lapismd/ai-controller@^0.1.0` constraint still fails at runtime despite a
   successful temporary-map compile. Manual node-modules probes stopped on
   missing `dotenv`, then `@lezer/highlight`. Source build success is not packaged
   startup acceptance.
6. After acceptance, handle package publication, installed native/controller
   replacement and service restart as explicit delivery steps. Historical
   messages must not be republished or unfinished tasks automatically rerun.
   Human visual review remains pending; no baselines were updated.

Run heavyweight Docker and desktop/web builds serially. Concurrent validation
caused approximately 15 GB of swap on this 16 GB machine; resource pressure is an
observation, not a proven explanation for the Docker failures.

### Local evidence and temporary setup

These paths are local supporting artifacts, not portable prerequisites. Rebuild
or recreate them if `/tmp` is cleared:

- Aggregate and Docker failures: `/tmp/community-native-checks-final2.log`.
- Exact focused target: `/tmp/community-order-focused-final.log`; affected
  browser family: `/tmp/community-native-browser-family2.log`.
- Cold workflow: `/tmp/cold-agent-alignment13.log` and
  `/tmp/agent-alignment-cold-WCVHgU/` for the public receipt and browser image.
  Fixture signing keys are private and must not be committed or shared.
- Lapis checks/builds: `/tmp/lapis-native-transcript-check.log` and
  `/tmp/lapis-native-transcript-build.log`; browser retry:
  `/tmp/lapis-native-transcript-browser2.log`.
- Community plugin browser/build: `/tmp/plugin-community-native-browser.log`
  and `/tmp/plugin-community-native-build.log`.
- Interrupted relay/site smoke: `/tmp/community-native-relay-site-smoke2.log`;
  disposable copy: `/tmp/community-agent-alignment/registry-smoke/community`.
  Its dependency symlink must be refreshed after retiring `agent-comments`.
- Temporary consumer hooks and packed artifacts remain under
  `/tmp/community-agent-alignment/`. Notes installs require both the documented
  `notes-validation.pnpmfile.cjs` hook and `LAPIS_PLUGIN_TARBALL_MANIFEST` pointing
  to the sibling plugins' `.release/npm/manifest.json`, with `--lockfile=false`.
  Generated Notes `deno.lock` drift was restored before committing the record.
- The ignored controller probe `.local/agent-alignment/cold-workflow.ts` remains
  local; its Community path must target the default checkout on the next run.

The older Design Core `release-verify-fix` workspace belongs to separate release
work and has history absent from its default checkout. It was not used for this
alignment slice and is not part of its workspace retirement.
