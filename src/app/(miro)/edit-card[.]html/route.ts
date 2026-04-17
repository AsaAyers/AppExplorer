import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(
    new URL("/card/placeholder-board/placeholder-card", request.url),
  );
}
