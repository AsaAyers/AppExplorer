"use server";
import invariant from "tiny-invariant";

import initMiroAPI from "@/utils/init-miro-api";
import { readSession } from "@/utils/session";

export async function getRedirectUrl() {
  const { miro } = await initMiroAPI();
  const { data } = await readSession();
  invariant(data?.login, "Missing auth token");

  return {
    authUrl: miro.getAuthUrl(data?.login?.authToken),
    path: data.login.path,
  };
}
