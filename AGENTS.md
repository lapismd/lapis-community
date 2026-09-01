# Nostr-native Lapis registry

This repository owns the NIP-29 registry event model, relay client,
deterministic materializer, NIP-07 signer adapter, community component, and
local end-to-end fixture. The sibling `nostr-plugin-registry` repository owns
the static renderer and `community.lapis.md` deployment. The sibling
`nostr-relay` repository owns the relay.

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
- Start with the narrowest test, then run root `pnpm check`. Cross-repository
  changes also require the local relay-to-site smoke test.
- Use Jujutsu and commit each verified slice. Deployment, keys, DNS, public
  events, and package publication require explicit approval.
