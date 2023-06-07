import React from "react"
import type { LinksFunction } from "@remix-run/node";
import codeStylesheet from './code.css'
import classNames from "classnames";
import invariant from "tiny-invariant";
import { useLatestRef } from "./useLatestRef";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: codeStylesheet },
]

export type CodeSelection = {
  startLine: number;
  endLine: number;
  text: CodeProps['lines']
  title?: string
};

export type CodeProps = {
  firstLine?: number
  lines: Array<string>
  onSelection?: (data: CodeSelection) => void
  annotations?: Array<AnnotationData>
  peek?: number
  children: React.ReactNode,
};

export const Code = ({
  lines,
  peek,
  children,
  firstLine = 1,
  onSelection,
  annotations = []
}: React.PropsWithChildren<CodeProps>): JSX.Element => {
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
    return lines.slice(lineSelection[0], lineSelection[1] + 1)
  }, [lineSelection, lines])

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

  const annotatedLines = React.useMemo(() => {
    return lines.map((line, i) => {
      const annotationsForLine = annotations.filter((annotation) => {
        return annotation.startLine <= i && annotation.endLine >= i
      })


      return annotationsForLine.reduce<Array<string | JSX.Element>>((lineArray, annotation) => {
        const segment = lineArray[lineArray.length - 1]
        invariant(typeof segment === 'string', 'Expected segment to be a string')
        const processedCharacters = line.length - segment.length

        let start = (annotation.startLine === i ? annotation.startCharacter : 0) - processedCharacters
        let end = (annotation.endLine === i ? annotation.endCharacter : line.length) - processedCharacters
        if (annotation.startLine < i) {
          start = 0
        }
        if (annotation.endLine > i) {
          end = line.length - processedCharacters
        }


        const prefix = segment.slice(0, start)
        const suffix = segment.slice(end)
        let annotationText = segment.slice(start, end)

        return [
          prefix,
          <span
            onClick={annotation.onClick}
            key={annotation.name}
            className="annotation"
          >
            {annotationText}
          </span>,
          suffix,
        ]

      }, [line])
    })
  }, [annotations, lines])

  return (
    <>
      <code
        className="code"
        style={{
          counterSet: `line ${firstLine - 1}`,
        }}
      >

        {annotatedLines.map((line, i) => (
          <React.Fragment key={i}>
            <span
              onClick={() => selectLine(i)}
              className={classNames('line', {
                'active': i >= lineSelection[0] && i <= lineSelection[1],
              })}
              key={i}>
              {line}
            </span>
            {peek && peek === i && children && (
              <div className="peek">
                {children}
              </div>
            )}
          </React.Fragment>
        ))}
      </code>
    </>
  )
}


export type AnnotationData = {
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
  onClick: () => void
  name: string
  dragId: string
}