import { canonicalize, type JsonValue } from "./canonicalize.js";
import { importEd25519PrivateKeyFromPem, sha256Hex, signEd25519Base64 } from "./crypto.js";

export interface ReceiptInput {
  signer: string;
  verb: string;
  ts: string;
  input: JsonValue;
  output: JsonValue;
  execution: {
    status: "ok" | "error";
    duration_ms: number;
    error?: string;
  };
}

export interface Receipt extends ReceiptInput {
  metadata: {
    proof: {
      canonicalization: string;
      hash_sha256: string;
    };
  };
  signature: {
    alg: "ed25519";
    kid: string;
    sig: string;
  };
}

export function canonicalPayloadFromReceiptInput(receipt: ReceiptInput) {
  return {
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
    metadata: {
      proof: {
        canonicalization: params.canonicalization,
        hash_sha256: hash,
      },
    },
    signature: {
      alg: "ed25519",
      kid: params.keyId,
      sig,
    },
  };
}
