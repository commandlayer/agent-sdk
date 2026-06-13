import {
  attachSettlementProof,
  createExecutionReceipt,
  type ClasSettlementProof,
} from "../src/index.js";

// Execution-only approve receipt. Sign with signExecutionProof(...) before publishing.
export const executionOnlyApproveReceipt = createExecutionReceipt({
  receiptId: "receipt_approve_001",
  verb: "approve",
  agent: { id: "did:example:agent:alpha", name: "Alpha Agent" },
  action: { target: "invoice_123", approved: true },
});

// Execution + private settlement receipt. The payment_ref is an opaque rail reference,
// not a raw transaction hash, and no stealth_address is published.
export const executionWithPrivateSettlementReceipt = createExecutionReceipt({
  receiptId: "receipt_settlement_001",
  verb: "approve",
  agent: { id: "did:example:agent:alpha" },
  action: { target: "invoice_123", approved: true },
  settlement: { rail: "x402", payment_ref: "rail:opaque:settlement_456", amount: "10.00", asset: "USDC" },
});

const settlementProof: ClasSettlementProof = {
  type: "settlement",
  covers: ["receipt_id", "settlement"],
  signer: "did:example:payer:beta",
  canonicalization: "json.sorted_keys.v1",
  signature: { alg: "Ed25519", kid: "payer-key-1", value: "replace-with-signature" },
};

export const receiptWithAttachedSettlementProof = attachSettlementProof(
  executionWithPrivateSettlementReceipt,
  settlementProof,
);

// Invalid: an execution proof must not cover settlement. verifyExecutionReceipt(...)
// rejects this shape before trusting the proof.
export const invalidAgentCoversSettlementReceipt = {
  ...executionWithPrivateSettlementReceipt,
  proofs: [{
    type: "execution",
    covers: ["receipt_id", "verb", "agent", "action", "settlement"],
    signer: "did:example:agent:alpha",
    canonicalization: "json.sorted_keys.v1",
    signature: { alg: "Ed25519", kid: "agent-key-1", value: "invalid" },
  }],
};
