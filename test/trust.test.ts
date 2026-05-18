import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

import {
  assertValidTrustReceipt,
  assertValidTrustRequest,
  createReceipt,
  validateTrustReceipt,
  validateTrustRequest,
} from "../src/index.js";

function toPem(pkcs8: ArrayBuffer): string {
  const b64 = Buffer.from(pkcs8).toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

async function generatePrivateKeyPem(): Promise<string> {
  const keyPair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return toPem(pkcs8);
}

function makeValidTrustRequest() {
  const now = new Date().toISOString();
  return {
    version: "1.0.0",
    family: "trust-verification",
    signer: "verifyagent.eth",
    verb: "verify",
    ts: now,
    input: { challenge: "abc" },
    output: { approved: true },
    execution: {
      status: "ok" as const,
      duration_ms: 12,
      started_at: now,
      completed_at: now,
    },
  } as const;
}

test("valid request passes", () => {
  const result = validateTrustRequest(makeValidTrustRequest());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("valid receipt passes", async () => {
  const receipt = await createReceipt({
    keyId: "kid-1",
    privateKeyPem: await generatePrivateKeyPem(),
    canonicalization: "json.sorted_keys.v1",
    input: makeValidTrustRequest(),
  });

  const result = validateTrustReceipt(receipt);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("invalid request fails", () => {
  const request = { ...makeValidTrustRequest(), verb: "summarize" };
  const result = validateTrustRequest(request);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("invalid receipt fails", async () => {
  const receipt = await createReceipt({
    keyId: "kid-1",
    privateKeyPem: await generatePrivateKeyPem(),
    canonicalization: "json.sorted_keys.v1",
    input: makeValidTrustRequest(),
  });

  const result = validateTrustReceipt({ ...receipt, metadata: { ...receipt.metadata, proof: { ...receipt.metadata.proof, signature: { ...receipt.metadata.proof.signature, alg: "RSA" } } } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test("assert variants throw", async () => {
  assert.throws(() => assertValidTrustRequest({ ...makeValidTrustRequest(), verb: "summarize" }), /Invalid CLAS Trust Verification v1 request/);

  const receipt = await createReceipt({
    keyId: "kid-1",
    privateKeyPem: await generatePrivateKeyPem(),
    canonicalization: "json.sorted_keys.v1",
    input: makeValidTrustRequest(),
  });

  assert.throws(
    () => assertValidTrustReceipt({ ...receipt, metadata: { ...receipt.metadata, proof: { ...receipt.metadata.proof, signature: { alg: "Ed25519", value: "nope", kid: "kid-1" } } } }),
    /Invalid CLAS Trust Verification v1 receipt/,
  );
});

test("invalid date-time fails", () => {
  const request = { ...makeValidTrustRequest(), ts: "not-a-date" };
  const result = validateTrustRequest(request);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes("/ts")));
});

test("request additionalProperties are rejected", () => {
  const request = { ...makeValidTrustRequest(), unexpected: true };
  const result = validateTrustRequest(request);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes("must NOT have additional properties")));
});

test("missing receipt proof fields fails", async () => {
  const receipt = await createReceipt({
    keyId: "kid-1",
    privateKeyPem: await generatePrivateKeyPem(),
    canonicalization: "json.sorted_keys.v1",
    input: makeValidTrustRequest(),
  });

  const invalid = {
    ...receipt,
    metadata: {
      proof: { canonicalization: receipt.metadata.proof.canonicalization },
    },
  };

  const result = validateTrustReceipt(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes("/metadata/proof")));
});

test("invalid canonicalization value fails", async () => {
  const receipt = await createReceipt({
    keyId: "kid-1",
    privateKeyPem: await generatePrivateKeyPem(),
    canonicalization: "json.sorted_keys.v1",
    input: makeValidTrustRequest(),
  });

  const result = validateTrustReceipt({
    ...receipt,
    metadata: {
      ...receipt.metadata,
      proof: { ...receipt.metadata.proof, canonicalization: "json.unsorted.v1" },
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((err) => err.includes("/metadata/proof/canonical")));
});
