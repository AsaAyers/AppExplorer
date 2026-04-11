import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      // @ts-expect-error __coverage__
      coverage: global.__coverage__ || null,
    },
    {
      status: 200,
    },
  );
}
