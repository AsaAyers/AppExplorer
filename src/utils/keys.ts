import invariant from "tiny-invariant";

// A256CBC-HS512 requires a 512-bit (64-byte) key
const REQUIRED_KEY_BYTES = 64;

export type SessionSecretInput = string | Uint8Array<ArrayBufferLike>;

let rawSessionSecret: string | null = null;
export const getSessionSecretString = () => {
  rawSessionSecret ??= process.env.SESSION_SECRET ?? null;
  invariant(typeof rawSessionSecret === "string", "Missing SESSION_SECRET");
  return rawSessionSecret;
};

export const normalizeSessionKey = (secretKey: SessionSecretInput) => {
  if (typeof secretKey !== "string") {
    invariant(
      secretKey.length === REQUIRED_KEY_BYTES,
      `SESSION_SECRET must be ${REQUIRED_KEY_BYTES} bytes for A256CBC-HS512`,
    );
    return new Uint8Array(secretKey);
  }

  invariant(
    /^[0-9a-fA-F]+$/.test(secretKey),
    "SESSION_SECRET must be a hex string",
  );
  invariant(
    secretKey.length % 2 === 0,
    "SESSION_SECRET must have an even number of hex characters",
  );
  invariant(
    secretKey.length === REQUIRED_KEY_BYTES * 2,
    `SESSION_SECRET must be ${REQUIRED_KEY_BYTES * 2} hex characters (${REQUIRED_KEY_BYTES} bytes) for A256CBC-HS512`,
  );

  const hexValues = secretKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16));

  return new Uint8Array(hexValues);
};

let key = null as null | Uint8Array<ArrayBuffer>;
export const getSessionKey = () => {
  if (!key) {
    key = normalizeSessionKey(getSessionSecretString());
  }
  return key;
};
