import { CommandLayer } from "../src/index.js";

const cl = new CommandLayer({
  signer: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKeyPem: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
  canonicalization: "json.sorted_keys.v1",
  verifierUrl: "https://www.commandlayer.org/api/verify",
});

const result = await cl.wrap("summarize", async () => {
  return "hello world";
});

console.log(result.output);
console.log(result.receipt);

const verified = await cl.verify(result.receipt);
console.log(verified);
