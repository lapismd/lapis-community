# Lapis Community package

This repository owns the single `@lapismd/lapis-community` package: Nostr
protocol and relay access, NIP-07/NIP-42 authentication, deterministic registry
materialization, local fixture tooling, and composable Svelte community
components. The sibling `nostr-plugin-registry` repository owns the static
renderer and `community.lapis.md` deployment. The sibling `nostr-relay`
repository owns the relay.

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
- Keep all package code beneath `src`; do not recreate nested pnpm workspace
  packages. Each independent Svelte component belongs in its own named folder
  under `src/components` with a colocated Storybook story.
- Canonical requirements live in `spec/src`. Protected implementation,
  Storybook, Docker, package, and policy changes require the owning spec chapter
  to change in the same Jujutsu change.
- Start with the narrowest test, then run `pnpm checks`. Presentation changes
  require Storybook interaction/accessibility and static-build checks. Keep
  changed stories `visual-pending`; never create or replace visual baselines
  without explicit approval. Cross-repository changes also require the local
  relay-to-site smoke test.
- Use Jujutsu and commit each verified slice. Deployment, keys, DNS, public
  events, and package publication require explicit approval.
