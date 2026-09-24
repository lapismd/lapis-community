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

## Remaining acceptance

Allow-all configuration, correlated Continue, application-level permission
notifications and transcript comments still need Community integration.
Catch-up freshness, provider acceptance, disposable controller/relay/browser
acceptance and affected Lapis consumers remain separate gates. No live controller
has been replaced by these source checks.
