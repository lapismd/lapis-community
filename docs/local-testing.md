# Local end-to-end registry testing

The local stack has no PostgreSQL and no registry event API. The fixture reads
the sibling `lapis-plugins` checkout through a read-only mount, creates signed
catalog, workflow, snapshot, community, and security events, and publishes them
directly to an embedded Grain-based Lapis relay. Every fixture identity first
authenticates with NIP-42, and relay role membership is derived from signed
membership decisions. The browser console and rendered registry read and verify
the same relay state.

## Fast single-relay loop

Prerequisites are Docker with Compose, Node 22 or newer, pnpm, and sibling
`lapis-plugins` and `nostr-relay-registry` (or `nostr-relay`) workspaces.

```sh
pnpm install
pnpm local:validate
pnpm local:up
```

This profile uses one role-aware Lapis relay for both official and community
events. It is the normal development loop:

- console: <http://localhost:4173/>
- rendered registry: <http://localhost:4321/>
- fixture status: <http://127.0.0.1:8090/status.json>
- relay: `ws://127.0.0.1:8281`

Use `pnpm local:ps`, `pnpm local:logs`, and `pnpm local:down` for its lifecycle.
`pnpm local:reset` also removes its relay volume and rotates the ignored local
fixture identities.

## Full relay-quorum profile

```sh
pnpm local:validate:quorum
pnpm local:up:quorum
```

This profile runs three official Lapis relays on ports 8281-8283, one community
Lapis relay on 8381, and requires two official acknowledgements. Its lifecycle
commands use the `:quorum` suffix, including `local:logs:quorum` and
`local:down:quorum`.

The local relay image is built from the sibling `nostr-relay-registry`
workspace. Its Grain dependency is pinned, generic Grain changes are applied as
separately reviewable patches, and local ARM64 runs use one nostrdb ingest
worker. Production keeps Grain's four-worker default unless explicitly
configured otherwise.

Run `pnpm local:smoke` for a cold single-relay smoke or
`pnpm local:smoke:quorum` for the complete fault-topology smoke. Each uses a
unique Compose project and high ports, verifies retained relay copies and
roots, builds a fresh static V1 projection and rendered Astro registry from the
signed relay snapshot, checks projected assets and the community custom element,
inspects the browser configuration, and removes its containers and volumes
afterward.

## What the fixture proves

At startup the fixture service:

1. reads `packages/*/{package.json,manifest.json,registry.json}` from
   `lapis-plugins`, selecting every complete package by default;
2. creates deterministic source-metadata artifacts and SHA-256 evidence;
3. signs and publishes plugin, release, assessment, approval, security, and
   snapshot events directly to the configured official relay quorum after
   NIP-42 authentication;
4. signs and publishes a long AI-plugin discussion fixture with participant
   profiles, ratings, NIP-22 replies, NIP-25 reactions, a report, a collection,
   and a follow list directly to the community relay;
5. resolves the signed snapshot and every exact official event ID from the
   relays, then materializes the same catalog/community/security roots used by
   the browser and static build;
6. materializes the verified event graph and its signed resources into a
   disposable V1 directory, then builds and serves the public Astro registry;
7. serves only generated test artifacts and a status document after relay
   verification succeeds.

The console starts only after seeding is healthy. It receives public relay,
kind, quorum, and authority configuration from `config.json`; it does not call a
registry backend. Plugin detail pages load a Design Core custom element that
queries the community relay directly and uses a browser NIP-07 signer for
signup, rating, comment, reply, and reaction events. Signup writes a signed
member decision through the relay's registration flow; it does not rewrite
relay configuration or require a restart. The AI plugin page carries the long
demo topic and its Discourse-inspired history rail.

## Rebuild static V1 output

With either stack running, load the public fixture authority variables and run:

```sh
set -a
source .local/registry-fixture/fixture.env
set +a
REGISTRY_USE_TEST_KINDS=true \
REGISTRY_OFFICIAL_RELAYS=ws://127.0.0.1:8281 \
REGISTRY_COMMUNITY_RELAYS=ws://127.0.0.1:8281 \
pnpm relay:materialize --output artifacts/local-v1
```

For the quorum profile, provide all three comma-separated official relay URLs
and the community URL on port 8381. Output includes the V1 index and plugin
details, mirrored content/media, the community UI bundle, community/security
views, accepted events, runtime relay configuration, the snapshot event, and
relay provenance. It is a disposable read model, not another source of truth.

## Configuration and safety

The wrapper prefers `../nostr-relay-registry`, then `../nostr-relay`. Override
discovery with absolute `LAPIS_PLUGINS_PATH`, `PLUGIN_REGISTRY_PATH`, or
`NOSTR_RELAY_CONTEXT` paths. Set `REGISTRY_FIXTURE_PLUGIN_LIMIT` to a positive
number for a deliberately smaller fixture. Host ports can
be overridden with the variables in `deploy/.env.example`. Event timestamps are
stable across fixture restarts so relay recovery is idempotent; override
`REGISTRY_FIXTURE_CREATED_AT` for a deliberately fresh local event set.

Local Nostr secrets are generated under ignored `.local/registry-fixture` with
owner-only permissions. Only public keys and the secret-file path enter the
rendered Compose environment; the secret file and source checkout are mounted
read-only. `.local` is excluded from the Docker context. These test-kind events
and fixture artifacts are not production identities, approvals, or installable
plugin bundles.
