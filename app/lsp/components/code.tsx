import React from "react"
import type { LinksFunction } from "@remix-run/node";
import codeStylesheet from './code.css'
import classNames from "classnames";
import { MiroShape } from "./miro-shape";
import { useLatestRef } from "./useLatestRef";
import { MiroCard } from "./miro-card";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: codeStylesheet },
]

export type CodeSelection = {
  startLine: number;
  endLine: number;
  text: string[],
};

type Props = {
  line?: number
  onSelection?: (data: CodeSelection) => void
  shapeMeta?: {
    projectName: string,
    path: string,
  }
};

export const Code = ({ children, line = 1, shapeMeta, onSelection }: React.PropsWithChildren<Props>): JSX.Element => {
  const [lineSelection, setLineSelection] = React.useState<number[]>([])

  const selectLine = React.useCallback((line: number) => {
    // Only select lines if this component has metadata for a shape.
    if (!onSelection) { return }

    setLineSelection((prev) => {
      const lastSelection = prev[prev.length - 1]
      if (lastSelection == undefined) {
        return [line]
      } else if (lastSelection < line) {
        return [lastSelection, line]
      } else {
        return [line, lastSelection]
      }
    })
  }, [onSelection])


  const textSelection = React.useMemo(() => {
    if (lineSelection.length === 0) {
      return []
    }
    const lines = String(children!).split('\n')
    return lines.slice(lineSelection[0], lineSelection[1] + 1)
  }, [lineSelection, children])

  const selectionRef = useLatestRef(onSelection)
  React.useEffect(() => {
    const onSelection = selectionRef.current
    if (textSelection.length > 0 && lineSelection.length === 2 && onSelection) {
      onSelection({
        startLine: lineSelection[0],
        endLine: lineSelection[1],
        text: textSelection,
      })
      setLineSelection([])
    }
  }, [lineSelection, selectionRef, textSelection])

  const lines = React.useMemo(() => String(children!).split('\n'), [children])

  return (
    <>
      <div className="bg-graphite p-2 m-2 max-h-[75vh] overflow-auto">
        <code
          className={classNames("whitespace-pre text-white flex flex-col", {
          })}
          style={{
            counterSet: `line ${line - 1}`,
          }}
        >

          {lines.map((line, i) => (
            <span
              onClick={() => selectLine(i)}
              className={classNames({
                'active': i >= lineSelection[0] && i <= lineSelection[1],
              })}
              key={i}>{line}</span>
          ))}
        </code>
      </div>
    </>
  )
}