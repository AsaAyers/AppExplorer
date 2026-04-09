"use client";

import classNames from "classnames";
import Link from "next/link";
import React from "react";

import Loading from "@/app/(miro)/loading";
import { CardsAroundCursor } from "@/components/cards-around-cursor";
import { useChannelData } from "@/utils/broadcast-channel";
import { debugLog } from "@/utils/debug-log";
import { useForegroundMiro } from "@/utils/foreground-miro-handler";
import { randomHex } from "@/utils/to-hex";

const log = debugLog("app-explorer:sidebar:create");
const installUrl =
  "https://miro.com/app-install/?response_type=code&client_id=3458764531189693223&redirect_uri=%2Fapp-install%2Fconfirm%2F";

export default function SidebarCreate() {
  const data = useChannelData();
  log("sidebar", data);
  if (!data.socketStatus) {
    return (
      <div className="cs1 ce12">
        <InstallExtension />
      </div>
    );
  }

  return (
    <div className="cs1 ce12">
      <CardsAroundCursor draggable />
    </div>
  );
}

function InstallExtension() {
  const [insiders, setInsiders] = React.useState(false);
  const sessionUrl = React.useMemo(() => {
    const url = new URL(`vscode://asa-ayers.app-explorer/session`);
    if (insiders) {
      url.protocol = "vscode-insiders:";
    }
    if (process.env.NEXT_PUBLIC_BASE_URL?.includes("dev.")) {
      url.searchParams.set("isDev", "true");
    }

    return String(url);
  }, [insiders]);

  const { sessionId } = useChannelData();
  const foreground = useForegroundMiro();

  const onClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    event.preventDefault();
    const url = new URL(sessionUrl);
    const id = randomHex(128);
    const key = randomHex(512);

    url.searchParams.set("id", id);
    url.searchParams.set("key", key);

    foreground.startSession(id, key);

    window.location.href = url.toString();
  };

  return (
    <section
      style={{ maxHeight: "40vh" }}
      className={classNames("cs1 ce12 p-3 space-y-4")}
    >
      <h2 className="text-lg font-semibold">
        Connect the AppExplorer extension
      </h2>

      <p className="text-sm text-gray-700">
        Install the AppExplorer VS Code extension to create draggable
        code-symbol cards on Miro directly from your editor.
      </p>

      <ol className="list-decimal list-inside text-sm space-y-1">
        <li>
          <Link
            href={installUrl}
            className={classNames(
              "inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm shadow-sm hover:bg-blue-700",
            )}
          >
            Install AppExplorer
          </Link>
        </li>
        <li>
          <Link
            href={sessionUrl}
            onClick={onClick}
            className={classNames(
              "inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm shadow-sm hover:bg-blue-700",
              {
                "animate-pulse": sessionId,
              },
            )}
          >
            Start Session
          </Link>
        </li>
      </ol>
      <label>
        <input
          type="checkbox"
          className="mr-2"
          checked={insiders}
          onChange={(e) => setInsiders(e.target.checked)}
        />
        Use VSCode Insiders
      </label>

      {sessionId ? (
        <>
          <Loading title="Waiting for VSCode to connect..." />
        </>
      ) : null}
    </section>
  );
}
