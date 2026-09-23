import { describe, expect, it } from "vitest";
import { editorPersonaSelection } from "./agent-editor-persona-selection.js";
import type {
  CommunityAgentIdentity,
  CommunityAgentPersona,
} from "./agent-contracts.js";

const persona = {
  slug: "nyra",
  displayName: "Nyra",
  description: "A research agent",
  systemPrompt: "Be precise.",
  avatarUrl: "https://example.test/nyra.png",
} as CommunityAgentPersona;

const agent = {
  pubkey: "abc",
  name: "Nyra instance",
  about: "Owned agent",
  avatarUrl: "https://example.test/agent.png",
  instance: { personaId: "nyra-instance" },
} as CommunityAgentIdentity;

describe("editorPersonaSelection", () => {
  it("copies a saved persona when that slug is selected", () => {
    expect(editorPersonaSelection("nyra", [persona], agent, "current")).toEqual(
      {
        personaName: "Nyra",
        personaDescription: "A research agent",
        personaAvatar: "https://example.test/nyra.png",
        personaPrompt: "Be precise.",
        personaSlug: "nyra",
      },
    );
  });

  it("falls back to the current agent when creating a new persona", () => {
    expect(
      editorPersonaSelection("__new__", [persona], agent, "current"),
    ).toEqual({
      personaName: "Nyra instance",
      personaDescription: "Owned agent",
      personaAvatar: "https://example.test/agent.png",
      personaPrompt: "",
      personaSlug: "nyra-instance",
    });
  });
});
