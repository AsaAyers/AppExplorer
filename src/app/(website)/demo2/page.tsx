"use client";
import classNames from "classnames";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import DemoBoard from "@/app/(website)/demo/@board/default";
import { DemoCode } from "@/app/(website)/demo/demo-code";
import { DemoBoardStorageProvider } from "@/app/(website)/demo/demo-storage";
import { FileTabs } from "@/app/(website)/demo/file-tabs";
import { ScreenTooSmall } from "@/app/(website)/demo/screen-too-small";
import { TaskContextProvider } from "@/app/(website)/demo/tasks";
import {
  installExtension,
  installMiroApp,
} from "@/app/(website)/install-buttons";
import appExplorerLogo from "@/assets/app-explorer.svg";
import { debugLog } from "@/utils/debug-log";

const log = debugLog("app-explorer:demo2:layout");

export default function Demo2Page() {
  return (
    <TaskContextProvider>
      <DemoBoardStorageProvider>
        <div className={classNames("h-dvh relative demo", {})}>
          <iframe
            src="/demo2/background"
            className="absolute w-1 h-1 left--10 top--10"
          />
          <div
            className={classNames(
              "inset-0 absolute demo-page",
              // mirotone provides the grid class, so I need ! to override it.
              "grid gap-x-0! gap-y-0!",
            )}
          >
            <div
              className={classNames(
                "col-span-full p-2 mb-0 grid",
                "border-b-2 border-water",
              )}
            >
              <Link
                href="/"
                className="m-2 col-span-6 lg:col-span-6 whitespace-pre"
              >
                <Image
                  width="24"
                  height="24"
                  className="inline-block pgap-2 mr-2"
                  src={appExplorerLogo}
                  alt="AppExplorer Logo"
                />
                AppExplorer Demo
              </Link>
              <div className="ml-auto lg:visible invisible col-start-7 col-end-13 flex justify-end h-min">
                {installExtension}
                {installMiroApp}
              </div>
            </div>

            <ScreenTooSmall />

            <div className="hidden lg:grid lg:col-span-4 xl:col-span-3  overflow-scroll mb-auto ">
              <section className="cs1 ce12 p-3 space-y-4">
                <p className="text-sm text-gray-600">
                  Scenario: Each new developer on your team needs to know the
                  process that saving a document follows. Across multiple
                  projects in multiple languages in multiple repositories, we
                  can draw a diaram of the process.
                </p>
                <p>
                  Use the readonly code editor below to discover the{" "}
                  <span className="symbol">symbols</span> in these files. Drag
                  the symbol cards onto the board on the right to build a
                  diagram of the architecture.
                </p>

                <React.Suspense>
                  <FileTabs />
                  <DemoCode />
                </React.Suspense>
              </section>
            </div>
            <div className="hidden lg:grid lg:col-span-4 xl:col-span-3  bg-gray-500 h-full relative pl-1 pr-1 ">
              <iframe
                src="/demo2/cards-around-cursor"
                className="w-full h-full"
              />
            </div>

            <React.Suspense>
              <DemoBoard />
            </React.Suspense>
          </div>
        </div>
      </DemoBoardStorageProvider>
    </TaskContextProvider>
  );
}
