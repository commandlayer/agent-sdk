import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

export interface CommandLayerConfig {
  signer: string;
  keyId: string;
  canonicalization: string;
  privateKeyPem?: string;
  verifierUrl?: string;
}

export const DEFAULT_VERIFIER_URL = "https://www.commandlayer.org/api/verify";

export interface WrapParams<TOutput> {
  input: unknown;
  run: () => Promise<TOutput>;
}

export interface WrapResult<TOutput> {
  output: TOutput;
  receipt: Receipt;
}

export class CommandLayer {
  private readonly config: CommandLayerConfig;

  constructor(config: CommandLayerConfig) {
    this.config = {
      ...config,
      verifierUrl: config.verifierUrl ?? DEFAULT_VERIFIER_URL,
    };
  }

  async wrap<TOutput extends JsonValue>(
    verb: string,
    params: { input: JsonValue; run: () => Promise<TOutput> },
  ): Promise<WrapResult<TOutput>> {
    if (!this.config.privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    try {
      const output = await params.run();
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer: this.config.signer,
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
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization,
        input: {
          signer: this.config.signer,
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
    const response = await fetch(this.config.verifierUrl!, {
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
