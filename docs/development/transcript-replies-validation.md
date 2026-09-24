# Transcript replies validation

## Change and ownership

Transcript items now compose Community's existing message actions. Reply selects
an item in the bottom thread composer; each item draft is separate from the
ordinary thread draft and survives failed sends and transcript remounts. Account
or session changes clear item drafts. Thinking, individual calls, plan steps and
unsigned assistant transcript records share this behavior; an available signed
assistant message keeps its normal reply protocol.

Transcript feedback and follow-ups use the existing signed NIP-22 checkpoint
contract. New feedback targets a whole record or a plan step. Historical part
and selection anchors remain readable. The timeline merges only verified,
undeleted feedback, preserves causal ordering and uses normal message controls.
The source displays a reply count. Record reactions and links retain checkpoint,
record and optional step identity. Event copying includes the genuine signed
checkpoint and the displayed item excerpt.

Design Core owns the optional `ToolCalls.callWrapper` public composition slot.
Its source and full acceptance were committed as `af0bb300`. Community owns all
routing, authorization, drafts, signing and persistence policy.

## Local package validation

The package manifest retains its registry semver range. The pre-existing tracked
lockfile still references the older sibling Design Core tarball; this slice does
not regenerate it through the local hook. The unpublished extension is validated
with an ignored package and without writing that lockfile:

```sh
# From design-core
pnpm pack --pack-destination ../lapis-community/.local/transcript-replies
# From lapis-community
pnpm --config.pnpmfile=.local/transcript-replies/packed-dependency.cjs install --lockfile=false
```

The ignored hook replaces only the Design Core dependency with the packed
`lapismd-design-core-0.1.2.tgz`. It is acceptance infrastructure, not a release or
portable installation prerequisite. An authorized release should update the
dependency range and regenerate a registry-backed lockfile without the local
hook. No production comments or package
publication are part of this validation.

## Evidence

Logs are under `.local/transcript-replies/` in each owning checkout. The original
regressions failed before implementation: one Design Core wrapper story and two
Community grouped-tool/composer stories. The initial logs were lost during a
machine restart; subsequent validation logs are retained in ignored directories.

- Design Core: cold Tool Calls target, 8 tests passed. Full `pnpm checks` passed
  710 units, 636 Storybook interactions/accessibility tests, 14 workspace,
  11 shell, 2 AI-chat and 35 Shadcn browser cases. One existing platform-only
  browser assertion was skipped. See its `spec/records/transcript-item-composition.md`.
- Community focused protocol/timeline: 18 tests passed before the additional
  malformed-parent and custom-emoji regressions.
- Community focused interaction/accessibility: 16 passed in eight files.
  This covers grouped call targeting, passive follow-ups, failed sends,
  ordinary/item draft switching, narrow layout, remounts, account switching,
  live persistence, keyboard/touch controls, signed event copying, target preview
  navigation and reactions scoped to a plan step.
- The first expanded focused run had one invalid grouped fixture and 14 passing
  tests. Its page and canonical record timestamps disagreed. Correcting the
  fixture restored the verified projection; the exact two-story rerun passed.
- Svelte diagnostics: 20 errors from a circular inference and extracted props
  reduced to zero; no warnings. TypeScript's one exact-optional test-fixture
  error was corrected. Autofixer reports zero issues across 29 changed Svelte
  modules/stories, with advisory lifecycle suggestions reviewed.
- Full Community spec, architecture, UI policy, Svelte and TypeScript checks
  passed. Unit suite: 1,175 passed, two existing skips. An added post-send lifecycle regression initially failed with one Svelte
  `derived_inert` warning, then passed after guarding composer teardown. Wider acceptance is
  still running; this record does not yet claim an aggregate pass.

All changed stories remain `visual-pending`; visual baselines are unchanged.
Earlier agent-alignment delivery and provider/desktop acceptance work remains in
`agent-alignment-validation.md` and is separate from this UI slice.
