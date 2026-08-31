export interface OperatorSigningRequest {
  roundId: string;
  groupPubkey: string;
  payload: string;
}

export interface OperatorSigningResponse {
  operatorId: string;
  partialSignature: string;
}

export interface OperatorRoundStore {
  reserve(groupPubkey: string, roundId: string): Promise<boolean>;
}

export interface ThresholdShareEngine {
  createPartial(request: OperatorSigningRequest): Promise<string>;
}

export interface OperatorAuditSink {
  record(entry: {
    action: "partial-sign";
    outcome: "accepted" | "rejected";
    operatorId: string;
    groupPubkey: string;
    roundId: string;
    occurredAt: string;
  }): Promise<void>;
}
