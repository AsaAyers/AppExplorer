export async function GET() {
  const database = false;
  const now = new Date().toISOString();

  return Response.json(
    { now, database },
    {
      status: database ? 200 : 500,
    },
  );
}
