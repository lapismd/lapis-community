# Agents and saved activity

Owner Activity shows the latest queued or startup status until a request produces
assistant or tool output. The status updates in place and disappears on output
or termination, so an active cold start does not look like an empty transcript.
A host-queued request is labelled Queued. Activity lists every open run for the
visible channel, including another thread, and any interrupted run that still
blocks the workspace. Each of those rows can be cancelled on its own.
This is included in the LC-UI-049 context acceptance.

Community follows the executable agent protocol audited in `block/buzz`
commit `cec5c8fd9280d30f56effac701e1e19d5cfe6fea`, and the agent module in
Lapis Relay. Buzz Desktop 0.5.23 supplied the live layout reference. Thread
composer auto-mention behaviour is audited against Desktop
`ef2aa1ae38fadcc0bc22b8bf6ed96b35933146be`. Agent
execution remains in the independently deployed Nostr Agent Controller;
Community does not start processes, activate models, or own runtime secrets.
Teams, memories, and turn metrics remain outside this release. Those boundaries
remain tracked as runtime reconciliation [deferred: DEFER-AGENT-001], remaining
operational controls [deferred: DEFER-AGENT-002], and private agent data UI
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

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-022 | The owned-agent directory MUST verify agent profile signatures and full NIP-OA owner proofs, apply deterministic replacement and authorized deletion, derive channels only from relay-signed membership, and discover through bounded authenticated bridge queries. Follow mutations MUST preserve unrelated contact data and surface signer or relay failure. Presence and typing MUST be transient and MUST NOT imply runtime control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LC-NOSTR-023 | Community MUST keep owner-signed persona definitions (`30175`), owner-signed agent instances (`30177`), and agent-signed public profiles (`kind:0`) distinct. Persona edits MUST preserve unknown configuration, remove known secret-bearing fields, advance timestamps beyond the current head, and keep drafts on failure. Name inheritance MUST use explicit `name_mode`; missing legacy modes mean independent instance naming. Managed presentation MUST resolve persona avatar and inherited name first, then the agent-signed public profile. Unlinking MUST preserve the agent and instance name without copying the persona prompt, while deletion MUST leave an unresolved link with public-profile fallbacks. Saved prompts MUST remain desired state outside Community process execution. Local activity-archive restoration MUST NOT delay relay directory readiness.                                                                                                                                                                                                                                      |
| LC-NOSTR-025 | Community MUST publish cancel, conversation-reset, permission-response, runtime-default, and memory-review commands as fresh owner-signed kind `24200` control events encrypted to the exact verified agent. Runtime values MUST come from the controller-provided ACP catalog, including a permission mode only when that catalog advertises config option `mode`. Memory reads and approve, reject, or retract actions MUST name one configured channel. Community MUST correlate fresh encrypted runtime and memory responses by request ID, keep them out of the activity archive, and discard pending requests when the controller or identity closes. It MUST derive pending permission requests and active controller scopes only from valid decrypted owner telemetry, preserve the opaque scope key, render only the exact offered decisions, clear terminal, resolved, or expired requests without an owner decision, omit expired cards from catch-up snapshots, and never treat channel membership as approval authority. A configured controller applies persona prompt changes before the next idle turn. |

## Encrypted local activity archive

Kind `24200` telemetry is captured while the active community is signed in,
including while the activity panel is closed. Owner routing, signatures,
current ownership, freshness, and channel membership are checked before
capture. The archive stores the original encrypted event, its signed agent
profile, and the owner-signed `30177` instance needed to verify managed custody.
The owner signer decrypts on the client; decoded payloads never enter
message search, event synchronization, or persistent storage.

The version-2 transcript archive uses additive Turso tables and an IndexedDB
version-4 migration,
through the existing shared database owner. It is partitioned by community,
normalized relay set, owner, and agent, deduplicates event IDs, and uses indexed
cursor pagination. Sequence numbers may reset across agent processes. Archive
records are kept until explicit clearing, independently of message cache
pruning and sign-out. Browser storage removal still removes this device's
history. Memory fallback is identified as session-only storage.

Community opens the live subscription before requesting catch-up for the
visible DM, channel, thread, or forum-topic context. A fresh encrypted
`sync_activity` control resumes after the device-local `{streamId, offset}`
checkpoint, and the controller returns missing original signed encrypted events
inside fresh `activity_sync_page` telemetry. Community validates the fresh
outer event, then verifies every nested signature, owner, agent, and context
before atomically archiving the page and advancing the checkpoint. A failed or
partially invalid page advances nothing. Original event IDs deduplicate live and
replayed delivery.

Catch-up is nonblocking and repeats after WebSocket reconnect and when the user
selects Latest. A ten-second nonresponse preserves local data and reports
synchronization as unavailable until reconnect, presence recovery, or another
Latest request. A fresh snapshot restores current work and pending permissions;
those `permission_requested` snapshot frames remain authoritative even when
live telemetry already recorded the same sequence. Historical start frames
never imply current work. Identity, community, agent,
or visible-context changes cancel stale requests.

The subscription accepts the relay’s five-minute freshness
window so modest clock skew cannot drop newly delivered frames; live working
expiry remains bounded by the event timestamp. Expired presence and archived turn-start events never indicate
current execution. Identity or community changes dispose subscriptions and
invalidate pending decryption. Storage failures pause saving with retryable
feedback and preserve earlier history. Users can clear history even when
storage is full. A suppression boundary omits frames created at or before the
clear action when no committed cursor can cover them. History selection includes previously verified archived
agents, and decoded windows remain bounded while older pages remain available.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LC-ARCH-022  | Agent telemetry MUST have a separate encrypted archive in the shared Turso, IndexedDB, and memory backends. The active signed-in community MUST capture valid owned telemetry independently of panel visibility, isolate owner and relay scopes, retain history until explicit clearing, page bounded decoded windows, cancel stale decryption, and expose storage and signer failures. Ordinary cache pruning and search MUST NOT consume this archive.                                                                                                                             |
| LC-ARCH-026  | Activity stores MUST keep per-context device-local stream checkpoints and commit each validated replay page and checkpoint atomically. Clear history MUST delete local archived and decoded activity while retaining the checkpoint, or record a local suppression timestamp when no checkpoint exists.                                                                                                                                                                                                                                                                              |
| LC-NOSTR-029 | Community MUST request owner-only activity catch-up only for the visible verified-agent context after opening the live subscription, validate every nested original event inside a fresh response, deduplicate by original event ID, restore current snapshots explicitly, time out nonblocking requests after ten seconds, and retry on reconnect, presence recovery, or Latest.                                                                                                                                                                                                    |
| LC-ARCH-027  | Activity contract version 2 MUST discard earlier device archives and checkpoints once, preserve agent identities and ordinary Nostr messages, accept only typed transcript entries from new controller runs, and reduce live and replayed entries through the same stable-id transcript projection.                                                                                                                                                                                                                                                                                  |
| LC-NOSTR-030 | Version-2 transcript telemetry MUST attribute the accepted owner-authored Nostr message by its original event ID and public key, and MUST render agent messages, disclosed thinking, sanitized tool details, permission outcomes, and terminal failures without parsing provider session files or ACP envelopes. Embedded thinking, tool, and resolved permission transcript rows MUST reserve the thread timestamp gutter and reveal their request time on hover or focus; resolved permission outcomes MUST render as left-aligned single-line summaries with overflow truncation. |

## Compatibility and screens

| Buzz feature                                   | Community behavior                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Owned agents, identity, profile, public key    | Verified directory and Info profile                                               |
| Message, Follow / Unfollow                     | Existing encrypted conversation and signed contact-list update                    |
| Presence and working                           | Independent expiring signals; `turn_finished` completes a live turn               |
| Channels                                       | Accessible relay-signed memberships and existing permission-gated add/remove      |
| Private observer activity                      | Continuous signed-in capture and encrypted device history                         |
| Missed private observer activity               | Owner-only controller catch-up for the visible conversation                       |
| Add agent                                      | Owner-signed persona creation plus an explicit managed-agent link                 |
| Persona presentation and prompt                | Name/avatar applied in Community; configured controller refreshes an idle session |
| Teams, memories, metrics                       | Protocol families supported; UI deferred                                          |
| Automatically mention agents in thread replies | Device-local switch, per-thread pins, `@Agent ` restore, and mention `p` tags     |
| Cancel, reset, and runtime permissions         | Owner-only encrypted controller controls                                          |
| Start, models, and runtime configuration       | Operator-owned; omitted                                                           |
| Private managed-agent kind 30179               | Rejected by relay; omitted                                                        |

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
has no search field [deferred: DEFER-AGENT-004], process creation, Start
control, or runtime configuration [deferred: DEFER-AGENT-002]. Private
aggregate kind `30179` remains rejected until its privacy and lifecycle
contract is complete [deferred: DEFER-AGENT-005].
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
selection, older saved pages and Latest. Its activity body composes the shared
Design Core AI chat message, reasoning, and tool-call components without a
composer. Owner prompts and agent replies retain Community avatars and names;
tool input and output use rich specialized renderers when recognized while keeping the same shared raw detail renderer as the AI plugin available from the message action menu.
`CommunityRelativeTime` labels retain full timestamps in their tooltip and
machine-readable time elements. Browser
agent routes contain only identity and filter selections, never private content.
The public Pulse Agents filter uses the verified directory; private observer
activity stays outside public Pulse. Functional acceptance is mapped to
LC-UI-037 and LC-UI-044; visual acceptance remains pending human review.

For a live verified agent, Activity presents the latest controller scope with
Cancel and confirmed Reset conversation actions. Decrypted
`permission_requested` frames become owner-only cards with the tool summary,
JSON input in a Design Core CodeBlock, expiry, and only the choices named by
the controller. Those choices render as a trailing split ButtonGroup with
distinct tones and a destructive deny. Controls
are encrypted with the active owner signer and remain pending until the relay
accepts the signed kind `24200` event; `permission_resolved` or terminal frames
remove stale cards. Expired requests MUST leave pending and waiting state
without an owner action, and decision buttons MUST NOT stay live after expiry.
A refresh snapshot replaces cards for that scope from its
`permission_requested` frames so a live sequence cannot wipe the approval UI
while the controller still waits; catch-up MUST NOT restore expired cards.
Historical agents never expose controls.

The Agents directory and profiles consume the shared dialog, confirmation,
avatar-picker, composer, Markdown, and skeleton contracts in the Community UI
catalog. Persona drafts persist in the open form after rejected writes. Initial
agent discovery and activity loading use gallery and timeline skeletons, with
retained content during refresh. Local history clearing uses the compact
retryable confirmation composition.

## Contextual activity and composer previews

The activity panel fixes the agent and origin context: overview, channel, exact
thread/topic, or DM. It has no agent/channel selectors. Profiles preserve their
origin and browser navigation restores it. Directory entry opens the agent
overview; contextual entry opens only that context. Live and decrypted archived
activity, permissions and controls use the same scope. Session/turn targets
prevent stale cancellation. Agent-wide history clearing belongs in the overview.

A shared row below conversation and reply composers displays the latest useful
current-request preview, never a carousel. It reserves footer space, truncates
one line, and opens matching activity. Multiple entries use a contextual
popover. Owners see encrypted output, tool summaries and warnings; other members
see only fresh public working status. Permission waits take priority. Completed
and cancelled turns disappear; errors remain ten seconds, or until a new request.
Saved activity never drives a live row. No plaintext persistence is added.

Preview and panel normalization agree; hidden reasoning, raw protocol payloads
and secrets are excluded. Keyboard access, restrained announcements, reduced
motion and unchanged composer error banners are required. Changed stories stay
visual-pending.

History loading is bounded to 15 seconds and streams matching records as they are
decrypted. A stalled archive or signer becomes a retryable error, not an endless
skeleton. Decoded frames may be reused in an owner-session memory cache, cleared
on disposal; archived frames never update live busy state.
