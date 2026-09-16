# Specification Governance

Published UI dependency refreshes update the portable manifest and committed
lockfile together while retaining the existing package-ownership boundary.

For LC-SPEC-004, the aggregate package checks include the isolated project
Storybook Docker lane so the package manifest cannot claim hosted-project
support without exercising the real relay and its private forge sidecar.
`pnpm check` and `pnpm spec:check` also run the architecture lane
(`scripts/check-architecture.mjs`) so counted-line budgets and the feature
dependency matrix cannot grow without a baseline update in the same change.
Agent guidance forbids `src/community` from importing `src/components`, including
type-only imports, after the workspace-model inversion.

The dedicated Vite development application also composes the production NIP-34
project source against its active Community relay. The ordinary local stack
therefore seeds the signed project graph and owns WalGit/RustFS startup without
giving the Vite process sidecar credentials or filesystem Git access. Its
Community, Registry, and Projects destinations MUST all use the exact endpoint
resolved from `VITE_COMMUNITY_LIVE_RELAY_URL`; `VITE_REGISTRY_RELAYS` is limited
to standalone Storybook registry scenarios and MUST NOT split the integrated
application across relay datasets. Registry curator, publisher, and authority
trust configuration remains independently overridable. Its
checkout-local process supervisor MUST retain HMR for source updates, restart
when generated fixture configuration changes, expose clean restart and stop
commands, and refuse to replace a listener owned by another checkout.

Project component stories that exercise Design Core AppShell body regions MUST
render inside the production `CommunityAppShell` context. Their interactions
MUST cover collapsed review sections before targeting inline diff controls and
the shared member-command entry point used by task assignment.

The Storybook Vitest plugin owns project annotation registration. The shared
Vitest setup file MUST remain limited to package-specific runtime diagnostic
guards and deterministic portal teardown so annotations are not registered a
second time outside the plugin lifecycle.

For LC-SPEC-002, portable application stories MUST use the regular Storybook
root identifier and full-viewport body marker, so their percentage-height
containers do not expand with message history. The Playwright host viewport
MUST contain every configured story iframe. Functional visibility and read
acknowledgement assertions MUST retain their thresholds; fix the host geometry
instead of increasing waits to accommodate clipped content.

The Docker build context must include the Turso Vite bundle helper imported by
`vite.config.ts`. Local relay-to-site smoke validation builds from that clean
context, including the encrypted agent archive, instead of depending on files
available only in the host checkout.

For LC-SPEC-004, the dedicated Community development server MUST apply the
existing Turso bundle transform before Vite scans both client and worker
modules. Excluding the prebuilt bundle from dependency optimization alone is
insufficient: its embedded WASM URL must not overflow Vite's asset scanner.
Regression coverage MUST transform the installed bundle through the actual
development configuration, and cold-browser validation must check that module
loading and an OPFS query succeed rather than relying on the page HTML alone.

## Requirements

| ID          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-SPEC-001 | `spec/src` MUST remain the canonical standalone package specification and MUST build with mdBook through `@lapismd/spec-validator`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LC-SPEC-002 | Protected package manifests, runtime and development dependencies, source, Storybook, Docker, script, repository-policy, and local signed runtime-configuration changes MUST update an owning canonical chapter in the same JJ change; dependency additions MUST identify the package-owned behavior they support. A copyleft implementation dependency MAY be pinned only in the development/reference host when published package source consumes a narrow injected structural adapter and documents the license and production activation gate. Developer-facing runtime documentation MUST describe the current host-owned login surface and MUST NOT require removed out-of-band controls. Development-shell layout changes MUST preserve the bounded application viewport expected by the production shell. Browser Storybook validation MUST serialize files that exercise body-ported menus, dialogs, and structural layers so teardown and interaction isolation remain deterministic. Dialog close controls MUST use a compact Lucide X in a rounded target with visible hover and focus-visible feedback, verified in the owning component story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-SPEC-003 | Every normative requirement ID MUST be unique and MUST have exactly one verification row containing concrete evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| LC-SPEC-004 | Repository validation MUST include formatting, specification, Svelte/TypeScript checks, unit tests, memory and Docker relay conformance, Storybook interaction/accessibility tests, static Storybook and package builds, and publish-manifest validation. Storybook MUST use a Design Core catalog layout; package theme, backend, and ordering controls; isolated defaults; and a labelled non-seeding live registry relay option defaulting to the local relay. A dedicated Vite command MUST mount the production community application against one live local relay with HMR, public-room discovery, the live signed registry catalog and plugin discussions, and every supported login method without persisting or logging supplied signer secrets. It MUST derive only public curator and publisher keys from the generated local fixture environment while allowing explicit Registry trust and authority overrides. The default checks MUST run production application stories against memory and Docker backends and MUST fail on every Svelte runtime diagnostic written to the warning or error console. Live connection failures and locally persisted endpoint changes MUST remain observable in the production composition. Shell-backed stories MUST opt into the generic full-viewport canvas marker while leaving application-frame styling in the production component. Local Storybook and the Vite debug application MUST send COOP `same-origin` and COEP `credentialless` so the Turso/OPFS worker lane can run without requiring credentials for external avatars or emoji, and MUST exclude the driver's prebuilt browser bundle and shared worker package from dependency optimization; hosts without isolation MUST continue through IndexedDB. |
| LC-SPEC-005 | Repository guidance MUST require production-component Storybook scenarios, consumer-usable documentation, real interaction and accessibility evidence, human-gated visual baselines, and checkout-local Storybook processes and ports. The local Storybook lifecycle MUST supervise one server per checkout and configurable port, provide explicit stop and clean-restart commands, terminate only matching process trees, and refuse to replace a listener owned by another checkout. Retained full-shell stories MUST exercise their primary controls; obsolete shell variants MUST not remain as misleading catalog examples. Repository guidance MUST require the public `CommunityChip` for chip-like labels and interactive tokens, with typed variants composed from Design Core Badge and Button primitives, and the aggregate specification check MUST run a tested repository policy lane that rejects direct Badge use outside that component, native or forged chip markup, and consumer CSS that restyles chip appearance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LC-SPEC-006 | Explicitly deferred, externally blocked, manually gated, and deliberately excluded Community work MUST be recorded in the canonical deferred-work ledger with a stable ID, owner, state, related requirement, concrete outcome, and exit condition. Current-behavior chapters MUST cite the stable deferred ID when an omission affects their advertised scope. The aggregate specification check MUST reject duplicate or malformed ledger IDs, unsupported states, incomplete rows, invalid requirement links, and prose references to unknown deferred items. Completed work MUST remove or replace its ledger row in the same change that adds normative requirements and verification evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

For LC-SPEC-002, browser authentication contracts generate disposable import
secrets inside the browser context, clear them after use, and report only the
derived public identity and behavioral results.

`@lapismd/spec-validator` is development-only governance tooling. Published
runtime dependencies use ordinary npm semantic-version ranges and never local
workspace, file, or link dependencies. The package-owned rebuildable event
cache uses `idb` for its durable fallback and lazily loads
`@tursodatabase/database-wasm` browser bundle only when the host meets the OPFS
isolation requirements. The package-owned chat authoring surface uses the published
`@lapismd/mira` package and its public CodeMirror peer APIs for live Markdown,
completion, selection, and keyboard behavior; Design Core remains the owner of
the surrounding buttons, dialogs, inputs, progress, and application chrome.
The package manifest exposes the production NIP-29 catalog source through a
lightweight `registry/nip29` subpath so Notes can reuse protocol and proof
policy without importing Community's presentation barrel.

The package manifest exposes NIP-34 project collaboration through the
lightweight `projects` subpath. The canonical protocol and architecture
chapters own that source, event-builder, deterministic-reducer, pagination,
patch, and hosted-read boundary; components consume it without importing
transport internals.

Relay conformance tests live under the test-only package entry point. They run
in memory by default and may target the disposable Docker relay without adding
environment-specific branches to production controller or materializer code.
The opt-in registry media smoke uses a unique cold Storybook port with explicit
relay, trust, and Blossom inputs from the disposable fixture; it also verifies
the independently materialized static site. Ordinary isolated stories remain
deterministic and do not require that stack.

The `src/registry` public entry point follows the component specification
chapter because it supplies the typed models and projection-loading boundary
consumed directly by the registry presentation components.

The agent owner-proof verifier uses the direct `@noble/curves` dependency for
BIP-340 signatures. The committed lockfile resolves Design Core from the npm
registry. An ignored local package hook may substitute a sibling artifact for
source validation without rewriting the committed dependency metadata.

The agent UI acceptance lane resolves the upstream Bits UI 2.19.2 lifecycle
fix and verifies it with cold application navigation. Unrelated dependency
resolutions remain unchanged. Visual baseline approval remains manual.
The clean installed-consumer dialog check depends on a published Design Core
export [deferred: DEFER-OPS-001]. Visual approval and release/deployment remain
human gates [deferred: DEFER-UI-002] [deferred: DEFER-OPS-002].

UI changes follow catalog discovery, API/example inspection, composition, and contract verification. `pnpm check:ui` is included in `check` and the specification check lanes, and therefore in `checks`. New variants update the owning component, its catalog entry, and interaction coverage together. Changed visual stories remain pending human review; automated checks never approve baselines.

The dedicated Community Vite application enables relay application
authentication only when `VITE_COMMUNITY_RELAY_AUTH_URL` supplies an explicit
HTTP origin. The WebSocket relay remains the single Community, Registry, and
Projects event endpoint; the optional HTTP origin is used only for the relay's
application-session API.

`pnpm test:auth:docker` is the deterministic cross-repository evidence lane for
that contract. It builds the current sibling relay, uses generated ephemeral
secrets and local fake providers, and MUST NOT require, persist, or log live
OAuth credentials.

The unified local lifecycle aliases and Vite public configuration implement
LC-OPS-005; relay infrastructure remains owned by the sibling relay repository.

`pnpm test:agents:archive:browser` is the local acceptance lane for OPFS cache
replay and encrypted agent-history pagination. It runs against the canonical
local Community server in an isolated browser profile and publishes no events.

Guarded local package substitution may point at an ignored Design Core tarball
for cross-repository consumer verification; the hook retains the published
semver dependency whenever that local artifact is absent.

For LC-SPEC-002, the package README describes implemented messaging transports,
Inbox actions, unified Agents and project channel canvases, and links the owning
protocol contracts and public UI catalog examples. Verification distinguishes a
failed aggregate command from successful cold Storybook partitions, preserves
existing live-only exclusions, and records functional checks separately from
pending human visual review.

Packaging compiles the public `./build/vite` helper to JavaScript and declarations.
The source helper remains shared by this repository and its consumers; ordinary
package validation must verify the built export exists.

Build-helper tests compile the public declaration and verify that it does not
export a Vite peer dependency through its return type. The implementation remains
checked against the owning Vite Plugin contract at build time.
