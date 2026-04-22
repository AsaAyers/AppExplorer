import React from "react";

import DemoPageClient from "@/app/(website)/demo/demo-page-client";
import { routeMetrics } from "@/utils/metrics";

export default function DemoPage() {
  routeMetrics.onRouteLoaded("/demo");
  return (
    <React.Suspense>
      <DemoPageClient />
    </React.Suspense>
  );
}
