import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CommandLayer } from "../src/index.js";
import { canonicalize } from "../src/canonicalize.js";
import { canonicalPayloadFromReceiptInput } from "../src/receipt.js";

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
  assert.equal(result.receipt.proof.alg, "ed25519");
  assert.ok(result.receipt.proof.signature.length > 0);
  assert.equal(result.receipt.proof.kid, "vC4WbcNoq2znSCiQ");
  assert.equal(result.receipt.proof.signer_id, "verifyagent.eth");
  assert.ok(result.receipt.execution.started_at);
  assert.ok(result.receipt.execution.completed_at);
});

test("signature is verifiable over raw canonical payload bytes", async () => {
  const { pem, publicKey } = await generateKeyPair();

  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: pem,
  });

  const { receipt } = await cl.wrap("summarize", {
    input: { x: 1 },
    run: async () => ({ y: 2 }),
  });

  const canonicalPayload = canonicalPayloadFromReceiptInput(receipt);
  assert.equal("proof" in canonicalPayload, false, "proof must not be in canonical payload");

  const canonical = canonicalize(canonicalPayload);
  const sig = Buffer.from(receipt.proof.signature, "base64");

  const ok = await webcrypto.subtle.verify(
    "Ed25519",
    publicKey,
    sig,
    new TextEncoder().encode(canonical),
  );
  assert.equal(ok, true, "signature must verify over raw canonical payload bytes");

  const tamperedPayload = { ...canonicalPayload, output: { y: 99 } };
  const tamperedOk = await webcrypto.subtle.verify(
    "Ed25519",
    publicKey,
    sig,
    new TextEncoder().encode(canonicalize(tamperedPayload)),
  );
  assert.equal(tamperedOk, false, "tampered payload must not verify");
});

test("wrap returns signed error receipt when wrapped agent throws", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("summarize", {
    input: { content: "hello" },
    run: async () => {
      throw new Error("simulated failure");
    },
  });

  assert.equal(result.receipt.execution.status, "error");
  assert.match(result.receipt.execution.error ?? "", /simulated failure/);
  assert.ok(result.receipt.proof.signature);
  assert.equal(result.receipt.proof.alg, "ed25519");
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

  const { receipt } = await cl.wrap("summarize", {
    input: { content: "hello" },
    run: async () => "hello",
  });

  const verification = await cl.verify(receipt);
  assert.deepEqual(verification, { ok: true });
  assert.deepEqual(JSON.parse(requestBody), { receipt });

  server.close();
});
