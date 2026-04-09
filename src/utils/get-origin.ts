import { NextRequest } from "next/server";

export async function getOrigin(request: NextRequest) {
  // The 'host' header gives the hostname the request was sent to
  const host = request.headers.get("host");

  // In a production environment behind a reverse proxy (like Vercel),
  // 'x-forwarded-host' and 'x-forwarded-proto' provide the original
  // host and protocol requested by the client.
  const forwardedHost = request.headers.get("x-forwarded-host");

  // Use these headers to construct the full origin URL if needed
  const protocol = "https";
  const actualHost = forwardedHost || host;
  const fullOrigin = `${protocol}://${actualHost}`;

  return fullOrigin;
}
