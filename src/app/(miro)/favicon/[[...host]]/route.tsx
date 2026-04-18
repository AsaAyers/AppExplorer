import { NextRequest, NextResponse } from "next/server";
import invariant from "tiny-invariant";

import { getOrigin } from "@/utils/get-origin";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/favicon/[[...host]]">,
) {
  const host = (await ctx.params).host?.[0];

  invariant(typeof host === "string", "Invalid host");
  invariant(host !== "", "Invalid host");

  const url = new URL(`favicon.ico`, await getOrigin(req));
  url.host = host;

  const response = await fetch(url, {
    cache: "force-cache",
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  return new NextResponse(response.body);
}
