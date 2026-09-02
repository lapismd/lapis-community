# Community Components

## Requirements

| ID        | Requirement                                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-UI-001 | Reusable Svelte components MUST live in one component-named folder beneath `src/components`, and each independent catalog surface MUST have a colocated Storybook story.                                             |
| LC-UI-002 | The public `RegistryCommunity` component MUST compose smaller header, summary, reaction, composer, post-stream, post, and timeline components instead of owning their presentation as one monolith.                  |
| LC-UI-003 | Relay and pagination orchestration MUST remain outside leaf presentation components so their normal, loading, reply, reaction, and error states can be rendered without a live relay.                                |
| LC-UI-004 | Long discussions MUST fetch bounded windows, preserve chronological order and reply context, and use the timeline as a relay-backed paginator rather than loading the complete topic.                                |
| LC-UI-005 | Storybook interaction and accessibility checks and the static Storybook build MUST pass before a component slice is considered verified. Visual baselines MUST NOT be created or replaced without explicit approval. |
| LC-UI-006 | Community components MUST consume normalized relay-independent workspace models and controlled handlers. Presentation components MUST NOT connect to relays, request signatures, or publish Nostr events.            |
| LC-UI-007 | Full community workspace stories MUST compose the public Design Core App Shell directly. The package MUST NOT export a parallel Lapis shell abstraction; Design Core owns shell geometry and responsive state.       |
| LC-UI-008 | Channel and forum-thread conversations MUST compose the public Design Core Chat primitives. Experimental reaction and emoji-picker APIs MUST remain isolated behind `CommunityMessage`.                              |
| LC-UI-009 | The Storybook catalog MUST expose independent Lapis/default branding and light/dark colour-mode controls, and component styles MUST inherit semantic Design Core theme tokens.                                       |
| LC-UI-010 | Deterministic stories MUST cover desktop channels, threaded replies, forum indexes, long-form forum threads, compact and mobile navigation, responsive focus restoration, reactions, and fixture-only submission.    |
| LC-UI-011 | The Storybook catalog MUST expose Design Core's canonical two-expanded-sidebars reference fixture unchanged so Community composition can be compared against the upstream shell contract.                           |
| LC-UI-012 | Fullscreen shell stories MUST remove Storybook-root padding and document scrolling while retaining independently scrollable App Shell sidebar and body regions.                                                      |
| LC-UI-013 | Community navigation MUST compose Design Core App Shell, SearchFilterBar, Collapsible, and Dropdown Menu primitives; expose supported inbox, registry, channel, forum, and direct-message destinations; and keep action-menu icons aligned through owned Buzz-like presentation styling. |

The package uses Design Core controls for shared interaction primitives. Local
CSS owns the Discourse-inspired registry layout and the Slack/Buzz-style
community content because timeline, post stream, room navigation, and
custom-element boundaries are application-specific. Design Core App Shell owns
the workspace geometry, selectors, offstage inertness, focus restoration, and
automatic desktop/mobile presentation. Relay adapters will map Nostr-derived
state into the normalized community models in a later slice.
