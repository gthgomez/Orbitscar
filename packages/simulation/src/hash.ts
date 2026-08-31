import { sha256 } from "@noble/hashes/sha2.js";

type CanonicalObject = { [key: string]: CanonicalValue };
type CanonicalValue = null | boolean | number | string | CanonicalValue[] | CanonicalObject;

function normalize(value: unknown): CanonicalValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical serialization rejects non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const output: CanonicalObject = {};
    for (const key of Object.keys(value).sort()) output[key] = normalize((value as Record<string, unknown>)[key]);
    return output;
  }
  throw new Error("canonical serialization rejects unsupported values");
}

export function canonicalSerialize(value: unknown): string { return JSON.stringify(normalize(value)); }

export function fastStateHash(value: unknown): string {
  const text = canonicalSerialize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function hex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
export function sha256Hex(text: string): string { return hex(sha256(new TextEncoder().encode(text))); }
export function authoritativeDigest(value: unknown): string { return sha256Hex(canonicalSerialize(value)); }
