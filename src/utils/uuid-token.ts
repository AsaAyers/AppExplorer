import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

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

const derivedUuidTokenKeys = new Map<string, Buffer>();

const getUuidTokenKey = (secretKey: SessionSecretInput = getSessionKey()) => {
  const normalizedKey = normalizeSessionKey(secretKey);
  const cacheKey = Buffer.from(normalizedKey).toString("hex");
  const existingKey = derivedUuidTokenKeys.get(cacheKey);
  if (existingKey) {
    return existingKey;
  }

  const derivedKey = createHash("sha256")
    .update(normalizedKey)
    .update(UUID_TOKEN_CONTEXT)
    .digest()
    .subarray(0, AES_KEY_BYTES);
  derivedUuidTokenKeys.set(cacheKey, derivedKey);
  return derivedKey;
};

const parseUuid = (uuid: string) => {
  invariant(UUID_REGEX.test(uuid), `Invalid UUID: ${uuid}`);
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
};

const formatUuid = (uuidBytes: Buffer) => {
  invariant(
    uuidBytes.length === UUID_BYTES,
    `Expected ${UUID_BYTES} UUID bytes, got ${uuidBytes.length}`,
  );

  const hex = uuidBytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const encryptUuidToken = (
  uuid: string,
  secretKey: SessionSecretInput = getSessionKey(),
) => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getUuidTokenKey(secretKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(parseUuid(uuid)),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, ciphertext, authTag]).toString("base64url");
};

export const decryptUuidToken = (
  token: string,
  secretKey: SessionSecretInput = getSessionKey(),
) => {
  const tokenBytes = Buffer.from(token, "base64url");
  invariant(
    tokenBytes.length === TOKEN_BYTES,
    `Invalid UUID token length: ${tokenBytes.length}`,
  );

  const iv = tokenBytes.subarray(0, IV_BYTES);
  const ciphertext = tokenBytes.subarray(IV_BYTES, IV_BYTES + UUID_BYTES);
  const authTag = tokenBytes.subarray(IV_BYTES + UUID_BYTES);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getUuidTokenKey(secretKey),
    iv,
  );
  decipher.setAuthTag(authTag);

  return formatUuid(
    Buffer.concat([decipher.update(ciphertext), decipher.final()]),
  );
};
