import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

const DEFAULT_VERIFIER_URL = "https://www.commandlayer.org/api/verify";

export interface CommandLayerConfig {
  signer?: string;
  agent?: string;
  keyId: string;
  canonicalization?: string;
  privateKeyPem?: string;
  privateKey?: string;
  verifierUrl?: string;
}

export interface WrapResult<TOutput> {
  output: TOutput;
  receipt: Receipt;
}

export class CommandLayer {
  private readonly signer: string;
  private readonly privateKeyPem?: string;
  private readonly canonicalization: string;
  private readonly verifierUrl: string;

  constructor(private readonly config: CommandLayerConfig) {
    this.signer = config.signer ?? config.agent ?? "";
    this.privateKeyPem = config.privateKeyPem ?? config.privateKey;
    this.canonicalization = config.canonicalization ?? "json.sorted_keys.v1";
    this.verifierUrl = config.verifierUrl ?? DEFAULT_VERIFIER_URL;

    if (!this.signer) {
      throw new Error("CommandLayer signer (or agent) is required");
    }
  }

  async wrap<TOutput extends JsonValue>(verb: string, run: () => Promise<TOutput>): Promise<WrapResult<TOutput>>;
  async wrap<TOutput extends JsonValue>(
    verb: string,
    params: { input: JsonValue; run: () => Promise<TOutput> },
  ): Promise<WrapResult<TOutput>>;
  async wrap<TOutput extends JsonValue>(
    verb: string,
    paramsOrRun: { input: JsonValue; run: () => Promise<TOutput> } | (() => Promise<TOutput>),
  ): Promise<WrapResult<TOutput>> {
    if (!this.privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem (or privateKey) is required for signing");
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const params =
      typeof paramsOrRun === "function"
        ? ({ input: null, run: paramsOrRun } as const)
        : paramsOrRun;

    try {
      const output = await params.run();
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.privateKeyPem,
        canonicalization: this.canonicalization,
        input: {
          signer: this.signer,
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output,
          execution: { status: "ok", duration_ms: duration, started_at: startedAt, completed_at: completedAt },
        },
      });

      return { output, receipt };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.privateKeyPem,
        canonicalization: this.canonicalization,
        input: {
          signer: this.signer,
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output: { ok: false, error: "agent_error" },
          execution: {
            status: "error",
            duration_ms: Date.now() - startedMs,
            started_at: startedAt,
            completed_at: completedAt,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      });

      return { output: undefined as unknown as TOutput, receipt };
    }
  }

  async verify(receipt: Receipt): Promise<unknown> {
    const response = await fetch(this.verifierUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(receipt),
    });

    if (!response.ok) {
      throw new Error(`Verification request failed: ${response.status}`);
    }

    return response.json();
  }
}
