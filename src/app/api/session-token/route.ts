import { randomUUID } from "node:crypto";

import { getSessionSecretString } from "@/utils/keys";
import { encryptUuidToken } from "@/utils/uuid-token";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      sessionToken: encryptUuidToken(randomUUID(), getSessionSecretString()),
    },
    {
      status: 200,
    },
  );
}
