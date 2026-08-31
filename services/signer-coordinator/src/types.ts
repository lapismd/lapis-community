import type {
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";

export interface CoordinatorOperatorProfile {
  operatorId: string;
  endpoint: string;
  publicCommitment: string;
}

export interface CoordinatorGroupProfile {
  groupPubkey: string;
  threshold: number;
  operators: CoordinatorOperatorProfile[];
}

export interface CoordinatorRoundStore {
  reserve(groupPubkey: string, roundId: string): Promise<boolean>;
}

export interface ThresholdRoundPreparation {
  context: string;
  operatorPayloads: ReadonlyMap<string, string>;
}

export interface ThresholdCoordinatorEngine {
  prepare(request: {
    roundId: string;
    group: CoordinatorGroupProfile;
    template: NostrEventTemplate;
  }): Promise<ThresholdRoundPreparation>;
  verifyPartial(request: {
    context: string;
    operator: CoordinatorOperatorProfile;
    partialSignature: string;
  }): Promise<boolean>;
  aggregate(request: {
    context: string;
    partials: ReadonlyMap<string, string>;
  }): Promise<NostrEvent>;
}

export interface ThresholdOperatorClient {
  readonly operatorId: string;
  createPartial(request: {
    roundId: string;
    groupPubkey: string;
    payload: string;
  }): Promise<{ operatorId: string; partialSignature: string }>;
}

export interface CoordinatorAuditSink {
  record(entry: {
    action: "threshold-sign";
    outcome: "accepted" | "rejected";
    groupPubkey: string;
    roundId: string;
    participatingOperatorIds: string[];
    occurredAt: string;
  }): Promise<void>;
}
