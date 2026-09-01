# Local end-to-end registry testing

The local stack has two relay profiles. `pnpm local:up` retains the stock Buzz
compatibility deployment. `pnpm local:up:lapis-relay` builds the sibling
vendored `lapis-relay` source, backed by PostgreSQL and its embedded Blossom
endpoint. Lapis does not add a registry database or an event-submission API:
the signed Nostr graph on the selected relay is the registry source of truth.

The fixture reads the sibling `lapis-plugins` checkout through a read-only
mount. It creates the Lapis NIP-29 groups, uploads content-addressed release
manifests through Buzz's Blossom endpoint, and publishes standard signed
messages, replies, and reactions after NIP-42 authentication. The materializer
derives the disposable V1 tree from those events.

## Run the stack

Prerequisites are Docker with Compose, Node 22 or newer, pnpm, and sibling
`lapis-plugins` and `plugin-registry` workspaces.

```sh
pnpm install
pnpm local:validate
pnpm local:up:lapis-relay
```

The services are:

- rendered registry: <http://localhost:4321/>
- registry console: <http://localhost:4173/>
- fixture status: <http://127.0.0.1:8090/status.json>
- Lapis relay and media endpoint: `ws://registry.localhost:8281`

Use `pnpm local:ps:lapis-relay`, `pnpm local:logs:lapis-relay`, and
`pnpm local:down:lapis-relay` for the normal lifecycle.
`pnpm local:reset:lapis-relay` removes the relay's persistence, projection, and
site volumes and rotates the ignored local fixture identities. The unqualified
`local:*` commands target the retained stock-Buzz profile.

Run `pnpm smoke:lapis-relay` for a cold Lapis-relay check. It uses a unique
Compose project and high ports, verifies relay NIP-11/NIP-42 behaviour, checks
the retained release and long-forum events, rebuilds the static V1 projection,
builds the public registry, exercises the browser configuration, and removes
its containers and volumes afterward.

`pnpm smoke:local` runs the equivalent regression against stock Buzz.

## What the fixture proves

At startup the fixture service:

1. reads every complete plugin from `lapis-plugins`;
2. creates the stable `plugin-releases`, `general`, `plugin-development`,
   `forums`, and per-plugin support NIP-29 groups;
3. uploads each release manifest to Buzz/Blossom and publishes a kind `9`
   release submission to `plugin-releases`;
4. publishes a kind `7` curator approval reaction from the configured trusted
   curator key;
5. publishes three forum topics, including a deterministic 240-post thread,
   plus reactions;
6. queries every event back from Buzz and verifies the complete plugin graph;
7. serves only fixture artifacts, the catalog seed, and a status document after
   relay verification succeeds.

The console and public registry read Buzz directly. Browser writes are signed
by a NIP-07 signer and authenticate to Buzz with NIP-42. Release authority is a
client/materializer concern: a release is effective only when its publisher is
trusted for the plugin and its latest decision is a supported reaction signed
by a configured curator key. Buzz remains a general NIP-29 community relay.

## Rebuild the V1 projection

With the stack running, load the generated fixture identity and run:

```sh
set -a
source .local/registry-fixture/fixture.env
set +a
REGISTRY_BUZZ_RELAYS=ws://registry.localhost:8281 \
REGISTRY_PUBLIC_BUZZ_RELAYS=ws://registry.localhost:8281 \
REGISTRY_CATALOG_URL=http://127.0.0.1:8090/catalog.json \
REGISTRY_FIXTURE_SECRETS_FILE=.local/registry-fixture/fixture-secrets.json \
pnpm relay:materialize --output artifacts/local-v1
```

The output contains the V1 index and plugin details, mirrored assets, accepted
Nostr events, provenance, Buzz runtime configuration, and the community browser
bundle. It is a disposable read model and can be rebuilt from Buzz at any time.

## Configuration and safety

Override sibling discovery with absolute `LAPIS_PLUGINS_PATH` or
`PLUGIN_REGISTRY_PATH` paths. Set `REGISTRY_FIXTURE_PLUGIN_LIMIT` to a positive
number for a smaller deliberate fixture. Set
`REGISTRY_FIXTURE_LONG_THREAD_POSTS` to change the primary discussion length;
`pnpm smoke:long-thread` runs the cold stack with 2,000 posts. Host ports and
pinned image references are in `deploy/.env.example`.

The stock-Buzz profile keeps its rate limiter enabled with higher local-only
ceilings so a deterministic bulk fixture can be imported in one run. The Lapis
profile retains the vendored relay's standard validation and configures only
the local group, join, and persistence settings required by the fixture.

Local Nostr secrets are generated under ignored `.local/registry-fixture` with
owner-only permissions. Only public keys and the secret-file path enter the
rendered Compose environment; the secret file and source checkout are mounted
read-only. `.local` is excluded from the Docker context. These identities,
events, approvals, and plugin artifacts are local test data only.
