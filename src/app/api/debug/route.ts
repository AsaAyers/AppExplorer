import { formatDistanceToNow } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

import { decrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const str = url.searchParams.get("session");

  const data = str ? await decrypt(str) : null;

  return NextResponse.json({
    session: str,
    data,
    expires: data?.exp ? formatDistanceToNow(new Date(data?.exp)) : null,
  });
}
