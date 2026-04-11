import "server-only";
import { Miro } from "@mirohq/miro-api";
import { State } from "@mirohq/miro-api/dist/storage";
import { addDays } from "date-fns";
import { cookies } from "next/headers";

import { decrypt, encrypt } from "@/utils/crypto";
import { debugLog } from "@/utils/debug-log";
import {
  EncryptablePayload,
  SESSION_DAYS,
  sessionSettings,
} from "@/utils/session";
const log = debugLog("app-explorer:init-miro-api");

export const MIRO_COOKIE = "miro_tokens";

export type EncryptableMiroState = State & EncryptablePayload;

export default async function initMiroAPI() {
  const cookieInstance = await cookies();
  const getUserId = async () => (await getCookieValue())?.userId || "";

  const getCookieValue = async () => {
    // Load state (tokens) from a cookie if it's set
    try {
      const value = cookieInstance.get(MIRO_COOKIE)?.value;
      if (value) {
        return decrypt<EncryptableMiroState>(value);
      }
    } catch {
      // Fall through
    }
    return undefined;
  };

  // setup a Miro instance that loads tokens from cookies
  const miro = new Miro({
    logger: log,

    storage: {
      get: async () => {
        const value = await getCookieValue();

        return value;
      },
      set: async (_, state) => {
        const expires = addDays(new Date(), SESSION_DAYS);
        log("save state", state);

        if (!state) {
          cookieInstance.delete(MIRO_COOKIE);
        } else {
          cookieInstance.set(
            MIRO_COOKIE,
            await encrypt({
              ...state,
              exp: Math.floor(expires.getTime() / 1000),
            }),
            {
              ...sessionSettings,
              expires,
            },
          );
        }
      },
    },
  });

  return {
    miro,
    getUserId,
  };
}
