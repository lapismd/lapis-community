# Specification Governance

Published UI dependency refreshes update the portable manifest and committed
lockfile together while retaining the existing package-ownership boundary.

For LC-SPEC-004, the aggregate package checks include the isolated project
Storybook Docker lane so the package manifest cannot claim hosted-project
support without exercising the real relay and its private forge sidecar.

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
| LC-SPEC-002 | Protected package manifests, runtime and development dependencies, source, Storybook, Docker, script, repository-policy, and local signed runtime-configuration changes MUST update an owning canonical chapter in the same JJ change; dependency additions MUST identify the package-owned behavior they support. Developer-facing runtime documentation MUST describe the current host-owned login surface and MUST NOT require removed out-of-band controls. Development-shell layout changes MUST preserve the bounded application viewport expected by the production shell. Browser Storybook validation MUST serialize files that exercise body-ported menus, dialogs, and structural layers so teardown and interaction isolation remain deterministic. Dialog close controls MUST use a compact Lucide X in a rounded target with visible hover and focus-visible feedback, verified in the owning component story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LC-SPEC-003 | Every normative requirement ID MUST be unique and MUST have exactly one verification row containing concrete evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| LC-SPEC-004 | Repository validation MUST include formatting, specification, Svelte/TypeScript checks, unit tests, memory and Docker relay conformance, Storybook interaction/accessibility tests, static Storybook and package builds, and publish-manifest validation. Storybook MUST use a Design Core catalog layout; package theme, backend, and ordering controls; isolated defaults; and a labelled non-seeding live registry relay option defaulting to the local relay. A dedicated Vite command MUST mount the production community application against one live local relay with HMR, public-room discovery, the live signed registry catalog and plugin discussions, and every supported login method without persisting or logging supplied signer secrets. It MUST derive only public curator and publisher keys from the generated local fixture environment while allowing explicit Registry trust and authority overrides. The default checks MUST run production application stories against memory and Docker backends and MUST fail on every Svelte runtime diagnostic written to the warning or error console. Live connection failures and locally persisted endpoint changes MUST remain observable in the production composition. Shell-backed stories MUST opt into the generic full-viewport canvas marker while leaving application-frame styling in the production component. Local Storybook and the Vite debug application MUST send COOP `same-origin` and COEP `credentialless` so the Turso/OPFS worker lane can run without requiring credentials for external avatars or emoji, and MUST exclude the driver's prebuilt browser bundle and shared worker package from dependency optimization; hosts without isolation MUST continue through IndexedDB. |
| LC-SPEC-005 | Repository guidance MUST require production-component Storybook scenarios, consumer-usable documentation, real interaction and accessibility evidence, human-gated visual baselines, and checkout-local Storybook processes and ports. The local Storybook lifecycle MUST supervise one server per checkout and configurable port, provide explicit stop and clean-restart commands, terminate only matching process trees, and refuse to replace a listener owned by another checkout. Retained full-shell stories MUST exercise their primary controls; obsolete shell variants MUST not remain as misleading catalog examples. Repository guidance MUST require the public `CommunityChip` for chip-like labels and interactive tokens, with typed variants composed from Design Core Badge and Button primitives, and the aggregate specification check MUST run a tested repository policy lane that rejects direct Badge use outside that component, native or forged chip markup, and consumer CSS that restyles chip appearance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

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
