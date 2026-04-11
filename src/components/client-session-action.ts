"use server";

import initMiroAPI from "@/utils/init-miro-api";
import { readSession } from "@/utils/session";

export type ClientSession = {
  isPaid: boolean;
  isAuthenticated: boolean;
};

export async function getClientSessionAction(): Promise<ClientSession> {
  const { data, userId } = await readSession();
  const { miro } = await initMiroAPI();
  const authorized = userId ? await miro.isAuthorized(userId) : false;

  return {
    isPaid: !!data?.isPaid,
    isAuthenticated: authorized,
  };
}
