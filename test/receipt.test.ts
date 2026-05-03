import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CommandLayer } from "../src/index.js";
import { canonicalize } from "../src/canonicalize.js";
import { canonicalPayloadFromReceiptInput } from "../src/receipt.js";
import { sha256Hex } from "../src/crypto.js";

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

test("wrapping an action creates a receipt with required fields", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    canonicalization: "json.sorted_keys." + "v" + "1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("summarize", {
    input: { content: "hello world" },
    run: async () => "hello world",
  });

  assert.equal(result.output, "hello world");
  assert.equal(result.receipt.verb, "summarize");
  assert.ok(result.receipt.metadata.proof.hash_sha256.length > 0);
  assert.ok(result.receipt.signature.sig.length > 0);
  assert.ok(result.receipt.execution.started_at);
  assert.ok(result.receipt.execution.completed_at);
});

test("canonical payload excludes metadata and signature", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    canonicalization: "json.sorted_keys." + "v" + "1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const { receipt } = await cl.wrap("summarize", {
    input: { x: 1 },
    run: async () => ({ y: 2 }),
  });

  const canonicalPayload = canonicalPayloadFromReceiptInput(receipt);
  assert.equal("metadata" in canonicalPayload, false);
  assert.equal("signature" in canonicalPayload, false);

  const recomputedHash = await sha256Hex(canonicalize(canonicalPayload));
  assert.equal(recomputedHash, receipt.metadata.proof.hash_sha256);

  const tamperedPayload = { ...canonicalPayload, output: { y: 99 } };
  const tamperedHash = await sha256Hex(canonicalize(tamperedPayload));
  assert.notEqual(tamperedHash, receipt.metadata.proof.hash_sha256);
});


test("wrap returns signed error receipt when wrapped agent throws", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    canonicalization: "json.sorted_keys." + "v" + "1",
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
  assert.ok(result.receipt.metadata.proof.hash_sha256);
  assert.ok(result.receipt.signature.sig);
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
    canonicalization: "json.sorted_keys." + "v" + "1",
    privateKeyPem: await generatePrivateKeyPem(),
    verifierUrl,
  });

  const { receipt } = await cl.wrap("summarize", {
    input: { content: "hello" },
    run: async () => "hello",
  });

  const verification = await cl.verify(receipt);
  assert.deepEqual(verification, { ok: true });
  assert.deepEqual(JSON.parse(requestBody), receipt);

  server.close();
});
