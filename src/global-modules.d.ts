// types.d.ts

declare module "*.png" {
  const content: string;
  export default content;
}
declare module "*.txt" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  import type { StaticImageData } from "next/image";
  const src: StaticImageData;
  export default src;
}

declare global {
  var metricsRegistry: MetricsRegistry | undefined;
}
