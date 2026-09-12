# Local Registry Pipeline

Repository scripts that enforce specification policy include the deferred-work
ledger validator required by LC-SPEC-006. It reads specification metadata only
and does not change the relay-derived registry pipeline.

For LC-OPS-001 and LC-OPS-004, hosted-project acceptance layers the sibling
relay's digest-pinned WalGit and RustFS composition onto both the persistent
local development stack and disposable controller stack. Runtime credentials
MUST be generated outside Compose, kept in ignored runtime directories, and
never exposed to browser code. Disposable credentials are removed with their
containers and volumes on exit; persistent local credentials are removed by
the explicit reset command.

WalGit MUST receive its documented S3-specific credential and endpoint
variables rather than generic AWS aliases. The RustFS bucket initializer MUST
use the digest-pinned RustFS client against that same path-style endpoint so
the acceptance stack verifies the storage contract actually used by WalGit.

## Requirements

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LC-OPS-001 | The local Docker Compose stack MUST build this package once, seed deterministic `lapis-plugins` Registry/discussion events using `web` and `desktop` platforms, include curator-signed publisher authorization events and sequence-zero freshness heads for every seeded plugin, grant the pinned curator the relay `registry-curator` role, include group-scoped reactions and a threaded channel-reply example, upload release resources to relay Blossom using standard-base64 authorization, and sign their exact content-hash URLs into fixture releases. It MUST also run digest-pinned private WalGit and RustFS services behind the relay, seed an ordinary `30621` project graph with a hosted `30617`, a distinct clone-less project task anchor, an additional related Community channel, and repository- plus project-scoped `1621` tasks, and expose only the relay origin to the browser. Browser and native-host Registry consumers MUST read resources from the configured relay and MUST NOT depend on the fixture status server, a sidecar credential, or a local Git checkout. The stack MUST materialize a verified head-aware projection with the complete Community client asset graph, build the sibling registry site, and serve that result with the relay available to the browser. Docker-backed Storybook files that mutate the shared seeded relay MUST run serially. The long-thread browser smoke MUST leave newest-window discussion isolation through normal first-post navigation before verifying restored plugin detail media. |
| LC-OPS-002 | Fixture and materializer executables MUST be built from `src/fixture` and `src/materializer`; Docker MUST NOT depend on removed workspace-package paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LC-OPS-003 | Production publication, trusted-key changes, relay deployment, DNS changes, and package publication MUST remain manual approval gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LC-OPS-004 | Controller conformance MUST use one disposable Compose stack with the sibling `nostr-relay` build and PostgreSQL, an isolated project name, allocated loopback port, ephemeral volumes, secret-file relay identity, health check, shared signed seeding, and teardown on test or Storybook exit. Its Docker Storybook lane MUST exercise the full workspace, full application, and complete registry lifecycle stories. The full registry-to-site Compose stack MUST remain a separate final smoke lane.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

The local fixture is test infrastructure, not an alternate source of truth. It
publishes the same signed events that production publishers, curators, and
community members would submit and then exercises the normal relay-to-site
pipeline. The fixture's HTTP status endpoint coordinates local setup and smoke
evidence; it is not a Registry resource origin. Registry manifests and
referenced content are served by the relay-owned Blossom endpoint and addressed
by SHA-256. Project fixtures likewise use normal signed NIP-34 events; hosted
repository provisioning and browser reads stay behind the relay's existing
NIP-98/NIP-29 gateway.

The disposable application-authentication lane layers a fake OAuth service and
the sibling relay's localhost-only provider overrides onto the same Compose
boundary. Its Google, GitHub, relay-session, and Nostr events are deterministic;
master keys and provider secrets are generated into the ignored runtime
directory and removed with containers and volumes when the lane exits.

The dedicated Community Vite lane is checkout-owned. Its supervisor watches
the local stack's generated public fixture environment, restarts Vite when
those compile-time values change, and refuses to replace a listener whose
working directory belongs to another checkout.

Vite and Storybook share one narrowly scoped pre-transform for the generated
Turso browser bundle. It preserves the bundle's runtime behavior while keeping
Vite's dependency scanner from recursively parsing the embedded WebAssembly
data URL and worker constructor; all other dependencies use the ordinary Vite
pipeline.

The materializer uses the relay's `BLOSSOM_URL` for manifests and every
content-addressed Registry resource. The projection still contains only
hash-verified mirrored resources. The final smoke starts a fresh Storybook
process against the seeded relay,
rejects static index or detail requests, and exercises Blob-backed AI media in a
real browser. It separately retains the materializer and built Astro route
assertions without modifying the sibling renderer.

The repository's deterministic script lane scans Community Svelte and CSS
sources for direct Badge use outside `CommunityChip`, native chip-like markup,
forged Badge hooks, and consumer-level chip appearance overrides before the
remaining specification and pipeline checks run. Unit fixtures cover the
accepted shared component boundary and rejected look-alikes or local restyles.

The media smoke operates the public image-theme radio group and verifies each
selected variant still uses a verified Blob URL. The smoke selectors follow
the control’s accessibility semantics.

The UI policy tooling validates the Community catalog and parsed production compositions before delivery. Its positive and negative fixtures verify aliases, alternate component syntax, forbidden overrides, exact exceptions, missing exports, and invalid example/state metadata. This local validation does not publish registry artifacts or signed events.
