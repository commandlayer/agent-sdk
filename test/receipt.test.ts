import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

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
  const keyPair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return toPem(pkcs8);
}

test("generated receipt has required fields and hash", async () => {
  const cl = new CommandLayer({
    signer: "runtime.commandlayer.eth",
    keyId: "vC4WbcNoq2znSCiQ",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const receipt = await cl.wrap("agent.execute", {
    input: { task: "summarize", content: "hello world" },
    run: async () => ({ summary: "hello" }),
  });

  assert.equal(receipt.signer, "runtime.commandlayer.eth");
  assert.equal(receipt.verb, "agent.execute");
  assert.ok(receipt.ts);
  assert.ok(receipt.metadata.proof.hash_sha256.length > 0);
  assert.equal(receipt.signature.alg, "ed25519");
  assert.match(receipt.signature.sig, /^[A-Za-z0-9+/=]+$/);
});

test("canonical payload excludes metadata and signature", async () => {
  const cl = new CommandLayer({
    signer: "runtime.commandlayer.eth",
    keyId: "kid123",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const receipt = await cl.wrap("agent.execute", {
    input: { x: 1 },
    run: async () => ({ y: 2 }),
  });

  const canonicalPayload = canonicalPayloadFromReceiptInput(receipt);
  assert.equal("metadata" in canonicalPayload, false);
  assert.equal("signature" in canonicalPayload, false);

  const canonical = canonicalize(canonicalPayload);
  const recomputedHash = await sha256Hex(canonical);
  assert.equal(recomputedHash, receipt.metadata.proof.hash_sha256);

  const tamperedPayload = { ...canonicalPayload, output: { y: 3 } };
  const tamperedHash = await sha256Hex(canonicalize(tamperedPayload));
  assert.notEqual(tamperedHash, receipt.metadata.proof.hash_sha256);
});
