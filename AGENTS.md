# Lapis Community package

This repository owns the single `@lapismd/lapis-community` package: Nostr
protocol and relay access, NIP-07/NIP-42 authentication, deterministic registry
materialization, local fixture tooling, and composable Svelte community
components. The sibling `nostr-plugin-registry` repository owns the static
renderer and `community.lapis.md` deployment. The sibling `nostr-relay`
repository owns the relay.

## Ownership and protocol boundaries

- Signed Nostr events and their content-addressed release manifests are the
  registry source of truth. Do not add a registry database or HTTP submission
  API.
- Use standard NIP-29 messages, reactions, forum posts, and replies. Keep Lapis
  trust decisions in the materializer.
- A release is published only when its event author is a configured publisher
  and its latest decision is signed by a configured curator.
- Keep materialization deterministic across event order, duplicates, and
  replay. Verify referenced resource hashes before publication.
- Keep browser signing behind the NIP-07 adapter. Do not commit or log secret
  keys or production relay credentials.
- Consume published LapisMD packages through normal npm semver ranges. Do not
  vendor dependency source, edit dependency `node_modules`, or add
  checkout-specific paths to publishable manifests.

## Components and Design Core

- Keep all package code beneath `src`; do not recreate nested pnpm workspace
  packages. Each independent Svelte component belongs in its own named folder
  under `src/components` with a colocated Storybook story.
- Compose public `@lapismd/design-core` primitives and APIs. Do not copy their
  implementation or reach into private source paths.
- Follow the Design Core AppShell topology. AppShell structural parts must be
  direct children of their documented parent, with application content passed
  through snippets rather than replacement shell markup.
- Build menu actions with the matching Design Core menu item primitive. Keep
  leading item icons at the start and reserve the end position for shortcuts,
  state, or submenu affordances. Use the menu group's radio and submenu
  primitives for their corresponding behavior.
- Use the shared Lucide icon set where available. Icon-only controls require an
  accessible name, and decorative icons must not create duplicate accessible
  content.

## Storybook ownership and regression evidence

- Package Storybook is the acceptance surface for Community components. Add or
  update the colocated `ComponentName.stories.svelte` whenever visual behavior,
  interaction, responsive layout, or public component composition changes.
- Point `defineMeta` at the real public component. Stories may use fixtures and
  harnesses for state, but must exercise the production component and public
  API rather than a visual duplicate.
- Story docs must show consumer-usable public imports and markup. If automatic
  source extraction exposes only a harness, fixture, or story wrapper, provide
  an explicit `parameters.docs.source` example.
- Interaction tests must operate the real control and assert a visible or
  accessible outcome as well as emitted callbacks. Prefer stable semantic
  roles, names, and `data-ui-part` hooks; do not couple tests to incidental CSS
  structure.
- Accessibility failures are product failures. Fix the component or scenario;
  do not weaken the global axe rules or hide a failing story.
- Keep changed stories `visual-pending` until human review. Never create,
  replace, or approve Visual Delta baselines without explicit user approval,
  and never loosen assertions or thresholds to make a regression pass.
- Restart Storybook after changing startup configuration, addons, Vite config,
  package exports, or dependency output that hot reload cannot reliably
  invalidate. Before browser review, verify that the listening process belongs
  to the intended Jujutsu workspace; separate workspaces use separate ports and
  must not stop or reuse another workspace's listener.

## Specification and validation

- Canonical requirements live in `spec/src`. Protected implementation,
  Storybook, Docker, package, tooling, and policy changes require the owning
  specification chapter and exactly one verification row to change in the same
  Jujutsu change.
- Start with the narrowest relevant test or story, then run `pnpm spec:check`,
  `pnpm check`, `pnpm test`, `pnpm test:storybook`, `pnpm build-storybook`,
  `pnpm build`, and finally `pnpm checks` as required by the affected surface.
  Cross-repository changes also require the local relay-to-site smoke test.
- Browser and lifecycle fixes require at least one cold run with a fresh
  Storybook/Vite process. A warm targeted pass does not prove startup,
  teardown, import, or registration behavior.
- Do not replace a focused failing reproduction with a wider passing command,
  weaken an assertion, or classify an unexplained failure as unrelated. Report
  exact skipped validation and keep visual review separate from functional,
  interaction, and accessibility status.

## Version control and release gates

- Use Jujutsu for status, diffs, commits, bookmarks, history, and workspaces.
  Preserve unrelated work and consolidate workspace changes deliberately.
- After each verified slice, run `jj commit` with a PR-quality message that
  explains the change and records validation. This is a standing request; do
  not wait for the user to ask.
- Deployment, keys, DNS, public Nostr events, package publication, visual
  baseline updates, and releases require explicit approval.
