import invariant from "tiny-invariant";

import {
  getSessionKey,
  normalizeSessionKey,
  type SessionSecretInput,
} from "@/utils/keys";

const UUID_BYTES = 16;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const TOKEN_BYTES = IV_BYTES + UUID_BYTES + AUTH_TAG_BYTES;
const AES_KEY_BYTES = 32;
const UUID_TOKEN_CONTEXT = "app-explorer:uuid-token:v1";
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const derivedUuidTokenKeys = new Map<string, Promise<CryptoKey>>();

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const concatBytes = (...parts: Uint8Array[]) => {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
};

const toBase64Url = (bytes: Uint8Array) => {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return Uint8Array.from(atob(paddedBase64), (char) => char.charCodeAt(0));
};

const getUuidTokenKey = async (
  secretKey: SessionSecretInput = getSessionKey(),
) => {
  const normalizedKey = normalizeSessionKey(secretKey);
  const cacheKey = toHex(normalizedKey);
  const existingKey = derivedUuidTokenKeys.get(cacheKey);
  if (existingKey) {
    return existingKey;
  }

  const derivedKey = (async () => {
    const hash = await crypto.subtle.digest(
      "SHA-256",
      concatBytes(normalizedKey, new TextEncoder().encode(UUID_TOKEN_CONTEXT)),
    );

    return crypto.subtle.importKey(
      "raw",
      new Uint8Array(hash).subarray(0, AES_KEY_BYTES),
      {
        name: "AES-GCM",
      },
      false,
      ["encrypt", "decrypt"],
    );
  })();
  derivedUuidTokenKeys.set(cacheKey, derivedKey);
  return derivedKey;
};

const parseUuid = (uuid: string) => {
  invariant(UUID_REGEX.test(uuid), `Invalid UUID: ${uuid}`);
  return Uint8Array.from(
    uuid
      .replaceAll("-", "")
      .match(/.{2}/g)!
      .map((byte) => parseInt(byte, 16)),
  );
};

const formatUuid = (uuidBytes: Uint8Array) => {
  invariant(
    uuidBytes.length === UUID_BYTES,
    `Expected ${UUID_BYTES} UUID bytes, got ${uuidBytes.length}`,
  );

  const hex = toHex(uuidBytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const encryptUuidToken = async (
  uuid: string,
  secretKey: SessionSecretInput = getSessionKey(),
) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encryptedBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: AUTH_TAG_BYTES * 8,
      },
      await getUuidTokenKey(secretKey),
      parseUuid(uuid),
    ),
  );

  return toBase64Url(concatBytes(iv, encryptedBytes));
};

export const decryptUuidToken = async (
  token: string,
  secretKey: SessionSecretInput = getSessionKey(),
) => {
  const tokenBytes = fromBase64Url(token);
  invariant(
    tokenBytes.length === TOKEN_BYTES,
    `Invalid UUID token length: ${tokenBytes.length}`,
  );

  const iv = tokenBytes.subarray(0, IV_BYTES);
  const encryptedBytes = tokenBytes.subarray(IV_BYTES);

  return formatUuid(
    new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          tagLength: AUTH_TAG_BYTES * 8,
        },
        await getUuidTokenKey(secretKey),
        encryptedBytes,
      ),
    ),
  );
};
