import "dotenv/config";
import { CommandLayer } from "../src/index.js";

if (!process.env.CL_PRIVATE_KEY_PEM) {
  console.error("Missing CL_PRIVATE_KEY_PEM. Copy .env.example to .env and add a PKCS8 Ed25519 private key.");
  process.exit(1);
}

const cl = new CommandLayer({
  agent: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
});

const result = await cl.wrap("summarize", async () => {
  return "hello world";
});

process.stdout.write(`${JSON.stringify(result.output)}\n`);
process.stdout.write(`${JSON.stringify(result.receipt, null, 2)}\n`);

const verified = await cl.verify(result.receipt);
process.stdout.write(`${JSON.stringify(verified)}\n`);
