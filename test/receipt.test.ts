import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CommandLayer, DEFAULT_VERIFIER_URL } from "../src/index.js";
import { canonicalize } from "../src/canonicalize.js";
import { canonicalPayloadFromReceiptInput } from "../src/receipt.js";
import { sha256Hex } from "../src/crypto.js";

function toPem(pkcs8: ArrayBuffer): string {
  const b64 = Buffer.from(pkcs8).toString("base64");
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

async function generatePrivateKeyPem(): Promise<string> {
  const keyPair = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pkcs8 = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return toPem(pkcs8);
}

test("default verifierUrl is CommandLayer public verify endpoint", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  assert.equal((cl as unknown as { verifierUrl: string }).verifierUrl, "https://www.commandlayer.org/api/verify");
});

test("wrap() still returns output and receipt with expected fields", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const result = await cl.wrap("summarize", async () => ({ summary: "hello world" }));

  assert.deepEqual(result.output, { summary: "hello world" });
  assert.equal(result.receipt.signer, "verifyagent.eth");
  assert.equal(result.receipt.verb, "summarize");
  assert.deepEqual(result.receipt.input, {});
  assert.deepEqual(result.receipt.output, { summary: "hello world" });
  assert.ok(result.receipt.metadata.proof.hash_sha256.length > 0);
  assert.ok(result.receipt.signature.sig.length > 0);
  assert.ok(result.receipt.signature.kid.length > 0);
});

test("canonical payload excludes metadata and signature", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const { receipt } = await cl.wrap("summarize", async () => ({ y: 2 }));

  const canonicalPayload = canonicalPayloadFromReceiptInput(receipt);
  assert.equal("metadata" in canonicalPayload, false);
  assert.equal("signature" in canonicalPayload, false);

  const recomputedHash = await sha256Hex(canonicalize(canonicalPayload));
  assert.equal(recomputedHash, receipt.metadata.proof.hash_sha256);

  const tamperedPayload = { ...canonicalPayload, output: { y: 99 } };
  const tamperedHash = await sha256Hex(canonicalize(tamperedPayload));
  assert.notEqual(tamperedHash, receipt.metadata.proof.hash_sha256);
});

test("verify() POSTs receipt JSON directly to verifierUrl", async () => {
  let requestBody = "";
  let requestMethod = "";
  let requestContentType = "";
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    requestMethod = req.method ?? "";
    requestContentType = req.headers["content-type"] ?? "";

    req.on("data", (chunk: Buffer) => {
      requestBody += chunk;
    });
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok" }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const verifierUrl = `http://127.0.0.1:${address.port}/api/verify`;

  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    privateKeyPem: await generatePrivateKeyPem(),
    verifierUrl,
  });

  const { receipt } = await cl.wrap("summarize", async () => ({ summary: "hello" }));

  const verification = await cl.verify(receipt);
  assert.deepEqual(verification, { status: "ok" });
  assert.equal(requestMethod, "POST");
  assert.equal(requestContentType, "application/json");
  assert.deepEqual(JSON.parse(requestBody), receipt);
  server.close();
});

test("default verifierUrl is used when none is provided", async () => {
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
  });

  const fetchSpy = mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(url, DEFAULT_VERIFIER_URL);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await cl.verify({} as unknown as Parameters<CommandLayer["verify"]>[0]);
  assert.equal(fetchSpy.mock.callCount(), 1);
  fetchSpy.mock.restore();
});

test("custom verifierUrl overrides default", async () => {
  const customVerifierUrl = "https://example.com/custom/verify";
  const cl = new CommandLayer({
    signer: "verifyagent.eth",
    keyId: "v1",
    canonicalization: "json.sorted_keys.v1",
    privateKeyPem: await generatePrivateKeyPem(),
    verifierUrl: customVerifierUrl,
  });

  const fetchSpy = mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.equal(url, customVerifierUrl);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  await cl.verify({} as unknown as Parameters<CommandLayer["verify"]>[0]);
  assert.equal(fetchSpy.mock.callCount(), 1);
  fetchSpy.mock.restore();
});
