import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createExecutionReceipt,
  signExecutionProof,
  signSettlementProof,
  verifyExecutionReceipt,
  attachSettlementProof,
  type ClasExecutionReceiptV1,
  type ClasSettlementProof,
} from "../src/index.js";

function toPem(label: "PRIVATE KEY" | "PUBLIC KEY", data: ArrayBuffer): string {
  const b64 = Buffer.from(data).toString("base64");
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g)?.join("\n") ?? b64}\n-----END ${label}-----`;
}
async function keys() {
  const kp = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { privateKeyPem: toPem("PRIVATE KEY", await webcrypto.subtle.exportKey("pkcs8", kp.privateKey)), publicKeyPem: toPem("PUBLIC KEY", await webcrypto.subtle.exportKey("spki", kp.publicKey)) };
}
function baseReceipt(settlement = false) {
  return createExecutionReceipt({ receiptId: "r-1", verb: "approve", agent: { id: "did:agent:1" }, action: { approved: true, target: "thing" }, settlement: settlement ? { payment_ref: "rail:opaque:1", amount: "1.00" } : undefined });
}

test("create execution receipt", () => {
  const receipt = baseReceipt();
  assert.equal(receipt.clas, "1.0");
  assert.equal(receipt.schema, "clas.execution.receipt.v1");
  assert.deepEqual(receipt.proofs, []);
});

test("sign execution proof and verify execution-only receipt", async () => {
  const { privateKeyPem, publicKeyPem } = await keys();
  const signed = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem });
  assert.deepEqual(signed.proofs[0].covers, ["receipt_id", "verb", "agent", "action"]);
  assert.equal(signed.proofs[0].type, "execution");
  const result = await verifyExecutionReceipt(signed, { publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, true);
  assert.equal(result.proofs[0].signature_valid, true);
});

test("attach/sign settlement proof and verify execution + settlement receipt", async () => {
  const agent = await keys();
  const payer = await keys();
  let receipt = await signExecutionProof(baseReceipt(true), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt = await signSettlementProof(receipt, { signer: "did:payer:1", kid: "payer-key", privateKeyPem: payer.privateKeyPem });
  assert.deepEqual(receipt.proofs[1].covers, ["receipt_id", "settlement"]);
  const result = await verifyExecutionReceipt(receipt, { publicKeysByKid: { "agent-key": { publicKeyPemOrDer: agent.publicKeyPem, signer: "did:agent:1" }, "payer-key": { publicKeyPemOrDer: payer.publicKeyPem, signer: "did:payer:1" } } });
  assert.equal(result.ok, true);
});

test("action tamper invalidates execution proof", async () => {
  const { privateKeyPem, publicKeyPem } = await keys();
  const signed = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem });
  const tampered = { ...signed, action: { approved: false } };
  const result = await verifyExecutionReceipt(tampered, { publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.equal(result.proofs[0].signature_valid, false);
});

test("settlement tamper invalidates settlement proof only", async () => {
  const agent = await keys();
  const payer = await keys();
  let receipt = await signExecutionProof(baseReceipt(true), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt = await signSettlementProof(receipt, { signer: "did:payer:1", kid: "payer-key", privateKeyPem: payer.privateKeyPem });
  const tampered = { ...receipt, settlement: { payment_ref: "rail:opaque:2" } };
  const result = await verifyExecutionReceipt(tampered, { publicKeysByKid: { "agent-key": { publicKeyPemOrDer: agent.publicKeyPem, signer: "did:agent:1" }, "payer-key": { publicKeyPemOrDer: payer.publicKeyPem, signer: "did:payer:1" } } });
  assert.equal(result.proofs.find((p) => p.type === "execution")?.ok, true);
  assert.equal(result.proofs.find((p) => p.type === "settlement")?.ok, false);
});

test("execution proof cannot cover settlement", async () => {
  const receipt = baseReceipt(true) as ClasExecutionReceiptV1;
  receipt.proofs = [{ type: "execution", covers: ["receipt_id", "verb", "agent", "action", "settlement"], signer: "x", canonicalization: "json.sorted_keys.v1", signature: { alg: "Ed25519", kid: "k", value: "x" } }];
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: "bad", requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Execution proof/);
});

test("settlement proof cannot cover action", () => {
  const proof = { type: "settlement", covers: ["receipt_id", "settlement", "action"], signer: "x", canonicalization: "json.sorted_keys.v1", signature: { alg: "Ed25519", kid: "k", value: "x" } } as ClasSettlementProof;
  assert.throws(() => attachSettlementProof(baseReceipt(true), proof), /Settlement proof/);
});

test("settlement present without settlement proof invalid", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(true), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /no settlement proof/);
});

test("raw stealth address rejected", () => {
  assert.throws(() => createExecutionReceipt({ receiptId: "r", verb: "approve", agent: { id: "a" }, action: {}, settlement: { stealth_address: "0xabc" } }), /stealth_address/);
});

test("raw 0x tx hash payment_ref rejected", () => {
  assert.throws(() => createExecutionReceipt({ receiptId: "r", verb: "approve", agent: { id: "a" }, action: {}, settlement: { payment_ref: `0x${"a".repeat(64)}` } }), /payment_ref/);
});


test("receipt with only settlement proof is invalid and reports missing execution proof", async () => {
  const payer = await keys();
  const receipt = await signSettlementProof(baseReceipt(true), { signer: "did:payer:1", kid: "payer-key", privateKeyPem: payer.privateKeyPem });
  const result = await verifyExecutionReceipt(receipt, { publicKeysByKid: { "payer-key": { publicKeyPemOrDer: payer.publicKeyPem, signer: "did:payer:1" } } });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Missing execution proof/);
});

test("settlement proof without settlement is invalid", async () => {
  const payer = await keys();
  const receiptWithSettlement = await signSettlementProof(baseReceipt(true), { signer: "did:payer:1", kid: "payer-key", privateKeyPem: payer.privateKeyPem });
  const receipt = { ...receiptWithSettlement, settlement: undefined } as ClasExecutionReceiptV1;
  const result = await verifyExecutionReceipt(receipt, { requireSignerBinding: false, publicKeyPem: payer.publicKeyPem });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /receipt\.settlement is missing/);
});

test("changed schema invalidates receipt", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  const result = await verifyExecutionReceipt({ ...receipt, schema: "wrong" as "clas.execution.receipt.v1" }, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /schema/);
});

test("changed clas invalidates receipt", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  const result = await verifyExecutionReceipt({ ...receipt, clas: "2.0" as "1.0" }, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /clas/);
});

test("unsupported proof canonicalization invalid", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt.proofs[0].canonicalization = "json.unsorted.v1" as "json.sorted_keys.v1";
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.proofs[0].errors.join(" "), /canonicalization/);
});

test("unsupported signature algorithm invalid", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt.proofs[0].signature.alg = "ECDSA" as "Ed25519";
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.match(result.proofs[0].errors.join(" "), /algorithm/);
});

test("malformed public key returns normalized proof error", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: "not a pem", requireSignerBinding: false });
  assert.equal(result.ok, false);
  assert.equal(result.proofs[0].signature_valid, false);
  assert.match(result.proofs[0].errors.join(" "), /verification failed|invalid/i);
});

test("settlement tx_hash raw transaction hash rejected", () => {
  assert.throws(() => createExecutionReceipt({ receiptId: "r", verb: "approve", agent: { id: "a" }, action: {}, settlement: { tx_hash: `0x${"a".repeat(64)}` } }), /raw 0x transaction hash/);
});

test("nested settlement raw transaction hash rejected", () => {
  assert.throws(() => createExecutionReceipt({ receiptId: "r", verb: "approve", agent: { id: "a" }, action: {}, settlement: { details: { tx_hash: `0x${"a".repeat(64)}` } } }), /raw 0x transaction hash/);
});

test("opaque payment_ref remains valid", () => {
  const receipt = createExecutionReceipt({ receiptId: "r", verb: "approve", agent: { id: "a" }, action: {}, settlement: { payment_ref: "rail:opaque:settlement_456" } });
  assert.equal(receipt.settlement?.payment_ref, "rail:opaque:settlement_456");
});

test("edited proof.signer is not fully trusted with generic public key", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt.proofs[0].signer = "did:attacker:1";
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: agent.publicKeyPem });
  assert.equal(result.ok, false);
  assert.equal(result.proofs[0].signature_valid, true);
  assert.equal(result.proofs[0].signer_identity_verified, false);
});

test("caller can inspect unbound signature validity when opting out of signer binding", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt.proofs[0].signer = "did:attacker:1";
  const result = await verifyExecutionReceipt(receipt, { publicKeyPem: agent.publicKeyPem, requireSignerBinding: false });
  assert.equal(result.ok, true);
  assert.equal(result.proofs[0].signature_valid, true);
  assert.equal(result.proofs[0].signer_identity_verified, false);
});

test("signer identity binding must match explicit bound key signer", async () => {
  const agent = await keys();
  const receipt = await signExecutionProof(baseReceipt(), { signer: "did:agent:1", kid: "agent-key", privateKeyPem: agent.privateKeyPem });
  receipt.proofs[0].signer = "did:attacker:1";
  const result = await verifyExecutionReceipt(receipt, { publicKeysByKid: { "agent-key": { publicKeyPemOrDer: agent.publicKeyPem, signer: "did:agent:1" } } });
  assert.equal(result.ok, false);
  assert.equal(result.proofs[0].signature_valid, true);
  assert.match(result.proofs[0].errors.join(" "), /does not match bound key signer/);
});
