"use client";

import Link from "next/link";
import React from "react";
import invariant from "tiny-invariant";

import { AppExplorerCard } from "@/components/app-explorer-card";
import { CardData } from "@/extension/types";
import { useChannelData } from "@/utils/broadcast-channel";
import { debugLog } from "@/utils/debug-log";
import { isAppCard } from "@/utils/is-app-card";
import { getMiroAdapter, MiroAdapter } from "@/utils/miro/adapter";
import { updateCard } from "@/utils/update-card";

const log = debugLog("app-explorer:card-page");

async function handleSubmit(
  miroAdapter: MiroAdapter,
  event: React.SubmitEvent<HTMLFormElement>,
) {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = new FormData(form);

  const card = await miroAdapter.getBoardItemById(data.get("cardId") as string);

  invariant(card, "Missing card");
  invariant(isAppCard(card), "Expected an AppCard");

  const [path, symbol] = (data.get("pathSymbol") as string).trim().split("|");

  await updateCard(card, {
    type: "symbol",
    title: data.get("title") as string,
    description: data.get("description") as string,
    path,
    symbol,
  });

  await miroAdapter.closeModal();
}

export default function CardPage(
  _props: PageProps<"/card/[boardId]/[cardId]">,
) {
  const miroAdapter = React.useMemo(() => getMiroAdapter(), []);
  const originalDataRef = React.useRef<CardData | undefined>(undefined);
  const [cardData, setCardData] = React.useState<undefined | CardData>();

  const channelData = useChannelData();

  React.useEffect(() => {
    miroAdapter.getModalData<CardData>().then((cardData) => {
      if (cardData) {
        originalDataRef.current = cardData;
        setCardData(cardData);
      }
    });
  }, [miroAdapter]);

  const [error, setError] = React.useState<null | string>("");

  const vscodeUrl = React.useMemo(() => {
    if (cardData) {
      const url = new URL("vscode://asa-ayers.app-explorer/code");
      url.protocol = "vscode-insiders:";
      url.searchParams.set("symbol", cardData?.symbol);
      url.searchParams.set("path", cardData?.path);
      return String(url);
    }
  }, [cardData]);

  if (!cardData) {
    return <div>Loading card data...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl min-h-56 px-4 ">
      <AppExplorerCard cardData={cardData} />
      {vscodeUrl ? (
        <Link className="link link-primary" href={vscodeUrl}>
          {vscodeUrl.split("?")[0]}
        </Link>
      ) : null}
      <form
        className="m-2"
        onSubmit={(event) =>
          handleSubmit(miroAdapter, event).catch((e) => setError(e.message))
        }
        onChange={(e) => {
          const form: HTMLFormElement = e.currentTarget;
          const data = new FormData(form);

          const [path, symbol] = (data.get("pathSymbol") as string).split("|");
          const newCardData = {
            type: "symbol",
            title: data.get("title") as string,
            description: (data.get("description") as string).trim(),
            path,
            symbol,
          } as const;
          setCardData((cardData) => {
            if (cardData) {
              return { ...cardData, ...newCardData };
            }
            return cardData;
          });
        }}
      >
        {error ? <div className="text-attention">{error}</div> : null}
        <input type="hidden" name="cardId" value={cardData.id} />
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            autoFocus
            className="input"
            type="text"
            defaultValue={cardData.title}
            id="title"
            name="title"
          />
        </div>
        <div className="form-group">
          <label htmlFor="symbol">Symbol Path</label>
          <select
            id="symbol"
            defaultValue={cardData.symbol || ""}
            name="pathSymbol"
            className="select"
          >
            <option
              key="current-value"
              value={cardData.path + "|" + cardData.symbol}
            >
              {cardData.symbol}
            </option>
            {channelData.cardsAroundCursor?.map((card: CardData, index) => (
              <option
                key={card.miroLink ?? index}
                defaultValue={card.path + "|" + card.symbol}
              >
                {card.path + "|" + card.symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-row space-between">
          <button
            className="button bg-primary text-primary-foreground"
            type="submit"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
