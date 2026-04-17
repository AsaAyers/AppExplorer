"use client";

import { AppExplorerCard } from "./app-explorer-card";

import type { CardData } from "@/card-data";

const exampleCard: CardData = {
  id: "example-card",
  x: 0,
  y: 0,
  title: "{title} - Example Card",
  boardId: "",
  type: "symbol",
  path: "{file/path}",
  symbol: "{symbol/path}",
  codeLink: "https://github.com/AsaAyers/AppExplorer",
  status: "disabled",
};

export function AppExplorerOnboarding() {
  return (
    <div
      className="rounded-lg border border-dashed border-slate-300 bg-white p-4"
      data-testid="no-symbols-onboarding"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Explore your code here</h3>
          <p className="text-sm text-slate-600">
            This panel shows functions, classes and symbols near your cursor so
            you can drag them onto the board.
          </p>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>
            Open a source file such as <code>.ts</code>, <code>.js</code>, or{" "}
            <code>.py</code>.
          </li>
          <li>
            Click inside a function, class, or block of code instead of the top
            or bottom of the file.
          </li>
          <li>Watch symbols appear here, then drag any card onto the board.</li>
        </ol>

        <p className="text-sm text-slate-700">
          AppExplorer cards pin code references to a board so you can add more
          explanation, screenshots, shapes, and connecting lines around the
          code.
        </p>

        <AppExplorerCard
          cardData={exampleCard}
          className="m-0"
          miroDraggable={false}
          showStatusButton={false}
        />

        <ul className="space-y-3 text-sm text-slate-700">
          <li>
            <strong className="block">What is a symbol?</strong>
            AppExplorer works with the language server, so symbol rules depend
            on the language. In JavaScript, variables and function declarations
            usually count.
          </li>
          <li>
            <strong className="block">
              What does &quot;around the cursor&quot; mean?
            </strong>
            Symbols are nested, so AppExplorer shows the stack of symbols
            surrounding the current cursor position.
          </li>
          <li>
            <strong className="block">
              Why are there no symbols around my cursor?
            </strong>
            You may be on imports or whitespace instead of inside a symbol
            declaration.
          </li>
        </ul>
      </div>
    </div>
  );
}
