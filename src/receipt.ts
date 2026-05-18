import {
  signCommandLayerReceipt,
  type CommandLayerReceipt,
} from "@commandlayer/runtime-core";
import type { JsonValue } from "./canonicalize.js";

export interface ReceiptInput {
  version: "1.0.0";
  family: "trust-verification";
  signer: string;
  verb: string;
  ts: string;
  input: JsonValue;
  output: JsonValue;
  execution: {
    status: "ok" | "error";
    duration_ms: number;
    started_at: string;
    completed_at: string;
    error?: string;
  };
}

export interface CanonicalProofEnvelope {
  canonicalization: "json.sorted_keys.v1";
  hash: {
    alg: "SHA-256";
    value: string;
  };
  signature: {
    alg: "Ed25519";
    value: string;
    kid: string;
  };
}

export type Receipt = ReceiptInput & {
  metadata: {
    proof: CanonicalProofEnvelope;
  };
};

export function canonicalPayloadFromReceiptInput(receipt: ReceiptInput) {
  return {
    version: receipt.version,
    family: receipt.family,
    signer: receipt.signer,
    verb: receipt.verb,
    input: receipt.input,
    output: receipt.output,
    execution: receipt.execution,
    ts: receipt.ts,
  };
}

export async function createReceipt(params: {
  keyId: string;
  privateKeyPem: string;
  canonicalization: "json.sorted_keys.v1";
  input: ReceiptInput;
}): Promise<Receipt> {
  const signed = signCommandLayerReceipt(
    params.input as unknown as CommandLayerReceipt,
    {
      privateKeyPem: params.privateKeyPem,
      kid: params.keyId,
    },
  );

  return signed as unknown as Receipt;
}
