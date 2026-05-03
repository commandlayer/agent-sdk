import { CommandLayer } from "../src/index.js";

const cl = new CommandLayer({
  agent: process.env.CL_AGENT ?? "runtime.commandlayer.eth",
  privateKey: process.env.CL_PRIVATE_KEY_PEM,
  keyId: process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ",
});

const result = await cl.wrap("summarize", async () => {
  return "hello world";
});

console.log(result.output);
console.log(result.receipt);

const verified = await cl.verify(result.receipt);
console.log(verified);
