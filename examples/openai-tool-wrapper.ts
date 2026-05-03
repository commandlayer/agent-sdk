import { CommandLayer } from "../src/index.js";

const privateKey = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ";
const agent = process.env.CL_AGENT ?? "runtime.commandlayer.eth";

if (!privateKey) {
  throw new Error("Missing required env var: CL_PRIVATE_KEY_PEM.");
}

const cl = new CommandLayer({ agent, keyId, privateKey });

const toolCall = {
  tool_name: "get_weather",
  arguments: { city: "Jacksonville" },
};

const result = await cl.wrap("tool.get_weather", {
  input: toolCall,
  run: async () => ({
    city: toolCall.arguments.city,
    forecast: "sunny",
  }),
});

console.log("tool_call", toolCall);
console.log("output", result.output);
console.log("receipt", JSON.stringify(result.receipt, null, 2));

const verification = await cl.verify(result.receipt);
console.log("verification_status", verification);
