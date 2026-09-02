# Specification Governance

## Requirements

| ID          | Requirement                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-SPEC-001 | `spec/src` MUST remain the canonical standalone package specification and MUST build with mdBook through `@lapismd/spec-validator`.                                                                                              |
| LC-SPEC-002 | Protected package, source, Storybook, Docker, script, and repository-policy changes MUST update an owning canonical chapter in the same Jujutsu change.                                                                          |
| LC-SPEC-003 | Every normative requirement ID MUST be unique and MUST have exactly one verification row containing concrete evidence.                                                                                                           |
| LC-SPEC-004 | Repository validation MUST include formatting, specification, Svelte and TypeScript checks, unit tests, Storybook interaction and accessibility tests, a static Storybook build, package build, and publish-manifest validation. |

`@lapismd/spec-validator` is development-only governance tooling. Published
runtime dependencies use ordinary npm semantic-version ranges and never local
workspace, file, or link dependencies.
