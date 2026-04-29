import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bytes = Buffer.from(clean, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const bytes = Buffer.from(value, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(digest).toString("hex");
}

export async function importEd25519PrivateKeyFromPem(pem: string): Promise<CryptoKey> {
  const pkcs8 = pemToArrayBuffer(pem);
  return subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
}

export async function signEd25519Base64(privateKey: CryptoKey, message: string): Promise<string> {
  const signature = await subtle.sign("Ed25519", privateKey, new TextEncoder().encode(message));
  return Buffer.from(signature).toString("base64");
}

export async function verifyEd25519Base64(
  publicKey: CryptoKey,
  message: string,
  signatureB64: string,
): Promise<boolean> {
  return subtle.verify("Ed25519", publicKey, base64ToArrayBuffer(signatureB64), new TextEncoder().encode(message));
}
