# Agent alignment validation

The approved alignment plan spans Community, Nostr Agent Controller, AI Controller
and AI Host. Source verification does not replace installed-build acceptance.
Installation, service restart, publication and visual baselines remain separate.

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

## Remaining acceptance

Transcript comments still need Community integration.
Catch-up freshness, provider acceptance, disposable controller/relay/browser
acceptance and affected Lapis consumers remain separate gates. No live controller
has been replaced by these source checks.

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
