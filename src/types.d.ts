// types.d.ts
declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}
declare module "*.txt" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  import type { StaticImageData } from "next/image";
  const src: StaticImageData;
  export default src;
}
