"use client";
import Image from "next/image";

import { DistanceToCard } from "@/app/(miro)/sidebar/list/distance-to-card";
import { UpgradeButton } from "@/app/(miro)/sidebar/overview/upgrade-button";
import appcardStatusDisabled from "@/assets/appcard-status-disabled.svg";
import appcardStatusDisconnected from "@/assets/appcard-status-disconnected.svg";
import expandIcon from "@/assets/expand-icon.svg";
import { AppExplorerCard } from "@/components/app-explorer-card";
import { useClientSession } from "@/components/client-session";

const iconMap = {
  connected: expandIcon,
  disconnected: appcardStatusDisconnected,
  disabled: appcardStatusDisabled,
} as const;

const exampleCard = {
  type: "symbol",
  id: "1",
  boardId: "",
  title: "Example Card",
  path: "src/index.js",
  symbol: "main",
  status: "connected",
  codeLink: "https://github.com/AsaAyers",
  x: 50,
  y: 100,
} as const;
export default function SidebarOverview() {
  const data = useClientSession();
  return (
    <>
      <div className="cs1 ce6 p-2">Card Actions</div>
      {!data?.isPaid ? (
        <div className="cs7 ce12 p-2 ml-auto ">
          <UpgradeButton />
        </div>
      ) : null}
      <div className="cs2 ce12 pr-2">
        <ul className="list-disc">
          <li>
            <span className="inline-block w-5 h-5 mr-1">
              <span className="icon icon-hand " />
            </span>
            Drag cards from &quot;Create Cards&quot; onto the board.
          </li>
          <li>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="inline-block align-middle mr-1"
              src="/favicon/github.com"
              alt=""
              width="24"
              height="24"
            />
            Permalink to the hosted source code.
          </li>
          <li>
            <span className="bg-gray-500 hover:bg-black rounded-xl inline-block w-5 h-5 align-middle mr-1">
              <Image
                className="m-0.5 invert"
                src={iconMap.connected}
                alt="Connected App Icon"
                width="16"
                height="16"
              />
            </span>
            Open edit card modal.
          </li>

          <li>
            <span className="bg-gray-500 hover:bg-black rounded-xl inline-block w-5 h-5 align-middle mr-1">
              <Image
                className="m-0.5 invert"
                src={iconMap.disconnected}
                alt="Connected App Icon"
                width="16"
                height="16"
              />
            </span>
            This also opens the edit modal where you can select a different
            symbol to attach to.
          </li>

          <li>
            <DistanceToCard
              className="mr-1"
              cardData={exampleCard}
              center={{ x: 0, y: 0 }}
            />
            The arrow points toward the card and provides the{" "}
            <span title="The distance is divided by the default card height">
              distance
            </span>{" "}
            to the card. Clicking it will move the viewport to the card or the
            frame the card is on.
          </li>
        </ul>
      </div>
      <div className="cs1 ce12">
        <AppExplorerCard cardData={exampleCard} />
      </div>
    </>
  );
}
