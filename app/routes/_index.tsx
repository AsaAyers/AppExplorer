import React from "react";
import "@mirohq/websdk-types";
import { Link } from "@remix-run/react";

async function init() {
  miro.board.ui.on("icon:click", async () => {
    await miro.board.ui.openPanel({ url: "/lsp" });
  });

  miro.board.ui.on("app_card:open", async (event) => {
    const { appCard } = event;
    console.log("app_card:open", appCard);

    const target = await appCard.getMetadata("target");

    console.log("open", appCard, target);
    if (typeof target === "string" && target[0] === "/") {
      await miro.board.ui.openModal({ url: target });
    }
  });
}

export default function Index() {
  React.useEffect(() => {
    init();
  }, []);
  return (
    <div>
      <Link to="/lsp">LSP</Link>
    </div>
  );
}
