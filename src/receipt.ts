import { canonicalize, type JsonValue } from "./canonicalize.js";
import { importEd25519PrivateKeyFromPem, sha256Hex, signEd25519Base64 } from "./crypto.js";

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

export interface Receipt extends ReceiptInput {
  proof: {
    canonicalization: string;
    hash: string;
    signature_alg: "ed25519";
    signature: string;
    key_id: string;
    signer: string;
  };
}

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
  canonicalization: string;
  input: ReceiptInput;
}): Promise<Receipt> {
  const canonicalPayload = canonicalPayloadFromReceiptInput(params.input);
  const canonical = canonicalize(canonicalPayload);
  const hash = await sha256Hex(canonical);

  const privateKey = await importEd25519PrivateKeyFromPem(params.privateKeyPem);
  const sig = await signEd25519Base64(privateKey, hash);

  return {
    ...params.input,
    proof: {
      canonicalization: params.canonicalization,
      hash,
      signature_alg: "ed25519",
      signature: sig,
      key_id: params.keyId,
      signer: params.input.signer,
    },
  };
}
