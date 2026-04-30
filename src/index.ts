import { createReceipt, type Receipt } from "./receipt.js";
import type { JsonValue } from "./canonicalize.js";

export { canonicalize } from "./canonicalize.js";
export { createReceipt, canonicalPayloadFromReceiptInput, type Receipt } from "./receipt.js";

export interface CommandLayerConfig {
  signer?: string;
  agent?: string;
  keyId: string;
  canonicalization?: string;
  privateKeyPem?: string;
  privateKey?: string;
  verifierUrl?: string;
}

export const DEFAULT_VERIFIER_URL = "https://www.commandlayer.org/api/verify";

export interface WrapResult<TOutput = unknown> {
  output: TOutput;
  receipt: Receipt;
}

export class CommandLayer {
  private readonly config: CommandLayerConfig;
  readonly verifierUrl: string;

  constructor(config: CommandLayerConfig) {
    this.config = {
      ...config,
      verifierUrl: config.verifierUrl ?? DEFAULT_VERIFIER_URL,
    };
    this.verifierUrl = this.config.verifierUrl!;
  }

  async wrap<TOutput>(
    verb: string,
    fnOrOptions: (() => Promise<TOutput>) | { input?: any; run: () => Promise<TOutput> },
  ): Promise<WrapResult<TOutput>> {
    if (!this.config.privateKeyPem) {
      throw new Error("CommandLayer privateKeyPem is required for signing");
    }

    const params = typeof fnOrOptions === "function" ? { input: null, run: fnOrOptions } : fnOrOptions;

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    try {
      const output = await params.run();
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization ?? "json.sorted_keys.v1",
        input: {
          signer: this.config.signer ?? this.config.agent ?? "unknown",
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output: output as unknown as JsonValue,
          execution: {
            status: "ok",
            duration_ms: durationMs,
            started_at: startedAt,
            completed_at: completedAt,
          },
        },
      });

      return { output, receipt };
    } catch (err) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;

      const receipt = await createReceipt({
        keyId: this.config.keyId,
        privateKeyPem: this.config.privateKeyPem,
        canonicalization: this.config.canonicalization ?? "json.sorted_keys.v1",
        input: {
          signer: this.config.signer ?? this.config.agent ?? "unknown",
          verb,
          ts: new Date().toISOString(),
          input: params.input,
          output: { ok: false, error: "agent_error" },
          execution: {
            status: "error",
            duration_ms: durationMs,
            started_at: startedAt,
            completed_at: completedAt,
            error: String(err),
          },
        },
      });

      return { output: undefined as unknown as TOutput, receipt };
    }
  }

  async verify(receipt: Receipt): Promise<unknown> {
    const response = await fetch(this.verifierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
    });

    if (!response.ok) {
      throw new Error(`Verification request failed: ${response.status}`);
    }

    return response.json();
  }
}
