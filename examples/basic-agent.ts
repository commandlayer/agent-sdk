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
  agent: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  verifierUrl: process.env.CL_VERIFIER_URL ?? "https://www.commandlayer.org/api/verify",
});

const result = await cl.wrap("summarize", async () => fakeSummarizeAgent("hello world"));

process.stdout.write(`output: ${JSON.stringify(result.output)}\n`);
process.stdout.write(`receipt: ${JSON.stringify(result.receipt, null, 2)}\n`);

const verified = await cl.verify(result.receipt);
process.stdout.write(`verified: ${JSON.stringify(verified)}\n`);
