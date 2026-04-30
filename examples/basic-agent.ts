import "dotenv/config";
import { CommandLayer } from "../src/index.js";

async function fakeSummarizeAgent(content: string) {
  return { summary: `Summary: ${content.slice(0, 24)}` };
}

if (!process.env.CL_PRIVATE_KEY_PEM) {
  console.error("Missing CL_PRIVATE_KEY_PEM. Copy .env.example to .env and add a PKCS8 Ed25519 private key.");
  process.exit(1);
}

const cl = new CommandLayer({
  agent: process.env.CL_RECEIPT_SIGNER ?? "runtime.commandlayer.eth",
  keyId: process.env.CL_KEY_ID ?? "v1",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  verifierUrl: "https://www.commandlayer.org/api/verify",
});

const result = await cl.wrap("summarize", async () => fakeSummarizeAgent("hello world"));

console.log("output", result.output);
console.log("receipt", JSON.stringify(result.receipt, null, 2));

const verified = await cl.verify(result.receipt);
console.log("verified", verified);
