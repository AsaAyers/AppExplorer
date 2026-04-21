import { getSessionSecretString } from "@/utils/keys";
import { encryptUuidToken } from "@/utils/uuid-token";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      sessionToken: await encryptUuidToken(
        crypto.randomUUID(),
        getSessionSecretString(),
      ),
    },
    {
      status: 200,
    },
  );
}
