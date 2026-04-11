import { addMinutes } from "date-fns";
import * as jose from "jose";
import { SignJWT, jwtVerify } from "jose";

import { debugLog } from "@/utils/debug-log";
import { getSessionKey } from "@/utils/keys";
import { EncryptablePayload, SessionPayload } from "@/utils/session";

const log = debugLog("crypto");

export async function encrypt<T extends jose.JWTPayload = SessionPayload>(
  payload: T,
  secret = getSessionKey(),
  expiresAt?: string | number | Date,
) {
  if ("exp" in payload) {
    expiresAt = payload.exp;
    log("payload.exp", payload.exp);
  }
  expiresAt ??= addMinutes(new Date(), 1);

  return await new jose.EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .encrypt(secret);
}

export async function decrypt<T = SessionPayload>(
  jwt: string,
  secret = getSessionKey(),
) {
  try {
    const { payload } = await jose.jwtDecrypt(jwt, secret);
    return payload as T;
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      // don't log
    } else {
      log(new Date());
      log("decryption error", err);
    }

    return;
  }
}
const alg = "HS256";
export async function sign<T extends EncryptablePayload = SessionPayload>(
  payload: T,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(getSessionKey());
}

export async function verify<T extends EncryptablePayload = SessionPayload>(
  session: string | undefined = "",
) {
  try {
    const { payload } = await jwtVerify(session, getSessionKey(), {
      algorithms: [alg],
    });
    return payload as T;
  } catch {
    return null;
  }
}
