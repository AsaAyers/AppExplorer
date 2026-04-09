import { getCurrentPublicKey } from "@/extension/utils/keys";

export async function GET() {
  return new Response(getCurrentPublicKey());
}
