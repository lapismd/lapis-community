# Community Components

## Requirements

| ID        | Requirement                                                                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-UI-001 | Reusable Svelte components MUST live in one component-named folder beneath `src/components`, and each independent catalog surface MUST have a colocated Storybook story.                                             |
| LC-UI-002 | The public `RegistryCommunity` component MUST compose smaller header, summary, reaction, composer, post-stream, post, and timeline components instead of owning their presentation as one monolith.                  |
| LC-UI-003 | Relay and pagination orchestration MUST remain outside leaf presentation components so their normal, loading, reply, reaction, and error states can be rendered without a live relay.                                |
| LC-UI-004 | Long discussions MUST fetch bounded windows, preserve chronological order and reply context, and use the timeline as a relay-backed paginator rather than loading the complete topic.                                |
| LC-UI-005 | Storybook interaction and accessibility checks and the static Storybook build MUST pass before a component slice is considered verified. Visual baselines MUST NOT be created or replaced without explicit approval. |

The package uses Design Core controls for shared interaction primitives. Local
CSS owns the Discourse-inspired registry layout because timeline, post stream,
and custom-element boundaries are application-specific composition.
