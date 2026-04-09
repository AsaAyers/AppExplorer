import { debugLog } from "@/utils/debug-log";
import prisma from "@/utils/prisma";

const log = debugLog("app-explorer:health-check");

export async function GET() {
  let database = false;
  const now = new Date().toISOString();
  try {
    database = Boolean(await prisma.$queryRaw`SELECT 1`);
  } catch (e) {
    log(e);
  }

  return Response.json(
    { now, database },
    {
      status: database ? 200 : 500,
    },
  );
}
