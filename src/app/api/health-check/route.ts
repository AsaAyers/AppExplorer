export async function GET() {
  let database = false;
  const now = new Date().toISOString();

  return Response.json(
    { now, database },
    {
      status: database ? 200 : 500,
    },
  );
}
