import {
  signCommandLayerReceipt,
  type CommandLayerCanonicalization,
  type CommandLayerReceipt,
  type SignCommandLayerReceiptParams,
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

export type Receipt = CommandLayerReceipt<ReceiptInput>;

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
  canonicalization: CommandLayerCanonicalization;
  input: ReceiptInput;
}): Promise<Receipt> {
  return signCommandLayerReceipt({
    receipt: params.input,
    privateKeyPem: params.privateKeyPem,
    kid: params.keyId,
    canonicalization: params.canonicalization,
  } as SignCommandLayerReceiptParams<ReceiptInput>);
}
