import code from "@/app/(website)/demo/demo-text-files/rust_audit.rs.txt";
import type { DemoFile } from "@demo/index";

const demoFile: DemoFile = {
  path: "rust_audit.rs",
  code: code,
  symbols: [
    {
      start: 32,
      end: 243,
      symbolEnd: 39,
      symbolStart: 35,
      card: {
        id: "ex1",
        x: 0,
        y: 0,
        type: "symbol",
        boardId: "demo-board",
        title: "main",
        description: "",
        path: "rust_audit.rs",
        symbol: "main",
        codeLink: null,
        status: "connected",
      },
      title: "main",
    },
  ],
};

export default demoFile;
