import "server-only";

import { addDays } from "date-fns";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { cookies } from "next/headers";
import { forbidden } from "next/navigation";

import { identity } from "@/extension/utils/identity";

import { encrypt, decrypt } from "@/utils/crypto";
import { debugLog } from "@/utils/debug-log";
import type { EncryptableMiroState, MIRO_COOKIE } from "@/utils/init-miro-api";
import { isPaid } from "@/utils/is-paid";

const debug = debugLog("app-explorer:session");

export const SESSION_DAYS = 7;

export const sessionSettings: Partial<ResponseCookie> = {
  httpOnly: true,
  partitioned: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

export type RedirectPayload = EncryptablePayload & {
  authToken: string;
  path: string;
};

export type SessionPayload = EncryptablePayload & {
  isPaid: boolean;
  totalCards?: number;
  websocketKey: string;
  exp?: number;
  login?: {
    authToken: string;
    path: string;
  };
};

export type EncryptablePayload = {
  expiresAt: Date;
};

export async function createSession(userId: string) {
  const expiresAt = addDays(new Date(), SESSION_DAYS);

  const session = await encrypt({
    userId,
    expiresAt,
    isPaid: await isPaid(userId),
  });
  const cookieStore = await cookies();

  cookieStore.set("session", session, {
    ...sessionSettings,
    expires: expiresAt,
  });
}

export async function readSession() {
  try {
    const requestCookies = await cookies();
    const session = requestCookies.get("session")?.value;
    const miroCookie = requestCookies.get(
      identity<typeof MIRO_COOKIE>("miro_tokens"),
    )?.value;

    let userId = null;
    if (miroCookie) {
      try {
        userId = (await decrypt<EncryptableMiroState>(miroCookie))?.userId;
      } catch {
        // ignore
      }
    }

    const data = session ? await decrypt(session) : null;
    return { session, data, userId };
  } catch (e) {
    console.error("Error reading session", e);

    return { session: null, data: null };
  }
}

export async function hasAuthenticatedSession() {
  return !!(await cookies()).get("session")?.value;
}

export async function updateSession(updates: Partial<SessionPayload>) {
  const { data, userId } = await readSession();
  const expiresAt = addDays(new Date(), SESSION_DAYS);

  const newData = {
    ...data,
    ...updates,
    expiresAt,
    isPaid: userId ? await isPaid(userId) : false,
  };

  const newSession = await encrypt(newData);
  const cookieStore = await cookies();
  cookieStore.set("session", newSession, {
    ...sessionSettings,
    expires: newData.expiresAt,
  });
}

const ASA = "3458764514899667689";
export async function isAsa() {
  const { userId } = await readSession();

  if (userId !== ASA) {
    forbidden();
  }
}
