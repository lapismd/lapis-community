import { afterEach, describe, expect, it } from "vitest";

import {
  addPersistentAgentAudienceMember,
  getPersistentAgentAudience,
  getPersistentAgentAudienceEnabled,
  getPersistentAgentAudienceGeneration,
  getPersistentAgentAudienceScope,
  initializePersistentAgentAudience,
  promotePersistentAgentAudience,
  removePersistentAgentAudienceMember,
  resetPersistentAgentAudienceStore,
  setPersistentAgentAudienceEnabled,
} from "./persistent-agent-audience.js";

const owner = "1".repeat(64);
const agentA = "a".repeat(64);
const agentB = "b".repeat(64);
const agentC = "c".repeat(64);
const scope = `${owner}:general:thread:root`;

afterEach(() => {
  resetPersistentAgentAudienceStore();
});

describe("persistent agent audience", () => {
  it("scopes only thread composers", () => {
    expect(
      getPersistentAgentAudienceScope({
        ownerPubkey: owner,
        channelId: "general",
      }),
    ).toBeNull();
    expect(
      getPersistentAgentAudienceScope({
        ownerPubkey: owner,
        channelId: "general",
        threadRootId: "root",
      }),
    ).toBe(scope);
  });

  it("inherits root agents only on the first open", () => {
    setPersistentAgentAudienceEnabled(true);
    initializePersistentAgentAudience(scope, [agentA]);
    initializePersistentAgentAudience(scope, [agentB]);
    expect(getPersistentAgentAudience(scope)).toEqual([agentA]);
  });

  it("promotes authored mention order first", () => {
    setPersistentAgentAudienceEnabled(true);
    initializePersistentAgentAudience(scope, [agentA, agentB]);
    promotePersistentAgentAudience(scope, [agentB, agentC]);
    expect(getPersistentAgentAudience(scope)).toEqual([agentB, agentC, agentA]);
  });

  it("reconciles a removed mention", () => {
    setPersistentAgentAudienceEnabled(true);
    initializePersistentAgentAudience(scope, [agentA, agentB]);
    removePersistentAgentAudienceMember(scope, agentA);
    addPersistentAgentAudienceMember(scope, agentC);
    expect(getPersistentAgentAudience(scope)).toEqual([agentB, agentC]);
  });

  it("clears audiences and advances generation when disabled", () => {
    setPersistentAgentAudienceEnabled(true);
    initializePersistentAgentAudience(scope, [agentA]);
    const generation = getPersistentAgentAudienceGeneration();
    setPersistentAgentAudienceEnabled(false);
    expect(getPersistentAgentAudienceEnabled()).toBe(false);
    expect(getPersistentAgentAudience(scope)).toEqual([]);
    expect(getPersistentAgentAudienceGeneration()).toBe(generation + 1);
  });
});
