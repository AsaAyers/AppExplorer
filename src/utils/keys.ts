import invariant from "tiny-invariant";

// A256CBC-HS512 requires a 512-bit (64-byte) key
const REQUIRED_KEY_BYTES = 64;

let key = null as null | Uint8Array<ArrayBuffer>;
export const getSessionKey = () => {
  if (!key) {
    const secretKey = process.env.SESSION_SECRET;
    invariant(typeof secretKey === "string", "Missing SESSION_SECRET");
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

    const hexValues = secretKey
      .match(/.{2}/g)!
      .map((byte) => parseInt(byte, 16));

    key = new Uint8Array(hexValues);
  }
  return key;
};
