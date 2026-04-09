"use server";

import { debugLog } from "@/lib/debug-log";
import initMiroAPI from "@/lib/init-miro-api";
import { createWebsocketKey, readSession } from "@/lib/session";

const log = debugLog("app-explorer:client-session-action");
export type ClientSession = {
  isPaid: boolean;
  isAuthenticated: boolean;
  websocketKey: string;
};

export async function getClientSessionAction(): Promise<ClientSession> {
  const { data, userId } = await readSession();
  const { miro } = await initMiroAPI();
  const authorized = userId ? await miro.isAuthorized(userId) : false;

  return {
    isPaid: !!data?.isPaid,
    isAuthenticated: authorized,
    websocketKey: data?.websocketKey ?? (await createWebsocketKey()),
  };
}
