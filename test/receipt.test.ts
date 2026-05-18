import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verifyCommandLayerReceipt } from "@commandlayer/runtime-core";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CommandLayer } from "../src/index.js";
import { validateTrustReceipt } from "../src/index.js";

function toPem(pkcs8: ArrayBuffer): string {
  const b64 = Buffer.from(pkcs8).toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

async function generateKeyPair(): Promise<{ pem: string; publicKey: CryptoKey }> {
  const keyPair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return { pem: toPem(pkcs8), publicKey: keyPair.publicKey };
}

async function generatePrivateKeyPem(): Promise<string> {
  return (await generateKeyPair()).pem;
}

test("wrapping an action creates a receipt with required fields", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("verify", {
    input: { content: "hello world" },
    run: async () => "hello world",
  });

  assert.equal(result.output, "hello world");
  assert.equal(result.receipt.version, "1.0.0");
  assert.equal(result.receipt.family, "trust-verification");
  assert.equal(result.receipt.verb, "verify");
  assert.equal(result.receipt.proof.canonicalization, "json.sorted_keys.v1");
  assert.equal(result.receipt.proof.hash.alg, "SHA-256");
  assert.equal(result.receipt.proof.signature.alg, "Ed25519");
  assert.ok(result.receipt.proof.signature.value.length > 0);
  assert.equal(result.receipt.proof.signature.kid, "vC4WbcNoq2znSCiQ");
  assert.equal((result.receipt as Record<string, unknown>).signature_b64, undefined);
  assert.ok(result.receipt.execution.started_at);
  assert.ok(result.receipt.execution.completed_at);
});

test("wrap produces a schema-valid receipt (round-trip)", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("verify", {
    input: { content: "hello world" },
    run: async () => ({ approved: true }),
  });

  const validation = validateTrustReceipt(result.receipt);
  assert.equal(validation.ok, true, `Receipt failed schema validation: ${validation.errors.join("; ")}`);
});

test("wrap rejects an unrecognized verb before running the wrapped function", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  await assert.rejects(
    () => cl.wrap("summarize", async () => "should not run"),
    /Invalid trust verb/,
  );
});

test("emitted receipt verifies with runtime-core and tampering is invalid", async () => {
  const { pem, publicKey } = await generateKeyPair();

  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: pem,
  });

  const { receipt } = await cl.wrap("authenticate", {
    input: { x: 1 },
    run: async () => ({ y: 2 }),
  });

  const verification = await verifyCommandLayerReceipt({ receipt });
  assert.equal(verification.status, "VALID");

  const tampered = { ...receipt, output: { y: 99 } };
  const tamperedVerification = await verifyCommandLayerReceipt({ receipt: tampered });
  assert.equal(tamperedVerification.status, "INVALID");
});

test("wrap returns signed error receipt when wrapped agent throws", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("authenticate", {
    input: { content: "hello" },
    run: async () => {
      throw new Error("simulated failure");
    },
  });

  assert.equal(result.receipt.execution.status, "error");
  assert.match(result.receipt.execution.error ?? "", /simulated failure/);
  assert.ok(result.receipt.proof.signature.value);
  assert.equal(result.receipt.proof.signature.alg, "Ed25519");
});

test("error receipt is also schema-valid", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("authenticate", {
    input: { content: "hello" },
    run: async () => {
      throw new Error("simulated failure");
    },
  });

  const validation = validateTrustReceipt(result.receipt);
  assert.equal(validation.ok, true, `Error receipt failed schema validation: ${validation.errors.join("; ")}`);
});

test("fully-qualified trust capability verb normalizes to short verb", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const { receipt } = await cl.wrap("clas.trust-verification.verify", {
    input: { content: "hello world" },
    run: async () => "hello world",
  });

  assert.equal(receipt.verb, "verify");
});

test("verification helper posts to verifierUrl", async () => {
  let requestBody = "";
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.on("data", (chunk: Buffer) => {
      requestBody += chunk;
    });
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const verifierUrl = `http://127.0.0.1:${address.port}/api/verify`;

  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
    verifierUrl,
  });

  const { receipt } = await cl.wrap("verify", {
    input: { content: "hello" },
    run: async () => "hello",
  });

  const verification = await cl.verify(receipt);
  assert.deepEqual(verification, { ok: true });
  assert.deepEqual(JSON.parse(requestBody), { receipt });

  server.close();
});
