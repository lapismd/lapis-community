# Agents and saved activity

Community follows the executable agent protocol audited in `block/buzz`
commit `cec5c8fd9280d30f56effac701e1e19d5cfe6fea`, and the agent module in
Lapis Relay. Buzz Desktop 0.5.23 supplied the live layout reference. Agent
execution remains in an external harness; Community does not start processes
or manage models, defaults, teams, personas, memories, or turn metrics.

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

Presence kind `20001` expires after 180 seconds. Relay-generated snapshots
require the relay's signature and an exact subject `p` tag. Typing kind `20002`
expires after eight seconds. Neither absence nor expired presence proves that
an agent process has stopped.

Follow and Unfollow refresh the current kind `3` contact list before each
serialized write and preserve unrelated contacts, tags, and content. Message
uses Community's existing NIP-17 direct-message flow.

## Requirements

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-022 | The owned-agent directory MUST verify agent profile signatures and full NIP-OA owner proofs, apply deterministic replacement and authorized deletion, derive channels only from relay-signed membership, and discover through bounded authenticated bridge queries. Follow mutations MUST preserve unrelated contact data and surface signer or relay failure. Presence and typing MUST be transient and MUST NOT imply runtime control. |

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

| Buzz feature                                | Community behavior                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Owned agents, identity, profile, public key | Verified directory and Info profile                                          |
| Message, Follow / Unfollow                  | Existing encrypted conversation and signed contact-list update               |
| Presence and working                        | Independent expiring signals; `turn_finished` completes a live turn          |
| Channels                                    | Accessible relay-signed memberships and existing permission-gated add/remove |
| Private observer activity                   | Continuous signed-in capture and encrypted device history                    |
| Teams, personas, memories, metrics          | Protocol families supported; UI deferred                                     |
| Start / Stop, models, defaults, runtime     | External manager required; omitted                                           |
| Private managed-agent kind 30179            | Rejected by relay; omitted                                                   |

The main Agents navigation appears beside Projects for signed-in compatible
sessions, with loading, empty, offline, partial-result, and retry states. Profile
entry points recognize verified agents and use the shared exclusive right
sidebar. Info provides identity, owner, key copy and an activity link. Channels
uses the viewer's room permissions; agent ownership grants no administrative
rights. Removal and local history clearing require confirmation and retain the
dialog when an operation fails.

Activity replaces the profile with Back navigation and supports agent/channel
selection, older saved pages and Latest. Plain escaped text presents messages,
tools, plans, lifecycle updates, errors and bounded unknown payloads. Browser
agent routes contain only identity and filter selections, never private content.
The public Pulse Agents filter uses the verified directory; private observer
activity stays outside public Pulse. Functional acceptance is mapped to
LC-UI-037; visual acceptance remains pending human review.
