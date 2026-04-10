import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

export const POST = async (request: NextRequest) => {
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json(
      { message: "Missing GITHUB_WEBHOOK_SECRET" },
      {
        status: 500,
      },
    );
  }
  const payload = await request.json();

  /* Validate the webhook */
  const signature = request.headers.get("X-Hub-Signature-256");
  if (!signature) {
    return NextResponse.json({ message: "Missing signature" }, { status: 401 });
  }
  const generatedSignature = `sha256=${crypto
    .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex")}`;
  const sigBuffer = Buffer.from(signature);
  const genBuffer = Buffer.from(generatedSignature);
  const signaturesMatch =
    sigBuffer.length === genBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, genBuffer);
  if (!signaturesMatch) {
    return NextResponse.json(
      { message: "Signature mismatch" },
      { status: 401 },
    );
  }

  const tags: string[] = [];
  let message;
  const click = "https://appexplorer.dev";
  switch (payload?.action) {
    case "requested":
      // message = "Requested a new deploy";
      break;
    case "in_progress":
      break;
    case "completed":
      message = "Deploy conclusion: " + payload?.workflow_run?.conclusion;
      tags.push("tada");
      break;
  }
  if (message) {
    const topic = "MxBTQoxmc7VZXfc0";
    const response = await fetch("https://ntfy.sh", {
      method: "POST",
      body: JSON.stringify({
        topic,
        message,
        tags,
        title: "AppExplorer.dev",
        click,
        icon: payload?.sender?.avatar_url,
      }),
    });

    return NextResponse.json(await response.json(), {
      status: 200,
    });
  }

  return NextResponse.json(
    { success: true },
    {
      status: 200,
    },
  );
};
