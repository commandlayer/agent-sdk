import "dotenv/config";
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

process.stdout.write("Agent output\n");
process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n\n`);

process.stdout.write("Signed receipt\n");
process.stdout.write(`${JSON.stringify(result.receipt, null, 2)}\n`);
process.stdout.write(`receipt.signer: ${result.receipt.signer}\n`);
process.stdout.write(`receipt.verb: ${result.receipt.verb}\n`);
process.stdout.write(`receipt.metadata.proof.signature.kid: ${result.receipt.metadata.proof.signature.kid}\n`);
process.stdout.write(`receipt.signer: ${result.receipt.signer}\n\n`);

const statusOf = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "UNKNOWN";
  }

  const withStatus = value as { status?: unknown };
  return typeof withStatus.status === "string" ? withStatus.status.toUpperCase() : "UNKNOWN";
};

const verified = await cl.verify(result.receipt);
const verifiedStatus = statusOf(verified);
process.stdout.write(`Original receipt verification: ${verifiedStatus === "VERIFIED" ? "VERIFIED" : verifiedStatus}\n`);

const tamperedReceipt = structuredClone(result.receipt);

if (!tamperedReceipt.output || typeof tamperedReceipt.output !== "object" || Array.isArray(tamperedReceipt.output)) {
  throw new Error("Unexpected receipt output shape. Expected an object output for tamper demo.");
}

(tamperedReceipt.output as { summary?: string }).summary = "hello world!!!";

const tampered = await cl.verify(tamperedReceipt);
const tamperedStatus = statusOf(tampered);
process.stdout.write(`Tampered receipt verification: ${tamperedStatus === "INVALID" ? "INVALID" : tamperedStatus}\n`);

process.stdout.write("\nAgents don't make claims — they produce proof.\n");
