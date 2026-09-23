import type {
  CommunityAgentIdentity,
  CommunityAgentPersona,
} from "./agent-contracts.js";
import { personaSlugFromName } from "./agent-persona-slug.js";

export function editorPersonaSelection(
  value: string,
  personas: readonly CommunityAgentPersona[],
  agent: CommunityAgentIdentity | undefined,
  currentSlug: string,
): {
  personaName: string;
  personaDescription: string;
  personaAvatar: string;
  personaPrompt: string;
  personaSlug: string;
} {
  const selected = personas.find((persona) => persona.slug === value);
  if (selected) {
    return {
      personaName: selected.displayName,
      personaDescription: selected.description ?? "",
      personaAvatar: selected.avatarUrl ?? "",
      personaPrompt: selected.systemPrompt ?? "",
      personaSlug: selected.slug,
    };
  }
  return {
    personaName: agent?.name ?? "",
    personaDescription: agent?.about ?? "",
    personaAvatar: agent?.avatarUrl ?? "",
    personaPrompt: "",
    personaSlug:
      agent?.instance?.personaId ??
      (agent ? personaSlugFromName(agent.name) : currentSlug),
  };
}
