import "dotenv/config";
import { CommandLayer } from "../src/index.js";

const privateKeyPem = process.env.CL_PRIVATE_KEY_PEM;
const keyId = process.env.CL_KEY_ID ?? "vC4WbcNoq2znSCiQ";
const agent = process.env.CL_AGENT ?? "runtime.commandlayer.eth";

if (!privateKeyPem) {
  throw new Error("Missing required env var: CL_PRIVATE_KEY_PEM.");
}

const cl = new CommandLayer({ agent, keyId, privateKeyPem });

const toolCall = {
  tool_name: "get_weather",
  arguments: { city: "Jacksonville" },
};

const result = await cl.wrap("tool.get_weather", async () => ({
  city: toolCall.arguments.city,
  forecast: "sunny",
}));

process.stdout.write(`tool_call: ${JSON.stringify(toolCall)}\n`);
process.stdout.write(`output: ${JSON.stringify(result.output)}\n`);
process.stdout.write(`receipt: ${JSON.stringify(result.receipt, null, 2)}\n`);

const verification = await cl.verify(result.receipt);
process.stdout.write(`verification_status: ${JSON.stringify(verification)}\n`);
