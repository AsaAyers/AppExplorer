import Image from "next/image";

import appExplorerLogo from "@/assets/app-explorer.svg";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { CardData } from "@/extension/types";

const Loading = (
  props: Partial<Pick<CardData, "title" | "path" | "symbol">>,
) => {
  return (
    <div className="p-2 flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-4 bg-secondary-muted p-4 rounded-xl ">
        <Image
          width="64"
          height="64"
          loading="eager"
          className="inline-block animate-pulse"
          src={appExplorerLogo}
          alt="AppExplorer Logo"
        />
        <AppExplorerCard
          className="animate-pulse"
          cardData={{
            id: "",
            boardId: "",
            type: "symbol",
            title: "Loading...",
            path: "hello",
            symbol: "world",
            miroLink: undefined,
            codeLink: null,
            status: "connected",
            description: undefined,
            x: 0,
            y: 0,
            ...props,
          }}
        />
      </div>
    </div>
  );
};

export default Loading;
