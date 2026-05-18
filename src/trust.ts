import { createRequire } from "node:module";
import { type ErrorObject } from "ajv";
import * as Ajv2020Module from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";

export interface TrustValidationResult {
  ok: boolean;
  errors: string[];
}

type Ajv2020Instance = InstanceType<typeof Ajv2020Ctor>;
type AddFormats = (ajv: Ajv2020Instance) => Ajv2020Instance;

const Ajv2020Ctor = (Ajv2020Module as unknown as { default?: typeof import("ajv/dist/2020.js").default }).default
  ?? (Ajv2020Module as unknown as typeof import("ajv/dist/2020.js").default);

const addFormats = (addFormatsModule as unknown as { default?: AddFormats }).default
  ?? (addFormatsModule as unknown as AddFormats);

const _require = createRequire(import.meta.url);
const trustRequestSchema = _require("./schemas.trust-request-v1.json") as Record<string, unknown>;
const trustReceiptSchema = _require("./schemas.trust-receipt-v1.json") as Record<string, unknown>;

const ajv = new Ajv2020Ctor({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(trustRequestSchema, "trust-request-v1");

const validateTrustRequestSchema = ajv.compile(trustRequestSchema);
const validateTrustReceiptSchema = ajv.compile(trustReceiptSchema);

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error: ErrorObject) => {
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
