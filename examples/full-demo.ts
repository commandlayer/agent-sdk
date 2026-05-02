import { CommandLayer } from "../src/index.js";

const privateKeyPem = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ";
const agent = process.env.CL_AGENT ?? "runtime.commandlayer.eth";

if (!privateKeyPem) {
  console.error("Missing CL_PRIVATE_KEY_PEM. Please set a PKCS8 Ed25519 private key in CL_PRIVATE_KEY_PEM.");
  process.exit(1);
}

const cl = new CommandLayer({ agent, keyId, privateKeyPem });

const result = await cl.wrap("summarize", async () => {
  return { summary: "hello world" };
});

console.log("Agent output");
console.log(JSON.stringify(result.output, null, 2));
console.log("");

console.log("Signed receipt");
console.log(JSON.stringify(result.receipt, null, 2));
console.log("receipt.signer:", result.receipt.signer);
console.log("receipt.verb:", result.receipt.verb);
console.log(
  "receipt.metadata.proof.hash_sha256:",
  result.receipt.metadata.proof.hash_sha256,
);
console.log("receipt.signature.kid:", result.receipt.signature.kid);
console.log("");

const statusOf = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "UNKNOWN";
  }

  const withStatus = value as { status?: unknown };
  return typeof withStatus.status === "string" ? withStatus.status.toUpperCase() : "UNKNOWN";
};

const verified = await cl.verify(result.receipt);
const verifiedStatus = statusOf(verified);
console.log(`Original receipt verification: ${verifiedStatus === "VERIFIED" ? "VERIFIED" : verifiedStatus}`);

const tamperedReceipt = structuredClone(result.receipt);

if (!tamperedReceipt.output || typeof tamperedReceipt.output !== "object" || Array.isArray(tamperedReceipt.output)) {
  throw new Error("Unexpected receipt output shape. Expected an object output for tamper demo.");
}

(tamperedReceipt.output as { summary?: string }).summary = "hello world!!!";

const tampered = await cl.verify(tamperedReceipt);
const tamperedStatus = statusOf(tampered);
console.log(`Tampered receipt verification: ${tamperedStatus === "INVALID" ? "INVALID" : tamperedStatus}`);

console.log("\nAgents don’t make claims — they produce proof.");
