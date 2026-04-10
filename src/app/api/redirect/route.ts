import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import invariant from "tiny-invariant";

import { delay } from "@/extension/utils/delay";
import { debugLog } from "@/utils/debug-log";
import initMiroAPI from "@/utils/init-miro-api";
import { readSession } from "@/utils/session";

const log = debugLog("app-explorer:redirect");

// handle redirect with code and exchange it for the access token
export async function GET(request: NextRequest) {
  const { miro, getUserId } = await initMiroAPI();

  // Make sure the code is in query parameters
  const code = request.nextUrl.searchParams.get("code");

  if (typeof code !== "string") {
    redirect("/?missing-code");
    return;
  }
  const { data } = await readSession();
  invariant(data?.login, "missing auth token");

  try {
    log("exchange code for token");
    const token = await miro.exchangeCodeForAccessToken(
      data.login.authToken,
      code,
    );
    log("token", token);
  } catch (e) {
    log("error", e);
    redirect("/error");
  }

  let userId;

  for (let i = 0; i < 5; i++) {
    userId = await getUserId();
    log("getUserId", userId);
    if (userId) {
      break;
    }
    await delay(10);
  }

  invariant(userId, "Expected userId");
  // await updateSession({
  //   login: undefined,
  // });

  await delay(1000);
  log(`redirect /auth/done`);
  redirect(`/auth/done`);
}
