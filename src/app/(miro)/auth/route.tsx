import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import invariant from "tiny-invariant";

import { getOrigin } from "@/lib/get-origin";
import { updateSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  invariant(typeof path === "string", "Missing path");

  const authToken = crypto.randomUUID();
  await updateSession({
    login: {
      authToken,
      path,
    },
  });
  return redirect(String(new URL("/auth/start", await getOrigin(req))));
}
