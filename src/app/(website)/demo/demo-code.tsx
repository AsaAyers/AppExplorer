"use client";
import classNames from "classnames";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";

import "@/app/(website)/demo/demo-code.css";

import { useDemoFile } from "@/app/(website)/demo/demo-cards-around-cursor";
import { useDemoSessionTransport } from "@/app/(website)/demo/demo-session";
import { useDemoBoardStorage } from "@/app/(website)/demo/demo-storage";
import { createDebug } from "@/utils/create-debug";

const log = createDebug("app-explorer:demo");

export function DemoCode() {
  const { code, symbols, path } = useDemoFile();
  const lastSelectedCardId = React.useRef<string | undefined>(undefined);
  return (
    <DemoCodeImpl
      key={path}
      path={path}
      symbols={symbols}
      code={code}
      lastSelectedCardId={lastSelectedCardId}
    />
  );
}

export function DemoCodeImpl({
  code,
  symbols,
  path,
  lastSelectedCardId,
}: ReturnType<typeof useDemoFile> & {
  lastSelectedCardId: React.MutableRefObject<string | undefined>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [{ selected }, dispatch] = useDemoBoardStorage();
  const { emitCardsAroundCursor } = useDemoSessionTransport();

  // Helper to get character offset from mouse position using Range API
  const getOffsetFromPoint = React.useCallback(
    (x: number, y: number): number => {
      if (!containerRef.current) return 0;

      const position = document.caretPositionFromPoint(x, y);
      if (!position) return 0;

      // Use Range API to reliably measure offset from container start
      try {
        const range = new Range();
        range.setStart(containerRef.current, 0);
        range.setEnd(position.offsetNode, position.offset);
        const textBefore = range.toString();
        return textBefore.length;
      } catch {
        // Fallback: simple DOM walk as backup
        let charCount = 0;

        function walkToNode(
          node: Node,
          target: Node,
          targetOffset: number,
        ): number {
          if (node === target) {
            return charCount + targetOffset;
          }

          if (node.nodeType === Node.TEXT_NODE) {
            charCount += node.textContent?.length ?? 0;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (const child of node.childNodes) {
              const result = walkToNode(child, target, targetOffset);
              if (result !== -1) return result;
            }
          }

          return -1;
        }

        const result = walkToNode(
          containerRef.current,
          position.offsetNode,
          position.offset,
        );
        return result >= 0 ? result : 0;
      }
    },
    [],
  );
  type State = {
    start: number;
    end: number;
    selectionStart?: number | null;
  };

  const [state, updateState] = React.useReducer<State, [Partial<State>]>(
    (state, action) => {
      log("dispatch selection", action);
      return { ...state, ...action };
    },
    {
      start: -1,
      end: -1,
      selectionStart: null,
    },
  );

  const selectionPosition = React.useMemo(() => {
    const position = {
      start: Math.max(0, Math.min(state.start, state.end)),
      end: Math.max(1, Math.max(state.start, state.end)),
    };
    position.end = Math.max(position.start + 1, position.end);

    return position;
  }, [state.end, state.start]);

  log("selectionPosition", selectionPosition.start, selectionPosition.end);

  const selectionStart = state.start;
  const { cardsAroundCursor } = React.useMemo(() => {
    const cards = symbols
      .filter((s) => {
        return s.start <= selectionStart && s.end >= selectionStart;
      })
      .map((s) => s.card)
      .reverse();

    if (cards.length === 0) {
      return {
        cardsAroundCursor: symbols
          .filter((s) => !s.card.symbol.includes("/"))
          .map((s) => s.card),
      };
    }

    return {
      cardsAroundCursor: cards,
    };
  }, [selectionStart, symbols]);

  React.useEffect(() => {
    log("useEffect cardsAroundCursor");
    emitCardsAroundCursor(cardsAroundCursor);
  }, [cardsAroundCursor, emitCardsAroundCursor, path, symbols]);

  React.useEffect(() => {
    if (selectionPosition.start) {
      dispatch({ type: "selectionStart", value: selectionPosition.start });
    }
  }, [dispatch, selectionPosition.start]);

  const searchPath = useSearchParams().get("path");
  const router = useRouter();

  // Update selection when a symbol is selected
  React.useEffect(() => {
    if (!selected) {
      lastSelectedCardId.current = undefined;
      return;
    }

    const selectionChanged = lastSelectedCardId.current !== selected.id;
    lastSelectedCardId.current = selected.id;

    if (selectionChanged && searchPath !== selected.path) {
      router.replace("?path=" + selected.path);
      return;
    }

    const symbol = symbols.find(
      (e) => e.card.title === selected.title && e.card.path === selected.path,
    );
    log({ symbol });
    if (symbol) {
      updateState({
        start: symbol.start,
        end: symbol.end,
        selectionStart: null,
      });
      log({ searchPath }, symbol.card.path);
    }
  }, [path, router, searchPath, selected, symbols]);

  // Build a nested symbol tree so each symbol gets a single wrapper span.
  type SymbolNode = {
    title: string;
    start: number;
    end: number;
    symbolStart: number;
    symbolEnd: number;
    children: SymbolNode[];
  };

  const symbolTree = React.useMemo<SymbolNode[]>(() => {
    const nodes = symbols.map((s) => ({
      title: s.title,
      start: s.start,
      end: s.end,
      symbolStart: s.symbolStart,
      symbolEnd: s.symbolEnd,
      children: [] as SymbolNode[],
    }));

    nodes.sort((a, b) => a.start - b.start || b.end - a.end);

    const root: SymbolNode[] = [];
    const stack: SymbolNode[] = [];

    for (const node of nodes) {
      while (stack.length > 0 && node.start >= stack[stack.length - 1].end) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
        stack.push(node);
      } else {
        const parent = stack[stack.length - 1];
        parent.children.push(node);
        stack.push(node);
      }
    }

    return root;
  }, [symbols]);

  // Helper to render plain text with selection highlighting based on global offsets
  const renderTextWithSelection = React.useCallback(
    (text: string, baseOffset: number) => {
      const selStart = Math.min(selectionPosition.start, selectionPosition.end);
      const selEnd = Math.max(selectionPosition.start, selectionPosition.end);

      const relStart = Math.max(0, selStart - baseOffset);
      const relEnd = Math.min(text.length, selEnd - baseOffset);

      if (relStart >= relEnd) return text;

      const parts: React.ReactNode[] = [];
      if (relStart > 0)
        parts.push(
          <React.Fragment key="start">
            {text.slice(0, relStart)}
          </React.Fragment>,
        );
      parts.push(
        <span
          key={`sel-${baseOffset + relStart}`}
          className="demo-code-selection"
        >
          {text.slice(relStart, relEnd)}
        </span>,
      );
      if (relEnd < text.length)
        parts.push(
          <React.Fragment key="end">{text.slice(relEnd)}</React.Fragment>,
        );

      return (
        <React.Fragment key={`with-selection-${baseOffset}`}>
          {parts}
        </React.Fragment>
      );
    },
    [selectionPosition.start, selectionPosition.end],
  );

  // Render symbol nodes recursively, ensuring each symbol gets a single span
  const renderSymbolNodes = React.useCallback(
    (nodes: SymbolNode[], base = 0): React.ReactNode => {
      const out: React.ReactNode[] = [];
      let cursor = base;

      for (const node of nodes) {
        // text before this child
        if (node.start > cursor) {
          out.push(
            renderTextWithSelection(code.slice(cursor, node.start), cursor),
          );
        }

        // render node wrapper with its inner content
        const inner: React.ReactNode[] = [];
        let childCursor = node.start;
        let hasRenderedSymbolName = false;

        // First, render the symbol name segment if this is the start of the symbol
        const symbolNameEnd = node.symbolEnd;
        if (symbolNameEnd <= node.end && !hasRenderedSymbolName) {
          const symbolNameText = code.slice(node.symbolStart, node.symbolEnd);
          inner.push(
            <React.Fragment key={`before-symbol-name-${node.title}`}>
              {code.slice(childCursor, node.symbolStart)}
            </React.Fragment>,
          );
          inner.push(
            <span key={`symbol-name-${node.title}`} className="symbol">
              {renderTextWithSelection(symbolNameText, node.symbolEnd)}
            </span>,
          );
          childCursor = symbolNameEnd;
          hasRenderedSymbolName = true;
        }

        for (const child of node.children) {
          if (child.start > childCursor) {
            inner.push(
              renderTextWithSelection(
                code.slice(childCursor, child.start),
                childCursor,
              ),
            );
          }
          inner.push(renderSymbolNodes([child], child.start));
          childCursor = child.end;
        }
        if (childCursor < node.end) {
          inner.push(
            renderTextWithSelection(
              code.slice(childCursor, node.end),
              childCursor,
            ),
          );
        }

        out.push(
          <span key={node.title} data-symbol={node.title}>
            {inner}
          </span>,
        );

        cursor = node.end;
      }

      // remaining text after last node
      if (cursor < code.length && base === 0) {
        out.push(renderTextWithSelection(code.slice(cursor), cursor));
      }

      return <React.Fragment key={`symbol-${base}$`}>{out}</React.Fragment>;
    },
    [code, renderTextWithSelection],
  );

  const renderChunks = React.useMemo(
    () => renderSymbolNodes(symbolTree, 0),
    [symbolTree, renderSymbolNodes],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const offset = getOffsetFromPoint(e.clientX, e.clientY);
    updateState({ selectionStart: offset });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (state.selectionStart) {
      const offset = getOffsetFromPoint(e.clientX, e.clientY);

      updateState({
        selectionStart: Math.min(offset, state.start),
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // fallback: caret from point
    log("handleMouseUp");
    if (state.selectionStart) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        try {
          const end = getOffsetFromPoint(e.clientX, e.clientY);

          updateState({
            start: Math.min(state.selectionStart, end),
            end: Math.max(state.selectionStart, end),
            selectionStart: null,
          });
        } finally {
          sel.removeAllRanges();
        }
        return;
      }
      const offset = getOffsetFromPoint(e.clientX, e.clientY);

      updateState({
        end: offset + 1,
        selectionStart: null,
      });
    }
  };

  return (
    <>
      <div className="border-b-2 mb-2 font-mono text-md">{path}</div>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        tabIndex={0}
        className={classNames(
          "demo-code",
          "w-full overflow-auto rounded-md",
          "bg-gray-50 border border-gray-200/60/50",
          "p-3 whitespace-pre font-mono text-sm ",
          "focus:ring-4 focus:ring-blue-600 focus:ring-offset-2 focus:outline-none",
          "cursor-text",
        )}
      >
        {renderChunks}
      </div>
    </>
  );
}
