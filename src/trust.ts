import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export interface TrustValidationResult {
  ok: boolean;
  errors: string[];
}

const here = dirname(fileURLToPath(import.meta.url));

function loadSchemaFile(name: string): unknown {
  const sourcePath = join(here, `${name}.json`);
  const raw = readFileSync(sourcePath, "utf8");
  return JSON.parse(raw);
}

const trustRequestSchema = loadSchemaFile("schemas.trust-request-v1");
const trustReceiptSchema = loadSchemaFile("schemas.trust-receipt-v1") as Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(trustRequestSchema, "trust-request-v1");

const validateTrustRequestSchema = ajv.compile(trustRequestSchema);
const validateTrustReceiptSchema = ajv.compile(trustReceiptSchema);

function formatErrors(errors: typeof validateTrustRequestSchema.errors): string[] {
  return (errors ?? []).map((error: { instancePath?: string; message?: string }) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "is invalid"}`;
  });
}

export function validateTrustRequest(value: unknown): TrustValidationResult {
  const ok = validateTrustRequestSchema(value);
  return { ok, errors: ok ? [] : formatErrors(validateTrustRequestSchema.errors) };
}

export function validateTrustReceipt(value: unknown): TrustValidationResult {
  const ok = validateTrustReceiptSchema(value);
  return { ok, errors: ok ? [] : formatErrors(validateTrustReceiptSchema.errors) };
}

export function assertValidTrustRequest(value: unknown): void {
  const result = validateTrustRequest(value);
  if (!result.ok) {
    throw new Error(`Invalid CLAS Trust Verification v1 request: ${result.errors.join("; ")}`);
  }
}

export function assertValidTrustReceipt(value: unknown): void {
  const result = validateTrustReceipt(value);
  if (!result.ok) {
    throw new Error(`Invalid CLAS Trust Verification v1 receipt: ${result.errors.join("; ")}`);
  }
}
