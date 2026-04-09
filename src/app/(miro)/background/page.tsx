import BackgroundPageClient from "@/app/(miro)/background/background-page-client";
import { routeMetrics } from "@/utils/metrics";

export default function BackgroundPage() {
  routeMetrics.onRouteLoaded("/background");
  return <BackgroundPageClient />;
}
