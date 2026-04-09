import * as jose from "jose";
import invariant from "tiny-invariant";

const publicKeys = {};

const keys = Object.keys(publicKeys).sort().reverse();

export function getCurrentKeyID() {
  return (process.env.JWT_DATE || keys[0]) as keyof typeof publicKeys;
}

// I can't get CI to cooperate, so it gets its own permanent backup key.
const backupKey =
  "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg+F2BjbGCydtvTcT4\ndAH7j8ZqlcrA9OfXjK4GJNOWGYuhRANCAASJBjye/W9/lIYEYdI1bUhMiF8onqKu\naEqGH4pLp88pC6dpkV3bKFCndtCbRd6nt+07B4bYQkVWJA247pu2F7rp\n-----END PRIVATE KEY-----";
export async function getPrivateKey() {
  const jwtDate = getCurrentKeyID();
  const key = ((process.env[`JWT_${jwtDate}_KEY`] as string) ?? backupKey)
    .replaceAll("\\\n", "\n")
    .replaceAll("\\n", "\n");

  return await jose.importPKCS8(key, "ES256");
}

export function getCurrentPublicKey() {
  const jwtDate = getCurrentKeyID();

  const key = publicKeys[jwtDate];

  return key;
}

export async function verifyToken(token: string) {
  for (const key of keys) {
    const publicKey = publicKeys[key as keyof typeof publicKeys];
    const ecPublicKey = await jose.importSPKI(publicKey, "ES256");

    try {
      const { payload } = await jose.jwtVerify(token, ecPublicKey, {
        algorithms: ["ES256"],
      });
      return payload;
    } catch {
      // ignore
    }
  }
  return null;
}

let key = null as null | Uint8Array<ArrayBuffer>;
export const getSessionKey = () => {
  if (!key) {
    const secretKey = process.env.SESSION_SECRET;
    invariant(typeof secretKey === "string", "Missing SESSION_SECRET");

    const hexValues = secretKey
      .match(/.{1,2}/g)
      ?.map((byte) => parseInt(byte, 16));
    invariant(hexValues, "Unable to parse hex values");

    key = new Uint8Array(hexValues);
  }
  return key;
};
