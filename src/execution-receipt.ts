import { webcrypto } from "node:crypto";
import { canonicalize, type JsonValue } from "./canonicalize.js";

export const EXECUTION_RECEIPT_SCHEMA = "clas.execution.receipt.v1" as const;
export const EXECUTION_PROOF_COVERS = ["receipt_id", "verb", "agent", "action"] as const;
export const SETTLEMENT_PROOF_COVERS = ["receipt_id", "settlement"] as const;
export type ClasProofType = "execution" | "settlement";

export interface ClasExecutionAgent { id: string; [key: string]: JsonValue; }
export interface ClasExecutionAction { [key: string]: JsonValue; }
export interface ClasExecutionSettlement { payment_ref?: string; stealth_address?: string; [key: string]: JsonValue | undefined; }
export interface ClasScopedProof {
  type: ClasProofType;
  covers: string[];
  signer: string;
  canonicalization: "json.sorted_keys.v1";
  hash?: { alg: "SHA-256"; value: string };
  signature: { alg: "Ed25519"; kid: string; value: string };
}
export type ClasExecutionProof = ClasScopedProof & { type: "execution" };
export type ClasSettlementProof = ClasScopedProof & { type: "settlement" };
export interface ClasExecutionReceiptV1 {
  clas: "1.0";
  schema: typeof EXECUTION_RECEIPT_SCHEMA;
  receipt_id: string;
  verb: string;
  agent: ClasExecutionAgent;
  action: ClasExecutionAction;
  settlement?: ClasExecutionSettlement;
  proofs: ClasScopedProof[];
}
export interface VerifyScopedProofResult {
  type: string;
  signer: string;
  covered_fields: string[];
  hash_matches: boolean;
  signature_valid: boolean;
  signer_identity_verified: boolean;
  ok: boolean;
  errors: string[];
}
export interface VerifyScopedExecutionReceiptResult { ok: boolean; proofs: VerifyScopedProofResult[]; errors: string[]; }
export interface SignScopedProofOptions { signer: string; kid: string; privateKeyPem: string; }
export interface SignerBoundPublicKey {
  publicKeyPemOrDer: string | ArrayBuffer;
  signer: string;
}

export interface VerifyExecutionReceiptOptions {
  publicKeyPem?: string;
  publicKeyPemOrDer?: string | ArrayBuffer;
  publicKeysByKid?: Record<string, string | ArrayBuffer | SignerBoundPublicKey>;
  resolvePublicKey?: (proof: ClasScopedProof) => Promise<string | ArrayBuffer | SignerBoundPublicKey | undefined> | string | ArrayBuffer | SignerBoundPublicKey | undefined;
  requireSettlementProof?: boolean;
  requireSignerBinding?: boolean;
}

const subtle = webcrypto.subtle;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bytes = Buffer.from(clean, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
function asArrayBuffer(value: string | ArrayBuffer): ArrayBuffer { return typeof value === "string" ? pemToArrayBuffer(value) : value; }
async function importPrivateKey(pem: string): Promise<CryptoKey> { return subtle.importKey("pkcs8", pemToArrayBuffer(pem), { name: "Ed25519" }, false, ["sign"]); }
async function importPublicKey(key: string | ArrayBuffer): Promise<CryptoKey> { return subtle.importKey("spki", asArrayBuffer(key), { name: "Ed25519" }, false, ["verify"]); }
async function sha256Hex(input: string): Promise<string> { return Buffer.from(await subtle.digest("SHA-256", new TextEncoder().encode(input))).toString("hex"); }
function b64(bytes: ArrayBuffer): string { return Buffer.from(bytes).toString("base64"); }
function fromB64(value: string): ArrayBuffer { const bytes = Buffer.from(value, "base64"); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); }

export function createExecutionReceipt(params: {
  receiptId: string; verb: string; agent: ClasExecutionAgent; action: ClasExecutionAction; settlement?: ClasExecutionSettlement;
}): ClasExecutionReceiptV1 {
  const receipt: ClasExecutionReceiptV1 = { clas: "1.0", schema: EXECUTION_RECEIPT_SCHEMA, receipt_id: params.receiptId, verb: params.verb, agent: params.agent, action: params.action, proofs: [] };
  if (params.settlement !== undefined) receipt.settlement = params.settlement;
  assertSafeReceipt(receipt, { requireSettlementProof: false });
  return receipt;
}

function coveredPayload(receipt: ClasExecutionReceiptV1, covers: readonly string[]): Record<string, JsonValue | undefined> {
  return Object.fromEntries(covers.map((field) => [field, (receipt as unknown as Record<string, JsonValue | undefined>)[field]]));
}
async function createProof(receipt: ClasExecutionReceiptV1, covers: readonly string[], type: ClasProofType, options: SignScopedProofOptions): Promise<ClasScopedProof> {
  const canonical = canonicalize(coveredPayload(receipt, covers) as JsonValue);
  const hash = await sha256Hex(canonical);
  const key = await importPrivateKey(options.privateKeyPem);
  return { type, covers: [...covers], signer: options.signer, canonicalization: "json.sorted_keys.v1", hash: { alg: "SHA-256", value: hash }, signature: { alg: "Ed25519", kid: options.kid, value: b64(await subtle.sign("Ed25519", key, new TextEncoder().encode(canonical))) } };
}
export async function signExecutionProof(receipt: ClasExecutionReceiptV1, options: SignScopedProofOptions): Promise<ClasExecutionReceiptV1> {
  const proof = await createProof(receipt, EXECUTION_PROOF_COVERS, "execution", options) as ClasExecutionProof;
  return { ...receipt, proofs: [...receipt.proofs, proof] };
}
export function attachSettlementProof(receipt: ClasExecutionReceiptV1, settlementProof: ClasSettlementProof): ClasExecutionReceiptV1 {
  if (!receipt.settlement) throw new Error("Cannot attach settlement proof without receipt.settlement");
  assertProofCovers(settlementProof);
  return { ...receipt, proofs: [...receipt.proofs, settlementProof] };
}
export async function signSettlementProof(receipt: ClasExecutionReceiptV1, options: SignScopedProofOptions): Promise<ClasExecutionReceiptV1> {
  if (!receipt.settlement) throw new Error("Cannot sign settlement proof without receipt.settlement");
  const proof = await createProof(receipt, SETTLEMENT_PROOF_COVERS, "settlement", options) as ClasSettlementProof;
  return attachSettlementProof(receipt, proof);
}

function same(a: readonly string[], b: readonly string[]): boolean { return a.length === b.length && a.every((v, i) => v === b[i]); }
function isRawTransactionHash(value: string): boolean { return /^0x[a-fA-F0-9]{64}$/.test(value); }
function findRawTransactionHash(value: unknown, path = "settlement"): string | undefined {
  if (typeof value === "string") return isRawTransactionHash(value) ? path : undefined;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findRawTransactionHash(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const found = findRawTransactionHash(nested, `${path}.${key}`);
      if (found) return found;
    }
  }
  return undefined;
}
function assertProofCovers(proof: ClasScopedProof): void {
  if (proof.type === "execution" && !same(proof.covers, EXECUTION_PROOF_COVERS)) throw new Error("Execution proof must cover exactly receipt_id, verb, agent, action and must not cover settlement");
  if (proof.type === "settlement" && !same(proof.covers, SETTLEMENT_PROOF_COVERS)) throw new Error("Settlement proof must cover exactly receipt_id, settlement and must not cover action");
  if (proof.type !== "execution" && proof.type !== "settlement") throw new Error(`Unknown scoped proof type: ${(proof as { type: string }).type}`);
  if (proof.canonicalization !== "json.sorted_keys.v1") throw new Error(`Unsupported proof canonicalization: ${proof.canonicalization}`);
  if (proof.signature?.alg !== "Ed25519") throw new Error(`Unsupported proof signature algorithm: ${proof.signature?.alg}`);
}
export function assertSafeReceipt(receipt: ClasExecutionReceiptV1, options: { requireSettlementProof?: boolean } = {}): void {
  if (receipt.clas !== "1.0") throw new Error('Invalid execution receipt clas: expected "1.0"');
  if (receipt.schema !== EXECUTION_RECEIPT_SCHEMA) throw new Error(`Invalid execution receipt schema: expected ${EXECUTION_RECEIPT_SCHEMA}`);
  for (const proof of receipt.proofs) assertProofCovers(proof);
  if (!receipt.settlement && receipt.proofs.some((p) => p.type === "settlement")) throw new Error("Settlement proof is present but receipt.settlement is missing");
  if (receipt.settlement) {
    if (receipt.settlement.stealth_address !== undefined) throw new Error("settlement.stealth_address must not be published");
    const rawHashPath = findRawTransactionHash(receipt.settlement);
    if (rawHashPath) throw new Error(`${rawHashPath} must not contain a raw 0x transaction hash`);
    if (options.requireSettlementProof !== false && !receipt.proofs.some((p) => p.type === "settlement")) throw new Error("Settlement is present but no settlement proof was provided");
  }
}

function isSignerBoundPublicKey(value: unknown): value is SignerBoundPublicKey {
  return value !== null && typeof value === "object" && "publicKeyPemOrDer" in value && "signer" in value;
}
async function resolveKey(proof: ClasScopedProof, options: VerifyExecutionReceiptOptions): Promise<{ key?: string | ArrayBuffer; signerIdentityVerified: boolean; signerBindingError?: string }> {
  const keyForKid = options.publicKeysByKid?.[proof.signature.kid];
  const resolved = keyForKid ?? await options.resolvePublicKey?.(proof);
  if (isSignerBoundPublicKey(resolved)) {
    return resolved.signer === proof.signer
      ? { key: resolved.publicKeyPemOrDer, signerIdentityVerified: true }
      : { key: resolved.publicKeyPemOrDer, signerIdentityVerified: false, signerBindingError: `Proof signer ${proof.signer} does not match bound key signer ${resolved.signer}` };
  }
  if (resolved) return { key: resolved, signerIdentityVerified: false };
  return { key: options.publicKeyPem ?? options.publicKeyPemOrDer, signerIdentityVerified: false };
}
export async function verifyExecutionReceipt(receipt: ClasExecutionReceiptV1, options: VerifyExecutionReceiptOptions = {}): Promise<VerifyScopedExecutionReceiptResult> {
  const errors: string[] = [];
  const requireSignerBinding = options.requireSignerBinding ?? true;
  try { assertSafeReceipt(receipt, { requireSettlementProof: options.requireSettlementProof }); } catch (err) { errors.push(err instanceof Error ? err.message : String(err)); }

  await tryRuntimeCoreScopedVerification(receipt, options);

  const proofs: VerifyScopedProofResult[] = [];
  for (const proof of receipt.proofs) {
    const proofErrors: string[] = [];
    let hashMatches = false, signatureValid = false, signerIdentityVerified = false;
    try { assertProofCovers(proof); } catch (err) { proofErrors.push(err instanceof Error ? err.message : String(err)); }
    const canonical = canonicalize(coveredPayload(receipt, proof.covers) as JsonValue);
    const computedHash = await sha256Hex(canonical);
    hashMatches = proof.hash?.value === undefined || (proof.hash.alg === "SHA-256" && proof.hash.value === computedHash);
    if (!hashMatches) proofErrors.push("Proof hash does not match covered payload");
    const resolvedKey = await resolveKey(proof, options);
    signerIdentityVerified = resolvedKey.signerIdentityVerified;
    if (resolvedKey.signerBindingError) proofErrors.push(resolvedKey.signerBindingError);
    if (!resolvedKey.key) proofErrors.push(`No public key available for kid ${proof.signature.kid}`);
    else {
      try {
        signatureValid = await subtle.verify("Ed25519", await importPublicKey(resolvedKey.key), fromB64(proof.signature.value), new TextEncoder().encode(canonical));
      } catch (err) {
        proofErrors.push(`Proof signature verification failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!signatureValid) proofErrors.push("Proof signature is invalid");
    if (requireSignerBinding && !signerIdentityVerified) proofErrors.push("Proof signer identity is not bound to the supplied public key");
    proofs.push({ type: proof.type, signer: proof.signer, covered_fields: proof.covers, hash_matches: hashMatches, signature_valid: signatureValid, signer_identity_verified: signerIdentityVerified, ok: proofErrors.length === 0, errors: proofErrors });
  }
  const executionProofs = proofs.filter((proof) => proof.type === "execution");
  if (executionProofs.length === 0) errors.push("Missing execution proof");
  if (executionProofs.length > 0 && !executionProofs.some((proof) => proof.ok)) errors.push("No valid execution proof verified");
  return { ok: errors.length === 0 && executionProofs.some((proof) => proof.ok) && proofs.every((p) => p.ok), proofs, errors };
}

async function tryRuntimeCoreScopedVerification(
  receipt: ClasExecutionReceiptV1,
  options: VerifyExecutionReceiptOptions,
): Promise<void> {
  try {
    const runtimeCore = await import("@commandlayer/runtime-core") as {
      verifyScopedProofs?: (receipt: unknown, options: unknown) => unknown | Promise<unknown>;
    };
    if (typeof runtimeCore.verifyScopedProofs === "function") {
      await runtimeCore.verifyScopedProofs(receipt, options);
    }
  } catch {
    // Keep the SDK helper usable in tests and applications that pass local
    // public keys even if runtime-core throws due to an adapter mismatch. The
    // normalized per-proof result below remains the public SDK return shape.
  }
}
