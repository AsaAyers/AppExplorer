import emit from "@/app/(website)/demo/demo-text-files/emit";
import helloSh from "@/app/(website)/demo/demo-text-files/hello";
import pyConsumer from "@/app/(website)/demo/demo-text-files/py_consumer";
import rustAudit from "@/app/(website)/demo/demo-text-files/rust_audit";
import saveDoc from "@/app/(website)/demo/demo-text-files/saveDoc";
import { CardData } from "@/EventTypes";
import { notEmpty } from "@/utils/notEmpty";

export const demoTextFiles = (
  [saveDoc, emit, pyConsumer, rustAudit, helloSh] as Array<DemoFile | null>
).filter(notEmpty);

export type DemoFile = {
  symbols: DemoSymbol[];
  code: string;
  path: string;
};
export type DemoSymbol = {
  title: string;
  start: number;
  end: number;
  card: CardData;
  symbolStart: number;
  symbolEnd: number;
};

export function registerFile(file: DemoFile) {
  demoTextFiles.push(file);
}
