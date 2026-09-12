# Agents and saved activity

Community follows the executable agent protocol audited in `block/buzz`
commit `cec5c8fd9280d30f56effac701e1e19d5cfe6fea`, and the agent module in
Lapis Relay. Buzz Desktop 0.5.23 supplied the live layout reference. Agent
execution remains in an external harness; Community does not start processes,
activate models or prompts, manage teams, memories, or turn metrics.
Those boundaries remain tracked as runtime reconciliation
[deferred: DEFER-AGENT-001], operational controls
[deferred: DEFER-AGENT-002], and private agent data UI
[deferred: DEFER-AGENT-003].

## Discovery and identity

The selected community owns the directory scope. Owner-authored kind `30177`
records and known channel members seed exact-author profile lookups. Only an
agent-signed kind `0` profile with a valid NIP-OA attestation naming the active
user establishes ownership. Kind `10100` and discovery records enrich the
identity but never authorize it. The verifier evaluates the exact condition
string, BIP-340 signature, and every condition against the profile event.

Profile replacement follows NIP-01, including the lowest event ID winning a
timestamp tie. The current profile is selected before validating ownership;
an older proof cannot survive its removal in a newer profile. NIP-09 deletion
requests require the same author as their target. Only the current relay's
signed kind `39002` state establishes channel membership. Accessible public
channels may be displayed even when the viewer has not joined; scoped private
telemetry additionally requires both the owner and agent to be current members.

The relay's NIP-11 information and authenticated Buzz-compatible HTTP query
bridge establish availability. Queries have bounded batches and stable
`until`/`before_id` pagination. HTTP NIP-98 signatures bind the exact URL,
method, and request body. A fresh nonce prevents identical read requests from
reusing an authorization event. Live events use authenticated WebSockets.

Buzz's numeric NIP-11 advertisement does not include the draft strings `OA`
and `AO`, nor NIP-44 (encryption is performed by clients). A valid relay `self`
key and NIP-29 support permit authenticated discovery probes; successful
bridge responses and verified ownership determine the directory. NIP-16
advertises the ephemeral transport used by observer events, alongside explicit
`AO` advertisements from compatible relays. Advertisement alone never proves
agent ownership. Default and injected browser fetch functions must retain their
native global receiver through both information and authenticated requests.

For browser clients, the relay's CORS policy must allow the application's
origin on NIP-11 reads and query responses, and allow `POST`, `Content-Type`,
and `Authorization` on query preflights. A desktop origin such as
`tauri://localhost` does not include `http://localhost:7036`. Buzz configures
its origin list through `BUZZ_CORS_ORIGINS`; preserve existing origins when
adding a browser client. The `Authorization` header requires an explicit
allowance or a reflected requested-header list: a wildcard alone does not
cover it under the [Fetch Standard](https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name).
An HTTP 200 without the required CORS headers remains unreadable to the
browser. Community must not disable browser origin checks or use `no-cors`
to conceal this deployment error.

Presence kind `20001` expires after 180 seconds. Relay-generated snapshots
require the relay's signature and an exact subject `p` tag. Typing kind `20002`
expires after eight seconds. Neither absence nor expired presence proves that
an agent process has stopped.

Follow and Unfollow refresh the current kind `3` contact list before each
serialized write and preserve unrelated contacts, tags, and content. Message
uses Community's existing NIP-17 direct-message flow.

## Requirements

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-022 | The owned-agent directory MUST verify agent profile signatures and full NIP-OA owner proofs, apply deterministic replacement and authorized deletion, derive channels only from relay-signed membership, and discover through bounded authenticated bridge queries. Follow mutations MUST preserve unrelated contact data and surface signer or relay failure. Presence and typing MUST be transient and MUST NOT imply runtime control.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LC-NOSTR-023 | Community MUST keep owner-signed persona definitions (`30175`), owner-signed agent instances (`30177`), and agent-signed public profiles (`kind:0`) distinct. Persona edits MUST preserve unknown configuration, remove known secret-bearing fields, advance timestamps beyond the current head, and keep drafts on failure. Name inheritance MUST use explicit `name_mode`; missing legacy modes mean independent instance naming. Managed presentation MUST resolve persona avatar and inherited name first, then the agent-signed public profile. Unlinking MUST preserve the agent and instance name without copying the persona prompt, while deletion MUST leave an unresolved link with public-profile fallbacks. Saved prompts MUST be labelled as inactive in this release. Local activity-archive restoration MUST NOT delay relay directory readiness. |

## Encrypted local activity archive

Kind `24200` telemetry is captured while the active community is signed in,
including while the activity panel is closed. Owner routing, signatures,
current ownership, freshness, and channel membership are checked before
capture. The archive stores the original encrypted event and its signed owner
profile. The owner signer decrypts on the client; decoded payloads never enter
message search, event synchronization, or persistent storage.

The archive uses additive Turso tables and an IndexedDB version-2 migration,
through the existing shared database owner. It is partitioned by community,
normalized relay set, owner, and agent, deduplicates event IDs, and uses indexed
cursor pagination. Sequence numbers may reset across agent processes. Archive
records are kept until explicit clearing, independently of message cache
pruning and sign-out. Browser storage removal still removes this device's
history. Memory fallback is identified as session-only storage.

Only received events can be saved; reconnecting cannot replay this ephemeral
relay stream. The subscription accepts the relay’s five-minute freshness
window so modest clock skew cannot drop newly delivered frames; live working
expiry remains bounded by the event timestamp. Expired presence and archived turn-start events never indicate
current execution. Identity or community changes dispose subscriptions and
invalidate pending decryption. Storage failures pause saving with retryable
feedback and preserve earlier history. Users can clear history even when
storage is full. History selection includes previously verified archived
agents, and decoded windows remain bounded while older pages remain available.

| ID          | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-ARCH-022 | Agent telemetry MUST have a separate encrypted archive in the shared Turso, IndexedDB, and memory backends. The active signed-in community MUST capture valid owned telemetry independently of panel visibility, isolate owner and relay scopes, retain history until explicit clearing, page bounded decoded windows, cancel stale decryption, and expose storage and signer failures. Ordinary cache pruning and search MUST NOT consume this archive. |

## Compatibility and screens

| Buzz feature                                | Community behavior                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| Owned agents, identity, profile, public key | Verified directory and Info profile                                            |
| Message, Follow / Unfollow                  | Existing encrypted conversation and signed contact-list update                 |
| Presence and working                        | Independent expiring signals; `turn_finished` completes a live turn            |
| Channels                                    | Accessible relay-signed memberships and existing permission-gated add/remove   |
| Private observer activity                   | Continuous signed-in capture and encrypted device history                      |
| Add agent                                   | Owner-signed persona creation plus an explicit managed-agent link              |
| Persona presentation and prompt             | Name/avatar applied in Community; prompt saved but runtime activation deferred |
| Teams, memories, metrics                    | Protocol families supported; UI deferred                                       |
| Start / Stop, models, defaults, runtime     | External manager required; omitted                                             |
| Private managed-agent kind 30179            | Rejected by relay; omitted                                                     |

Public avatar publication still requires an agent-signed kind `0` event. An
owner edit instead publishes plaintext persona desired state as kind `30175`.
Community immediately resolves the managed name and avatar from that persona;
other Nostr clients continue to see the existing agent-signed profile. The
owner never receives the agent key, and Community does not claim that saved
free-form prompts are secret.

The main Agents navigation appears beside Projects for signed-in compatible
sessions, with loading, empty, offline, partial-result, and retry states. Agent
cards use a responsive 4:5 gallery with large rounded avatars, presence dots,
bottom-aligned names and descriptions, and an Activity log menu. Working stays
separate from presence. The first gallery card opens Add agent in a two-tone
Buzz-style dialog with a fixed header and footer, thin sidebar, and a shadcn
Scroll Area whose scrollbar sits at the right edge of the form body. Its image
picker is anchored below the square trigger, includes the shared global emoji
picker after local presets, and sits beside a form that uses the shared
Community chat composer for agent instructions.
The existing Agents view lists reusable owner-authored personas alongside the
verified directory for editing and deletion. Add agent is the single persona
creation path: it can create a `30175` persona or select a saved persona, then
links the existing agent public key through owner-authored kind `30177` without
copying persona configuration into the link. Persona deletion uses the shared
confirmation dialog. The link carries the exact persona slug,
an explicit inherited or instance name mode, an instance name, and Buzz
defaults for newly completed records. Existing unknown and behavioral
configuration is preserved. The verified directory still requires the agent's
own signed profile and ownership proof before showing the agent. The gallery
has no search field [deferred: DEFER-AGENT-004], process creation, runtime
activation or Start controls. Private aggregate kind `30179` remains rejected
until its privacy and lifecycle contract is complete
[deferred: DEFER-AGENT-005].
Agent and community history
clearing use destructive red buttons and confirmation dialogs; cancellation
preserves history and failures remain retryable.
Profile entry points recognize verified agents and use the shared exclusive
right sidebar. Info provides identity, owner, key copy, persona status and an
activity link. The existing profile owns create/edit/delete, explicit name
inheritance and non-destructive unlinking. Deleting a persona retains its link
as visibly unresolved; presentation falls back to `kind:0`. Channels
uses the viewer's room permissions; agent ownership grants no administrative
rights. Removal and local history clearing require confirmation and retain the
dialog when an operation fails.
The Info tab uses leading Lucide icons for the description, public key, owner,
and agent type. Its Activity log row has a wrench icon and a trailing View label
and chevron. Managed by opens the verified owner's existing member profile and
preserves browser Back navigation. Optional `ownerName` and `onOpenOwner` profile
props let custom hosts provide this navigation without breaking existing hosts.
The Channels tab groups its add action and memberships inside one rounded,
bordered surface, with a leading add-member icon and trailing chevron on the
add row, and an open-channel arrow on each membership row. Permitted removal
stays in each channel's 12rem-wide actions menu as Remove, with the agent and
channel identified in the confirmation dialog. The add-agent
modal uses the shared Command View search and keyboard picker, excludes
existing memberships and archived or unmanageable rooms, and requires a
selection before confirmation. It shows the full agent key with copy feedback,
retains selection and errors on failure, and restores focus on close. Message
and Follow use the existing member-profile hover and keyboard-focus treatment.
Presence uses the shared avatar dot, including an explicit unknown state, while
Working remains separate. The profile does not duplicate presence as a chip.
The current add-member action does not take a role, so the modal does not offer
Buzz's role selector.

Activity replaces the profile with Back navigation and supports agent/channel
selection, older saved pages and Latest. Events use the review activity timeline
layout: a connected icon rail and content aligned beside each marker. Icons
provide category context with accessible labels, without repeating category
chips on each event. Shared
`CommunityRelativeTime` labels retain full timestamps in their tooltip and
machine-readable time elements. Plain escaped text presents messages,
tools, plans, lifecycle updates, errors and bounded unknown payloads. Browser
agent routes contain only identity and filter selections, never private content.
The public Pulse Agents filter uses the verified directory; private observer
activity stays outside public Pulse. Functional acceptance is mapped to
LC-UI-037; visual acceptance remains pending human review.

The Agents directory and profiles consume the shared dialog, confirmation,
avatar-picker, composer, Markdown, and skeleton contracts in the Community UI
catalog. Persona drafts persist in the open form after rejected writes. Initial
agent discovery and activity loading use gallery and timeline skeletons, with
retained content during refresh. Local history clearing uses the compact
retryable confirmation composition.
